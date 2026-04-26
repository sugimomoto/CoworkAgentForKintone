# Phase 1b-2 (改訂) — Remote MCP + JWT Bearer 要求定義

## 背景・前提

### 旧 Phase 1b-2 (廃止) との違い

旧設計 [.steering/20260425-phase-1b-2-vault-environment/](../20260425-phase-1b-2-vault-environment/)
は **Vault に kintone 認証情報を直接保管 + ヘルパーライブラリを Environment に pip install** する案だった。
だが Anthropic Beta API には **Vault に key/value を書き込む公開 API が存在しない** ため、
このアプローチは実装不能であることが判明。

代わりに、新たに判明した [Vault Credential API](https://docs.anthropic.com/.../vaults) の
**`static_bearer` 認証**機構を活用し、Remote MCP Server (Cloudflare Workers ホスト) を
立てて、kintone 認証情報を **JWT 形式で Vault Credential に保管**する設計に切り替える。

旧 Phase 1b-2 のコード (`resolveVault` / `ensureUserEnvironment` / `useUserBinding` /
`CredentialDialog` / chat store の binding 系) は **大半流用可能**。ただし:
- `setVaultKeys` 関連 → `createVaultCredential` ベースに置換
- `ensureUserEnvironment` → 廃止 (helper を pip install しないため bootstrap Env のままで OK)
- `useUserBinding` → JWT 生成 + Credential 登録のフロー
- `CredentialDialog` → そのまま流用

### kintone Plugin の運用モデル

- kintone Plugin の **設定画面は管理者しかアクセスできない**
- 管理者 = Worker 管理者を兼務する想定
- 一般 end-user (kintone のユーザー) は **管理者が立てた 1 つの Worker を共有**して利用
- 各 end-user は自分の kintone 認証情報で JWT を作り、自分専用の Vault Credential に保管

## 公開・配布前提

- リポジトリは **Public 化済み** (helper / plugin / mcp すべて GitHub で公開可能)
- Worker は Cloudflare Workers でホスト、各 kintone 管理者が **自分の Cloudflare アカウントで deploy**
- Worker のソースコード: `packages/kintone-mcp/` に追加 (新規パッケージ)
- 配布手段: **GitHub README の "Deploy to Cloudflare" ボタン** + `wrangler` CLI 両対応

## アーキテクチャ概要

```
[kintone Plugin (browser)]
   ↓ (admin が設定保存時)
   ├─ Anthropic API Key を setProxyConfig 登録
   ├─ Worker URL / MINT_API_KEY を setProxyConfig 登録
   ↓
[end-user チャット送信時]
   ↓
   CredentialDialog (kintone domain / login / password)
   ↓
   Plugin → kintone.plugin.app.proxy → Worker /mint
            (Bearer: MINT_API_KEY を proxy が自動注入)
   ↓
[Cloudflare Worker /mint]
   - MINT_API_KEY 検証
   - 受け取った kintone creds を JWT に署名 (HMAC-SHA256, JWT_HMAC_SECRET)
   - JWT を Plugin に返却
   ↓
[Plugin]
   - resolveUserVault → vault_id (per kintone user)
   - createVaultCredential(vault_id, { static_bearer, mcp_server_url, token: jwt })
     → credential_id
   - chat store に vault_id / credential_id 保存
   - メモリ上の kintone creds と JWT を破棄
   ↓
[end-user メッセージ送信]
   ↓
   Plugin → Anthropic /v1/sessions { vault_ids: [vault_id] }
   ↓
[Anthropic Agent]
   ↓ (kintone 操作が必要 = MCP tool 呼出)
   Vault Credential を mcp_server_url で照合 → JWT を取得
   ↓ Authorization: Bearer <JWT>
[Cloudflare Worker /mcp]
   - JWT 署名検証 (HMAC-SHA256, JWT_HMAC_SECRET)
   - JWT payload から kintone domain / login / password を取り出す
   - kintone REST API 呼出
   ↓
[Anthropic Agent ← レスポンス]
```

## 受け入れ条件

### AC-1: Cloudflare Worker (`packages/kintone-mcp/`)
- TypeScript で実装
- `wrangler.toml` に Cloudflare Deploy Button 用 vars 設定
- 必須 secrets:
  - `JWT_HMAC_SECRET` (32 byte 以上のランダム値)
  - `MINT_API_KEY` (32 byte 以上のランダム値)
- 任意の env vars (Worker レベルで kintone 共通設定が必要なら): なし (per-user JWT に含める)
- 公開エンドポイント:
  - `POST /mint` — Bearer: `MINT_API_KEY`、body: `{ kintone_domain, kintone_login, kintone_password }` → JWT 返却
  - `POST /mcp` — Bearer: JWT、MCP HTTP transport (initialize / tools/list / tools/call)
- 401 / 400 / 502 エラーは MCP 仕様準拠の JSON レスポンス
- 単体テスト: vitest + miniflare (Cloudflare Worker 用) で JWT 検証 / kintone モック呼出
- `unbuild` or `wrangler deploy` で本番化、`wrangler dev` でローカル起動
- README に Deploy 手順 (Deploy ボタン + 手動 wrangler deploy)

### AC-2: Worker MCP tool セット (Phase 1b-2 スコープ — 読取系のみ)
- `tools/list` で以下 tool を返す:
  - `kintone_apps_list` (name フィルタ、ページング)
  - `kintone_apps_get` (app_id)
  - `kintone_apps_get_schema` (app_id)
  - `kintone_records_get` (app_id, query, fields, total_count)
  - `kintone_records_iter_all` は MCP では cursor が server-side だと扱いにくいので、
    `kintone_records_get` でページ指定可にする (`limit` / `offset` parameters)。または
    `kintone_records_iter_all` を 1 回の MCP コールで全件返す (サイズ制限注意)
  - 書込系 (add/update/delete) は **Phase 1c に持ち越し**
- 各 tool の input_schema は JSON Schema で定義
- kintone REST 呼出は Worker 内の `fetch` で直接 (依存ライブラリ無し)

### AC-3: Plugin 設定画面拡張 (admin 画面)
- 管理者画面に追加項目:
  - Worker URL (例: `https://cowork-agent-kintone-mcp.your-account.workers.dev`)
  - MINT_API_KEY (パスワード型入力、書込専用扱い)
- 保存時:
  - Worker URL は kintone.plugin.app.setConfig で通常保存 (end-user JS から `getConfig` で参照可、URL 自体は秘匿性低)
  - **MINT_API_KEY は setProxyConfig** で Worker `/mint` URL 宛の `Authorization: Bearer ...` ヘッダとして登録
    → end-user JS から `getConfig` でも `getProxyConfig` でも値を参照不可。proxy 経由の HTTP 呼出時のみ自動注入される
- Anthropic API Key (既存) はそのまま維持
- **Setup の順序**:
  1. admin が Plugin 設定画面で Worker URL + MINT_API_KEY を入力 → 保存
  2. 別途、admin が Cloudflare Worker を deploy (Worker secret に同じ MINT_API_KEY と JWT_HMAC_SECRET を登録)
  - 両方完了で end-user の利用が可能になる

### AC-4: JWT 生成と Vault Credential 登録 (`useUserBinding` 改修)

**CredentialDialog の入力項目** (簡素化):
- **kintone ドメイン**: kintone JS API (`location.host`) で**自動取得 + read-only**表示
  - end-user は変更できない (現在の kintone セッションのドメインに固定)
- **ログイン名**: `kintone.getLoginUser().code` で**自動初期値** + 編集可
  - 通常はログイン中ユーザーのコードでそのまま OK。Basic 認証用ログイン名が異なる場合は編集
- **パスワード**: end-user 入力 (必須)

**フロー** (Plugin 視点で「JWT を生成 → Vault に保管」):
- end-user が password 入力 → 登録ボタン
- Plugin → kintone.plugin.app.proxy で `POST {workerURL}/mint`
  - body: `{ kintone_domain, kintone_login, kintone_password }`
  - proxy が `Authorization: Bearer {MINT_API_KEY}` を自動注入 (= end-user は MINT_API_KEY を見られない)
  - レスポンス: `{ jwt: "..." }`
  - ※ 実装上は Worker /mint が JWT を署名するが、Plugin 視点では「JWT を取得した = JWT を生成した」と等価
- Plugin → resolveUserVault(ctx) で per-user Vault を取得 (旧 Phase 1b-2 の V2 流用)
- Plugin → POST `/v1/vaults/{vault_id}/credentials`:
  ```json
  {
    "display_name": "kintone (sato@example.cybozu.com)",
    "auth": {
      "type": "static_bearer",
      "mcp_server_url": "{workerURL}/mcp",
      "token": "{jwt}"
    }
  }
  ```
- レスポンスから `credential_id` を取得し、chat store に `vaultId` / `credentialId` 保存
- Plugin メモリ上の kintone creds と JWT を即破棄
- `bind()` の in-flight 保護は既存通り

### AC-5: Session 作成時の Vault 参照 (`createUserSession` 改修)
- bound 状態 (`vaultId` あり) の場合、`createSession` body に `vault_ids: [vaultId]` を含める
- bootstrap Environment は維持 (`environmentId` は今までの値のまま)
- ユーザー専用 Environment 作成 (旧 `ensureUserEnvironment`) は **廃止**
- helper Python ライブラリの pip install も廃止 (bootstrap Env で OK)

### AC-6: ローテーション・再バインド
- 管理者が CredentialDialog を Header の設定アイコンから再表示できる
- 入力された新 creds で再度 /mint → 新 JWT
- `PATCH /v1/vaults/{vault_id}/credentials/{credential_id}` で `auth.token` を更新
- vault_id / credential_id は不変、実行中の Session も新トークンを採用 (Anthropic 仕様)
- 新規バインド (Credential 未作成) と区別: chat store に `credentialId === null` なら create、あれば update

### AC-7: Agent 設定への MCP server 登録
- Default Agent 作成時 (`resolveDefaultAgent`) に **MCP server を tool として登録**
  - tools 配列に `{ type: 'mcp', server_url: workerURL/mcp, ... }` を追加 (実 API 仕様に合わせて要確認)
- Agent はこの MCP 経由で kintone 操作 tool を呼べるようになる
- Worker URL は Plugin admin が設定したものを `resolveDefaultAgent` の作成時に注入
- 既存 Default Agent がある場合は version up で MCP tool 追加 (POST `/v1/agents/{id}` with `version`)

### AC-8: Network 設定
- Environment の `allowed_hosts` に Worker URL のホストを追加
  - 既存 bootstrap Environment は touch しない
  - 新規作成時のみ Worker host を含める
- Anthropic Console から Worker への HTTPS リクエストが allowed_hosts チェックを通る必要あり
- 実 API 仕様で MCP server が allowed_hosts の影響を受けるかは要確認 (場合によっては別フィールド)

### AC-9: 既存仕様の維持
- 単体テスト 232 件 + helper 61 件は緑のまま
- 既存 E2E 16 件は破壊しない
- パネル開閉 / Welcome / 履歴 / 新規会話 / IME ガードに影響なし
- Phase 1a / Session 再設計 / Phase 1b-1 のステアリングは触らない

## 非機能要件

- NFR-1: JWT_HMAC_SECRET / MINT_API_KEY は Worker 内および Plugin の setProxyConfig に閉じ、JS / API レスポンスに漏れない
- NFR-2: end-user は他 end-user の Vault Credential を読み出せない (write-only secret 仕様で Anthropic 側保証)
- NFR-3: kintone 認証情報は Plugin / Anthropic 経由で **永続化されるのは Vault Credential の token のみ** (= JWT 暗号化保管)
- NFR-4: JWT には `exp` (90 日) を含める。期限切れ時は再 mint + Credential update を促す
- NFR-5: Worker は stateless (KV / Durable Object なし) で alpha 配布を簡素化
- NFR-6: 既存 E2E への影響を抑えるため、`bind setup spec` で 1 度バインドすれば以降は素通しできること

## 想定するユーザーストーリー

> **kintone admin**: 自社 kintone 環境用に Cloudflare Worker を 1 つデプロイ。
> Plugin の設定画面で Anthropic API Key + Worker URL + MINT_API_KEY を登録。
> アプリにプラグイン追加 + デプロイ。

> **kintone end-user**: 普段通り kintone のレコード一覧画面を開く → チャットパネル右側に表示。
> 初回送信で「kintone 認証情報を登録してください」モーダル出現。
> ID / パスワード入力 → 登録 → メッセージ送信完了。Agent が kintone レコードを操作できる。

## スコープ外 (Phase 1c 以降)

- 書込系 tool (add/update/delete records, bulk_request)
- HITL 承認フロー (Plan / Approval カード)
- Agent system prompt の kintone 操作ガイドライン (Phase 1b-3)
- Tool / Plan / Progress / Result カード UI (Phase 1b-3)
- helper Python ライブラリの活用 (Pattern A 用途) — 残置するが本 Phase では不使用
- 多 kintone tenant 切替 (1 admin = 1 Worker = 1 tenant 前提)
- end-user 同士の Vault Credential 隔離強化 (alpha では同テナント信頼前提)
- Worker のロギング・監視・rate limit (alpha では Cloudflare デフォルトに依存)

## 影響範囲

### 新規パッケージ
- `packages/kintone-mcp/` — Cloudflare Worker
  - `src/index.ts` (Worker entry)
  - `src/mint.ts` (JWT 生成エンドポイント)
  - `src/mcp.ts` (MCP HTTP handler)
  - `src/tools/` (kintone_apps_*, kintone_records_*)
  - `src/jwt.ts` (HMAC-SHA256 署名・検証)
  - `src/kintone.ts` (REST 呼出ヘルパ)
  - `wrangler.toml`, `package.json`, `tsconfig.json`, `vitest.config.ts`
  - `tests/` (vitest + miniflare)
  - `README.md` (Deploy ボタン含む)

### 既存 Plugin の変更
- `core/constants.ts` — HELPER_* 削除、`MCP_BEARER_HEADER` 等の MCP 関連定数追加
- `core/managed-agents/types.ts` — `Credential` 型 + `static_bearer` Auth 型 追加
- `core/managed-agents/resources.ts` — `createVaultCredential` / `updateVaultCredential` / `archiveVaultCredential` / `listVaultCredentials` 追加
- `core/bootstrap/resolveVault.ts` — `setVaultCredentials` を `createVaultCredential` 呼出に置換
- `core/bootstrap/ensureEnvironment.ts` — **削除** (使わない)
- `core/bootstrap/resolveSession.ts` — `vault_ids` 引数追加 (旧 Phase 1b-2 で実装済 → そのまま流用)
- `core/jwt.ts` — **新規** (Plugin 側で JWT 操作するならここ。今回は Worker /mint に委譲するので不要かも)
- `core/kintone/proxyTransport.ts` — Worker /mint 呼出ヘルパ追加 (kintone.plugin.app.proxy 経由)
- `desktop/hooks/useUserBinding.ts` — bind() 内で /mint → createVaultCredential のフロー
- `desktop/components/CredentialDialog.tsx` — 流用
- `desktop/ChatPanel.tsx` — 流用 (binding ステータス周り)
- `store/chatStore.ts` — `userEnvironmentId` を `credentialId` にリネーム (or 並存)
- `config/ConfigScreen.tsx` — Worker URL / MINT_API_KEY 入力欄追加 + setProxyConfig 登録ロジック

### E2E
- `e2e/credential-bind.setup.ts` (旧 Phase 1b-2 版) — JWT-based に書き直し
- `e2e/credential-binding.spec.ts` — Worker URL がモック可能なテスト用、または実 Worker を立てた前提のスペック

## 完了条件

- AC-1〜9 + NFR-1〜6 を満たす
- Plugin 単体テスト 全緑 (新規追加分含む)
- Worker 単体テスト 全緑
- `bind setup spec` で実環境バインドが通る
- 動作確認: 実 kintone 環境で「初回送信 → Dialog → 入力 → 登録 → kintone API を Agent が叩いてレコード取得」 完走
- `helper-v0.1.0a3` (Phase 1b-1) は archive せず残置 (Pattern A 用途で将来再利用余地)
- 旧 `.steering/20260425-phase-1b-2-vault-environment/` は **触らない** (履歴として残す)
