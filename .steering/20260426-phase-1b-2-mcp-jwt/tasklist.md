# Phase 1b-2 (改訂) — Remote MCP + JWT Bearer タスクリスト

要件: [requirements.md](./requirements.md)
設計: [design.md](./design.md)
参考: [.claude/skills/KintoneMCPServerReference/SKILL.md](../../.claude/skills/KintoneMCPServerReference/SKILL.md)

凡例: 🟥 失敗テスト先行 / 🟩 実装 / 🔵 リファクタ / ⬜ 設定・ドキュメント

## 進め方 (TDD)

各セクション内は **🟥 (Red: 失敗テスト先行) → 🟩 (Green: 実装で緑) → 🔵 (Refactor)** の順に並べてある。
セクション間は依存関係順で並んでおり、原則として上から順に実施する:

```
[Worker]
  M0 (cleanup) → M1 (scaffolding)
  → M2 (jwt) → M3 (kintone http) → M4 (mint)
  → M5 (build-query) → M6 (tools) → M7 (filter)
  → M8 (mcp) → M9 (router) → M10 (README)
[Plugin]
  P1 (resources) → P2 (mintClient) → P3 (chatStore)
  → P4 (useUserBinding) → P5 (CredentialDialog) → P6 (ConfigScreen)
  → P7 (useSession) → P8 (ChatPanel)
  → P9 (Agent MCP 登録 — 要 API 検証)
[統合]
  E1 (E2E) → D1 (deploy + 手動確認) → D2 (refactor + cleanup)
```

並列開発するなら:
- `[Worker]` と `[Plugin] P1〜P3` は独立 (interfaces だけ合意があれば)
- P4 以降は Worker /mint が動いている必要あり (mock でも可)



---

## M0. 旧 Phase 1b-2 残骸の整理

- [ ] 🔵 `core/bootstrap/ensureEnvironment.ts` を削除
- [ ] 🔵 `core/bootstrap/ensureEnvironment.test.ts` を削除
- [ ] 🔵 `core/managed-agents/resources.ts` から `setVaultKeys` 削除 (前 Phase で書いていた場合)
- [ ] 🔵 `core/managed-agents/resources.test.ts` から `setVaultKeys` テスト削除
- [ ] 🔵 旧 `useUserBinding` の bind 内ロジックは V8 で書き直すので一旦そのまま
- [ ] ⬜ Anthropic 上の旧 Vault / User Environment は手動で archive (admin の作業 / README に明記)

---

## M1. Cloudflare Worker 雛形 (`packages/kintone-mcp/`)

- [ ] ⬜ `packages/kintone-mcp/package.json` (name: `@cowork-agent/kintone-mcp`、private)
- [ ] ⬜ `packages/kintone-mcp/tsconfig.json` (target: ES2022, lib: ESNext + WebWorker)
- [ ] ⬜ `packages/kintone-mcp/wrangler.toml` (name, main, compatibility_date)
- [ ] ⬜ `packages/kintone-mcp/vitest.config.ts` (miniflare integration if needed)
- [ ] ⬜ `packages/kintone-mcp/.gitignore` 追加
- [ ] ⬜ `pnpm-workspace.yaml` に `packages/kintone-mcp` を追加 (既に `packages/*` で含まれているか確認)
- [ ] ⬜ `pnpm install` で依存解決確認
- [ ] ⬜ `wrangler dev` でローカル起動確認 (Hello World ハンドラで疎通)

---

## M2. JWT 署名・検証 (`src/jwt.ts`)

- [ ] 🟥 `tests/jwt.test.ts` — `signJwt({...}, secret)` が JWT 形式 (3 ドット区切り) を返す
- [ ] 🟥 — `verifyJwt(jwt, secret)` で payload を取り出せる
- [ ] 🟥 — 不正な signature で例外
- [ ] 🟥 — `exp` 切れで例外
- [ ] 🟥 — 別の secret で verify すると失敗
- [ ] 🟥 — base64url のパディング処理 (URL safe)
- [ ] 🟩 `src/jwt.ts` 実装 (Web Crypto API、依存ライブラリ無し)
- [ ] 🟩 `src/base64.ts` (encodeBase64Url / decodeBase64Url ヘルパ)

---

## M3. kintone REST 呼出ヘルパ (`src/kintone.ts`)

- [ ] 🟥 `tests/kintone.test.ts` — `kintoneRequest(creds, 'GET', path, params)` が正しい URL / Basic 認証ヘッダを送る
- [ ] 🟥 — GET 時に Content-Type を付けない (Phase 1b-1 で踏んだ罠を回避)
- [ ] 🟥 — POST 時に Content-Type: application/json + JSON body
- [ ] 🟥 — params のリスト値は `key=v1&key=v2` 形式 (kintone 互換)
- [ ] 🟥 — 4xx / 5xx で例外、エラーメッセージに kintone レスポンス body を含める
- [ ] 🟩 `src/kintone.ts` 実装 (fetch ベース、Basic 認証 / API token 両対応)

---

## M4. /mint エンドポイント (`src/mint.ts`)

- [ ] 🟥 `tests/mint.test.ts` — Authorization header が無いと 401
- [ ] 🟥 — Authorization が間違っていると 401
- [ ] 🟥 — body の必須フィールドが欠けると 400
- [ ] 🟥 — 正常系: { kintone_domain, kintone_login, kintone_password } → JWT 返却
- [ ] 🟥 — 返却 JWT の payload に exp が含まれる (90 日)
- [ ] 🟩 `src/mint.ts` 実装

---

## M5. 構造化フィルタ → kintone クエリ生成 (`src/tools/utils/build-query.ts`)

- [ ] 🟥 `tests/build-query.test.ts` — textContains: `field like "value"`
- [ ] 🟥 — equals (string / number)
- [ ] 🟥 — dateRange (from / to / 両方)
- [ ] 🟥 — numberRange (min / max / 両方)
- [ ] 🟥 — inValues / notInValues
- [ ] 🟥 — orderBy + limit + offset の組合せ
- [ ] 🟥 — フィルタ無しの場合 undefined
- [ ] 🟩 `buildQueryFromFilters(filters, orderBy, limit, offset)` 実装

---

## M6. ツール実装 (Phase 1b-2 — 4 種、公式準拠)

各ツールは `src/tools/<name>.ts` に Zod スキーマ + callback で実装。
**factory を先に通してから個別ツールに進む**。

### M6-0. createTool ファクトリ
- [ ] 🟥 `tests/tools/factory.test.ts` — `createTool(name, config, callback)` が `{ name, config, callback }` を返す
- [ ] 🟥 — `createToolCallback(callback, options)` が options を bind した関数を返す
- [ ] 🟩 `src/tools/factory.ts` 実装 (公式 MCP 準拠の Tool 型 + createTool)
- [ ] 🟩 `src/tools/types/tool.ts` (Tool / ToolConfig / ToolCallback の型定義)

### M6-1. kintone-get-apps
- [ ] 🟥 `tests/tools/get-apps.test.ts` — name フィルタ / spaceIds / limit / offset
- [ ] 🟥 — `tools/list` で表示される input/output schema が Zod raw shape 形式
- [ ] 🟩 `src/tools/get-apps.ts` (createTool 利用)

### M6-2. kintone-get-app
- [ ] 🟥 `tests/tools/get-app.test.ts` — app id を渡して /k/v1/app.json
- [ ] 🟥 — 404 → MCP error response
- [ ] 🟩 `src/tools/get-app.ts`

### M6-3. kintone-get-form-fields
- [ ] 🟥 `tests/tools/get-form-fields.test.ts` — app id を渡して /k/v1/app/form/fields.json
- [ ] 🟥 — preview / lang オプション
- [ ] 🟩 `src/tools/get-form-fields.ts`

### M6-4. kintone-get-records
- [ ] 🟥 `tests/tools/get-records.test.ts` — 基本: app id 指定 → /k/v1/records.json
- [ ] 🟥 — filters → kintone query 文字列に組立 (M5 を利用)
- [ ] 🟥 — orderBy / limit / offset / fields の連結
- [ ] 🟥 — totalCount 含めて返却
- [ ] 🟥 — クエリ無しの場合 (filters / orderBy / etc 全て unset)
- [ ] 🟩 `src/tools/get-records.ts`

### M6-集約
- [ ] 🟥 `tests/tools/index.test.ts` — `tools` 配列に 4 種が含まれる
- [ ] 🟩 `src/tools/index.ts` で `tools` 配列にまとめる

---

## M7. ツールフィルタ (`src/server/tool-filters.ts`)

- [ ] 🟥 `tests/tool-filters.test.ts` — `isApiTokenAuth=true` で `kintone-get-apps` が除外
- [ ] 🟥 — `isApiTokenAuth=false` で全ツール有効
- [ ] 🟩 `src/server/tool-filters.ts` 実装

---

## M8. /mcp エンドポイント (`src/mcp.ts`)

- [ ] 🟥 `tests/mcp.test.ts` — Authorization 無しで 401
- [ ] 🟥 — JWT 不正で 401
- [ ] 🟥 — JWT 期限切れで 401
- [ ] 🟥 — `tools/list` リクエストでツール一覧返却
- [ ] 🟥 — auth_type='api_token' のとき除外ツールが list から消える
- [ ] 🟥 — `tools/call` で対応するツールが起動 + structuredContent + content[] 返却
- [ ] 🟥 — 不明なツール名で `error` 返却
- [ ] 🟥 — `initialize` リクエストで server info / capabilities 返却
- [ ] 🟩 `src/mcp.ts` 実装 (JSON-RPC 2.0 ハンドラ)

---

## M9. router (`src/index.ts`)

- [ ] 🟩 `src/index.ts` で /mint と /mcp をルーティング、それ以外は 404
- [ ] ⬜ `wrangler dev` で curl 疎通テスト (mint → JWT 取得 → mcp tools/list で確認)

---

## M10. README + Deploy 準備 (`packages/kintone-mcp/README.md`)

- [ ] ⬜ Quick Start (wrangler login, secret put 手順)
- [ ] ⬜ 環境変数 (JWT_HMAC_SECRET, MINT_API_KEY) 説明 + 生成方法 (例: `openssl rand -hex 32`)
- [ ] ⬜ Cloudflare Deploy Button 用コード片 (将来追加可)
- [ ] ⬜ ローカルでの開発手順 (`wrangler dev` + curl)
- [ ] ⬜ ロギング・トラブルシューティング章

---

## P1. Plugin 側 — Vault Credential API ラッパ

- [ ] 🟥 `core/managed-agents/resources.test.ts` 拡張 — `createVaultCredential(vaultId, body)` が POST /v1/vaults/{id}/credentials を呼ぶ
- [ ] 🟥 — body shape (`auth.type='static_bearer' / mcp_server_url / token`) 確認
- [ ] 🟥 — `listVaultCredentials(vaultId)`
- [ ] 🟥 — `updateVaultCredential(vaultId, credId, body)` (PATCH)
- [ ] 🟥 — `archiveVaultCredential(vaultId, credId)` (POST /archive)
- [ ] 🟩 `core/managed-agents/types.ts` に `VaultCredential` 型 + `VaultAuth` union 追加
- [ ] 🟩 `core/managed-agents/resources.ts` に 4 関数追加

---

## P2. Plugin 側 — mintClient

- [ ] 🟥 `core/mcp/mintClient.test.ts` — kintone proxy 経由で `POST {workerUrl}/mint` を呼ぶ
- [ ] 🟥 — body 必須フィールドが渡る
- [ ] 🟥 — レスポンスから `jwt` を抽出
- [ ] 🟥 — エラー時は throw
- [ ] 🟩 `core/mcp/mintClient.ts` 実装 (proxy transport を使う)

---

## P3. Plugin 側 — chatStore 改修

- [ ] 🟥 `store/chatStore.test.ts` 拡張 — `userEnvironmentId` 削除を確認
- [ ] 🟥 — `credentialId: string | null` の初期値 + setter
- [ ] 🟥 — reset() で credentialId も初期化
- [ ] 🟩 `chatStore.ts` 改修

---

## P4. Plugin 側 — useUserBinding 大改修

- [ ] 🟥 `useUserBinding.test.ts` 書き直し — bind() で:
  - kintone proxy 経由で /mint を呼ぶ
  - resolveUserVault で vault 取得
  - createVaultCredential で credential 作成
  - chatStore に vaultId / credentialId を保存
- [ ] 🟥 — 既存 Credential があれば updateVaultCredential で上書き (= 再バインド)
- [ ] 🟥 — エラー時の status='error' + error message 保持
- [ ] 🟥 — in-flight 保護
- [ ] 🟩 `useUserBinding.ts` 改修

---

## P5. Plugin 側 — CredentialDialog 微修正

- [ ] 🟥 `CredentialDialog.test.tsx` 修正 — domain は read-only 表示 (kintone JS API から自動取得)
- [ ] 🟥 — login 入力に `kintone.getLoginUser().code` で初期値が入る
- [ ] 🟥 — onSubmit が `{ login, password }` のみ渡す (domain なし)
- [ ] 🟩 `CredentialDialog.tsx` 修正
- [ ] 🟩 `getCurrentSessionContext()` から domain を取得する config を `core/kintone/user.ts` で確認

---

## P6. Plugin 側 — ConfigScreen 拡張

- [ ] 🟥 `ConfigScreen.test.tsx` 拡張 — Worker URL / MINT_API_KEY 入力欄表示
- [ ] 🟥 — 保存時に Worker URL は setConfig、MINT_API_KEY は setProxyConfig (`{workerUrl}/mint` 宛 POST の Bearer)
- [ ] 🟥 — MINT_API_KEY 値は表示時に空 (write-only)
- [ ] 🟩 `ConfigScreen.tsx` 拡張

---

## P7. Plugin 側 — useSession の vault_ids 注入

- [ ] 🟥 `useSession.test.ts` 修正 — bound 状態 (vaultId / credentialId 揃い) で createUserSession が `vault_ids` 含む body を送る
- [ ] 🟥 — unbound のときは vault_ids 無し (Phase 1a 互換)
- [ ] 🟥 — bootstrap Environment は変えない
- [ ] 🟩 `useSession.ts` の ensureSession 改修

---

## P8. Plugin 側 — ChatPanel 配線確認

- [ ] 🟥 `ChatPanel.test.tsx` — bindingStatus='unbound' で送信 → CredentialDialog → onSubmit → useUserBinding.bind 呼出
- [ ] 🟥 — bind 成功で保留テキスト送信
- [ ] 🟩 必要に応じて `ChatPanel.tsx` 微修正

---

## P9. Plugin 側 — Default Agent への MCP server 登録 (要 API 検証)

実 API 仕様が未確定なため、まず疎通優先で skill / API ドキュメントを確認しながら実装する。

- [ ] ⬜ 実 Anthropic API で Agent / Environment への MCP server 登録方法を curl 検証
  - 候補 A: Agent.tools 配列に `{ type: 'mcp', server_url, name }`
  - 候補 B: Environment.networking.mcp_servers
  - 実 API レスポンスで判明したフィールド名を採用
- [ ] 🟥 `resolveAgent.test.ts` 拡張 — Default Agent 作成時に MCP server URL を含める
- [ ] 🟩 `resolveAgent.ts` の `createAgent` 引数に MCP server 関連を追加
- [ ] ⬜ chat store の Worker URL を読み取って Agent 作成時に渡す

---

## E1. E2E

- [ ] ⬜ `e2e/credential-bind.setup.ts` を JWT-based に書直し
  - Worker は実環境にデプロイ済み前提
  - CredentialDialog で domain は自動 / login は kintone JS API デフォルト / password 入力
  - 登録 → JWT 経由で Vault Credential 作成 → 完了確認
- [ ] ⬜ `e2e/credential-binding.spec.ts` 既存テストを更新
- [ ] ⬜ 既存 16 件 + bind setup を緑にする

---

## D1. デプロイ + 動作検証

- [ ] ⬜ Worker をローカルから本番 Cloudflare Workers にデプロイ
  - `wrangler secret put JWT_HMAC_SECRET`
  - `wrangler secret put MINT_API_KEY`
  - `wrangler deploy`
- [ ] ⬜ Plugin 設定画面で Worker URL / MINT_API_KEY を保存
- [ ] ⬜ Plugin を kintone にデプロイ + アプリ更新
- [ ] ⬜ ブラウザで「初回送信 → CredentialDialog → 登録 → メッセージ送信」 完走確認
- [ ] ⬜ (P9 完了後) Agent が `kintone-get-records` を呼んでレコード取得 → 応答 完走確認

---

## D2. リファクタ・整理

- [ ] 🔵 `simplify` skill で全変更箇所を 3-agent レビュー
- [ ] ⬜ 単体テスト ・ E2E すべて緑
- [ ] ⬜ 旧 Phase 1b-2 ステアリングを `archived` に明記 (touch せず読みやすく)

---

## 完了条件

- requirements.md AC-1〜9 + NFR-1〜6 を満たす
- Worker 単体テスト 緑 (目標 50+ tests)
- Plugin 単体テスト 緑 (新規追加 ≥ 30 tests、既存 232 件は維持 or 増)
- E2E 16 + bind 系で 緑
- 実環境動作確認: 初回バインド + kintone レコード取得まで 1 通り通る
- 旧 Phase 1b-2 残骸は削除済 / 役割の重複なし
