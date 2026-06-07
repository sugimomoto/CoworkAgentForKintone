# 技術仕様書 (Architecture Document)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.3 (V1 wedge MVP — Custom Skills / Settings View / Custom Tool 反映)
**最終更新日**: 2026-06-07

---

## 1. 技術スタック概要

本プロダクトは **2 つの独立したコードベース** で構成される pnpm monorepo。

| パッケージ | 言語 | 配布形態 | 役割 |
|---------------|------|---------|------|
| **`packages/plugin`** (kintone プラグイン本体) | TypeScript + React + Tailwind | `.zip` (kintone Plugin format) | レコード一覧画面に Chat UI、設定画面 (4 ステップウィザード)、kintone OAuth flow |
| **`packages/kintone-mcp`** (Cloudflare Worker) | TypeScript + Cloudflare Workers Runtime | Cloudflare Workers script | MCP HTTP transport / OAuth callback 中継 / Anthropic Vault Credential 中継 |

> **Phase 1b-1 (Python ヘルパーライブラリ) は Phase 1b-2 で MCP に置き換え、Phase 1b-3 でさらに Worker をマルチテナント化した。Python パッケージ `cowork-agent-kintone` は廃止。**

---

## 2. kintone プラグイン (`packages/plugin`)

### 2.1 言語・フレームワーク

| 項目 | 採用技術 | 理由 |
|------|---------|------|
| 言語 | **TypeScript 5.x** (strict + exactOptionalPropertyTypes) | 型安全性 |
| UI | **React 18** | チャット UI の状態管理 |
| 状態管理 | **Zustand** | 軽量、メモリ内 store |
| スタイリング | **Tailwind CSS 3.x** | kintone デザインと衝突しないユーティリティ |
| バンドラ | **esbuild** (IIFE 出力) | 高速、シングルファイル化に最適 |
| テスト | **Vitest** + **Testing Library** | unit / component |
| E2E | **Playwright** | 実 kintone + 実 Anthropic API + 実 Worker での verification |
| Lint/Format | **ESLint** + **Prettier** | — |

### 2.2 kintone 関連ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `kintone-ui-component` (任意) | 設定画面の UI コンポーネント |
| `cli-kintone` | プラグイン zip 化 + アップロード |

### 2.3 ディレクトリ構造 (主要)

```
packages/plugin/
├── plugin/                  # kintone Plugin format の zip 内容
│   ├── manifest.json
│   ├── html/config.html
│   ├── js/{desktop,config}.js  (esbuild 出力)
│   └── css/{desktop,config}.css (Tailwind 出力)
├── src/
│   ├── config/             # 設定画面 (4 ステップウィザード)
│   ├── desktop/            # レコード一覧画面の Chat UI
│   │   ├── ChatPanel.tsx
│   │   ├── components/     # MessageList / Composer / Header / ConnectKintoneButton 等
│   │   ├── settings/       # Settings View (admin 専用 2-pane) — AgentsListPane / AgentDetailModal / SkillsPane / SkillAddModal / MCPPane
│   │   ├── artifacts/      # Artifact ペイン基盤
│   │   │   └── renderers/  # artifact kind 別 renderer (kintone-customize-bundle / agent-draft 等)
│   │   └── hooks/          # useSession / useUserBinding / useEventPoller / usePanelOpenState
│   ├── core/
│   │   ├── bootstrap/      # resolveAgent / resolveEnvironment / resolveSession / resolveVault + agentRecord / agentTypes (V1 で Custom Agent 永続化対応)
│   │   ├── managed-agents/ # Anthropic API client + types + event interpreter + Custom Tool runner (propose_agent)
│   │   ├── kintone/        # kintone JS API ラッパ (proxy transport, plugin config, login user)
│   │   ├── oauth/          # PKCE / popup / token exchange / credentials upsert client
│   │   ├── cloudflare/     # Worker デプロイ client + multipart 構築
│   │   ├── constants.ts
│   │   └── utils.ts        # sleep / toErrorMessage / joinUrl / buildMcpServerUrl
│   ├── skills/             # ビルトイン Skill ソース (kintone-customize-js / kintone-plugin-development)
│   │   └── <skill-name>/
│   │       ├── SKILL.md
│   │       └── resources/
│   ├── store/chatStore.ts  # Zustand
│   └── generated/          # build 時に自動生成 (worker-bundle.ts / skills-bundle.ts)
├── scripts/build.mjs       # 1 回の pnpm plugin:build で Worker bundle + Skill bundle + Plugin JS + CSS を生成
└── e2e/                    # Playwright spec 群
```

---

## 3. Cloudflare Worker (`packages/kintone-mcp`)

### 3.1 設計思想

- **完全ステートレス**: 永続ストア / 環境変数 / secret を一切持たない
- **マルチテナント**: 1 つの Worker が任意の cybozu.com / kintone.com ドメインに対応
- **小さく安全**: gzip 後 ~7 KB、外部依存ライブラリなし (Web Crypto + fetch のみ)

### 3.2 エンドポイント

| Path | Method | 認証 | 役割 |
|---|---|---|---|
| `/mcp/<domain>` | POST | `Authorization: Bearer <kintone_oauth_access_token>` | Anthropic Managed Agents から MCP HTTP transport で呼ばれる |
| `/oauth/callback` | GET | (なし) | cybozu OAuth リダイレクト中継 (postMessage で opener へ転送) |
| `/credentials/upsert` | POST | `X-Anthropic-Api-Key` + `X-Kintone-OAuth-Client-{Id,Secret}` | Anthropic Vault Credential 作成・更新の中継 |
| `/version` | GET | (なし) | build version 確認用 |
| `/healthz` | GET | (なし) | health check |
| `/debug/echo` | GET/POST | (なし) | リクエストヘッダ / body の echo (検証用、本番では削除予定) |

### 3.3 マルチテナント化の仕組み

- `/mcp/<sub>.cybozu.com` のように URL パスでドメイン指定
- Worker は domain を URL から抽出し、kintone REST API の host に使う
- Anthropic Vault Credential 作成時の `mcp_server_url` も同じ URL なので、Anthropic 側の自動マッチングが機能する

### 3.4 ビルド

- esbuild で ES module 形式のバンドルを生成 (Plugin の `scripts/build.mjs` 内)
- `--define` で `__BUILD_VERSION__` / `__BUILD_TIME__` を注入 (`/version` で返却)
- 出力された JS は `packages/plugin/src/generated/worker-bundle.ts` にテンプレートリテラル文字列として埋め込まれる

---

## 4. 認証アーキテクチャ

### 4.1 kintone OAuth (Authorization Code + PKCE)

```
1. Plugin: PKCE code_verifier / challenge / state を生成、popup で /oauth2/authorization へ
2. cybozu OAuth: ユーザー同意 → Worker /oauth/callback へリダイレクト
3. Worker /oauth/callback: postMessage で opener (Plugin) に code/state を渡す
4. Plugin: kintone proxy 経由で /oauth2/token へ POST (PKCE code_verifier 付き)
   - Authorization: Basic <client_id:client_secret> は kintone setProxyConfig 由来 (固定ヘッダ)
5. Plugin: Anthropic Vault Credential を作成 (mcp_oauth type)
   - access_token / refresh_token / refresh ブロック (token_endpoint, client_id, client_secret_basic)
6. 以降 Anthropic は MCP 呼出時に Vault から自動で access_token を取り出して Worker に Bearer で送る
   - access_token 期限切れ時は Anthropic が refresh エンドポイントを叩いて自動更新
```

詳細シーケンス: [`functional-design.md`](functional-design.md) §シーケンス図

### 4.2 認証情報の格納場所

| 値 | 格納場所 | Plugin JS から読める? | Worker に保管? |
|---|---|---|---|
| `kintone OAuth client_id` | (a) `setConfig` (公開可能) <br>(b) `setProxyConfig` 固定ヘッダ (Worker `/credentials/upsert` 用) | (a) ○ (b) × | × |
| `kintone OAuth client_secret` | `setProxyConfig` 固定ヘッダ × 2 (oauth2/token Basic auth + credentials/upsert ヘッダ) | × | × |
| `Anthropic API Key` | `setProxyConfig` 固定ヘッダ × 複数 | × | × |
| `Anthropic Vault に保管された tokens` | Anthropic Vault (暗号化、API レスポンスでも返らない) | × | × |
| `Cloudflare API Token` (デプロイ時のみ) | ConfigScreen の input ステート (保存しない) | (一時的のみ) | × |

**Worker は何の secret も静的に持たない**。すべての secret は kintone proxy 由来の固定ヘッダで都度運ばれ、リクエスト処理後にメモリから消える。

---

## 5. Anthropic Managed Agents 連携

### 5.1 リソース構成

| リソース | metadata | 数 | 識別 |
|---|---|---|---|
| Agent | `source` + `type` + `workerUrl` + `kintoneDomain` | プラグイン全体で 1 (worker URL × kintoneDomain 単位) | Default Agent |
| Environment | `source` + `purpose: 'bootstrap'` + `mcpEnabled: 'true'` | プラグイン全体で 1 | Bootstrap Env (allow_mcp_servers: true) |
| Vault | `source` + `kintoneDomain` + `kintoneUserCode` | ユーザーあたり 1 | ユーザー専用 Vault |
| Vault Credential | (Vault 内) | ユーザーあたり 1 (kintone MCP) | mcp_oauth type |
| Session | `source` + `agentId` + `kintoneDomain` + `kintoneUserCode` | ユーザーあたり 0..N | 会話単位 |

すべて metadata ベースで動的検索 (Plugin 側にリソース ID を永続化しない)。

### 5.2 API バージョン

| API | ヘッダ |
|-----|-------|
| Anthropic 基本 | `anthropic-version: 2023-06-01` |
| Managed Agents Beta | `anthropic-beta: managed-agents-2026-04-01` |

### 5.3 Agent 構成

- `mcp_servers: [{ type: 'url', name: 'kintone', url: '<worker>/mcp/<domain>' }]`
- `tools: [{ type: 'agent_toolset_20260401', ... }, { type: 'mcp_toolset', mcp_server_name: 'kintone', ... }]`
- `mcp_toolset.configs` は **配列形式** `[{name, enabled, permission_policy}]`。書き込み系は基本 `always_allow`、`kintone-delete-records` のみ `always_ask` (UI 承認 = HITL を発火させる)
- `metadata.promptVersion` を持たせ、システムプロンプトを変更したら bump して **新 Agent を強制再作成** (旧 Agent は残置、自然消滅)
- `metadata.variantGroup` で variant 系列を識別 (例: `customizer` → Sonnet / Designer の枠)。`metadata.archived` で論理削除フラグ。Custom Agent は `metadata.kind: 'custom'` を持つ
- **Custom Tool (V1 で導入)**: エージェントデザイナー variant のみ `propose_agent` を Custom Tool として登録。Plugin 側 ([core/managed-agents/](../packages/plugin/src/core/managed-agents/)) の Custom Tool runner が呼ばれると `agent-draft` artifact を生成し、artifact ペインに描画する
- **Built-in Agent 3 variant** (V1): `business` (Sonnet) / `customizer-sonnet` / `customizer-opus` (Designer に repurpose)。auto-ensure ロジックは [core/bootstrap/agentRecord.ts](../packages/plugin/src/core/bootstrap/agentRecord.ts) を参照

### 5.4 Environment 構成

- `networking.allow_mcp_servers: true` (MCP server エンドポイントへのアクセス許可)
- `allowed_hosts: []` (Plugin 経由のチャット応答には他 host 不要)

### 5.5 Vault Credential (`mcp_oauth`) 構成

```json
{
  "auth": {
    "type": "mcp_oauth",
    "mcp_server_url": "https://<worker>.workers.dev/mcp/<sub>.cybozu.com",
    "access_token": "<kintone access_token>",
    "expires_at": "<ISO 8601>",
    "refresh": {
      "refresh_token": "<kintone refresh_token>",
      "token_endpoint": "https://<sub>.cybozu.com/oauth2/token",
      "client_id": "<kintone OAuth client_id>",
      "scope": "k:app_record:read k:app_record:write ...",
      "token_endpoint_auth": {
        "type": "client_secret_basic",
        "client_secret": "<kintone OAuth client_secret>"
      }
    }
  }
}
```

期限切れ時は Anthropic が refresh エンドポイントを自動で叩く (Plugin / Worker は介在しない)。

### 5.6 Event interpreter (実 API 仕様への適応)

[eventInterpreter.ts](../packages/plugin/src/core/managed-agents/eventInterpreter.ts) は session events を UI 用の操作 (`add` 新規 / `update-tool` 更新 / `null` 無視) に変換する。実機ログとの突合で判明した API 仕様への適応箇所:

| 観測した実態 | interpreter の対応 |
|---|---|
| MCP ツールは `agent.mcp_tool_use` を発火 (組み込みツールの `agent.tool_use` とは別 type) | 両 type を **fall-through** で同一 case に |
| MCP ツール結果のリンク id は **`mcp_tool_use_id`** (組み込みは `tool_use_id`) | event.type で参照フィールドを切替 |
| 承認待ちは `session.status_idle.stop_reason.type === 'requires_action'` (docs の `tool_confirmation_required` ではない) | 両方を許容 |
| Session archive (terminated 化) は **events ストリームに流れない** | [useEventPoller](../packages/plugin/src/desktop/hooks/useEventPoller.ts) が **`retrieveSession`** で `archived_at` / `status` を別途取得して検知 |

### 5.7 Mid-session OAuth 失効の自動検知

`useEventPoller` が tool_result の errorText を `isOAuthFailureText` で解析し、kintone 側の OAuth 認証エラーパターン (`CB_OA01` / `unauthorized` / `HTTP 401` / `Cannot access protected resource` 等) を検出すると **`bindingStatus` を `'error'` に倒す**。これにより mid-session で OAuth が失効した場合に自動で「再連携」バナーが立ち上がる (F3-2)。

実在するエラーコード判定基準は [`isOAuthFailureText`](../packages/plugin/src/desktop/hooks/useEventPoller.ts) の正規表現を参照。ID 文字列 (`401_record`) や金額 (`1401`) を誤検知しないよう **語境界を細かく規定**している。

---

## 6. 通信経路

### 6.1 Plugin → Anthropic API (通常チャット)

```
Plugin → kintone proxy → api.anthropic.com (X-Api-Key 固定ヘッダ注入)
```

### 6.2 Anthropic → Worker (MCP)

```
Anthropic Managed Agents (環境) → Worker /mcp/<domain> (Authorization: Bearer 自動付与)
```

### 6.3 Worker → kintone REST API

```
Worker /mcp handler → https://<sub>.cybozu.com/k/v1/* (Authorization: Bearer をそのまま転送)
```

### 6.4 Plugin → cybozu OAuth (token 交換時)

```
Plugin → kintone proxy → https://<sub>.cybozu.com/oauth2/token
  (Authorization: Basic <client_id:client_secret> は setProxyConfig で kintone 側に固定保管)
```

### 6.5 Plugin → Worker /credentials/upsert (Vault Credential 作成・更新)

```
Plugin → kintone proxy → Worker /credentials/upsert
  (X-Anthropic-Api-Key / X-Kintone-OAuth-Client-{Id,Secret} は setProxyConfig 由来)
Worker → api.anthropic.com (受信したヘッダから body を組立てて転送)
```

### 6.6 Plugin → Cloudflare API (デプロイ時のみ、設定画面)

```
ConfigScreen → kintone.proxy() (admin が入力した API Token を直接 Authorization: Bearer に乗せる)
  → api.cloudflare.com/client/v4/accounts/{id}/workers/{...}
```

---

## 7. 制約

### 7.1 kintone 制約

| 項目 | 制約 |
|------|------|
| REST API レート | アプリあたり 100 req/sec、1 分あたり 10,000 req |
| レコード取得上限 | 1 回 500 件、カーソルで最大 30 万件 |
| `kintone.proxy` タイムアウト | 約 30 秒 |
| `kintone.proxy` レスポンスサイズ | 約 10 MB |
| `setProxyConfig` data 引数 | **フラット key-value のみ** (ネストオブジェクト不可) — `/credentials/upsert` を Worker に置く動機 |
| `setProxyConfig` 連続呼出 | 並行で叩くと DB ロック競合 (update.json 400) — 700 ms 間隔で逐次 await が必要 |

### 7.2 Anthropic Managed Agents 制約

| 項目 | 制約 |
|------|------|
| Beta API | 仕様変更の可能性 (`anthropic-beta` ヘッダ必須) |
| metadata | 最大 16 ペア / key 64 文字以下 / value 512 文字以下 |
| List API のサーバ側 metadata フィルタ | 未サポート → 全件取得 + クライアント側フィルタ |
| イベント差分取得の `since` カーソル | 未サポート → `page` トークン + 既知 ID 突合 |
| Agent の tools | 最大 128 |
| Vault Credential の immutable フィールド | `mcp_server_url` / `refresh.client_id` / `refresh.token_endpoint` |

### 7.3 Cloudflare Workers 制約

| 項目 | 制約 |
|------|------|
| CPU 時間 | 30s (有料) / 10ms (無料 — フリープランでは長時間 fetch がタイムアウト) |
| 同時接続 | 6 / IP (Worker → Anthropic / kintone) |
| 環境変数 / secret | 必要なし (本プロダクトでは使用しない) |

---

## 8. ビルド・デプロイ

### 8.1 Plugin ビルドパイプライン (`packages/plugin/scripts/build.mjs`)

1. `manifest.json` の build 番号を +1
2. **Worker JS を esbuild でバンドル** (`__BUILD_VERSION__` / `__BUILD_TIME__` 注入) → `src/generated/worker-bundle.ts` に文字列として書き出し
3. **ビルトイン Skill バンドル生成** — `src/skills/<name>/` 配下の `SKILL.md` + `resources/` + `scripts/` を zip 化し、Base64 化して `src/generated/skills-bundle.ts` に embed。Settings View の Skill 同期ボタンが呼ばれたときに Anthropic API へ POST する素材として使用
4. `desktop.js` / `config.js` を esbuild で IIFE 化 (Promise.all で並列)
5. Tailwind CSS をビルド

### 8.1.1 Custom Skill のアップロード経路

Admin が Chat Panel の Settings View → Skills タブから `.skill` zip をアップロードした場合は、Plugin がブラウザ上で zip を直接 base64 化して `POST /v1/skills` に送る (ビルトイン Skill と同じ API)。ビルド時生成された `skills-bundle.ts` は経由しない。

### 8.2 Plugin デプロイ

- ローカル: `pnpm plugin:deploy` (auto-deploy フックでも自動実行)
- 配布: GitHub Releases に zip をアップロード

### 8.3 Worker デプロイ

- 通常: **Plugin 設定画面 Step 0** からブラウザ経由で API デプロイ
- 開発: `cd packages/kintone-mcp && pnpm exec wrangler deploy`

---

## 9. テスト戦略

### 9.1 Unit Tests (vitest)

| 範囲 | 件数 | 内容 |
|---|---|---|
| Worker (`packages/kintone-mcp`) | 80 | `_http` / `kintone` (Bearer 構築) / `mcp` (URL マッチ + JSON-RPC) / `credentials-upsert` / `oauth-callback` (XSS escape) / `tools/*` (10 ツール = read 4 + write 6) |
| Plugin (`packages/plugin`) | 375+ | `core/*` (utils / oauth / cloudflare / kintone / managed-agents / bootstrap) / `desktop/*` (ChatPanel / ToolCardMessage / Banner / Composer / Markdown / hooks 群) / `config/*` / `store/*` |

### 9.2 E2E Tests (Playwright, 21 件)

| spec | 内容 |
|---|---|
| `auth.setup` | kintone ログイン |
| `credential-bind.setup` | OAuth flow を popup 自動化で完走 (idempotent / FORCE_REBIND 対応) |
| `config.spec` | 設定画面 4 ステップウィザード + Cloudflare 削除 → 再デプロイ → /version 照合 |
| `live-with-mcp.spec` | MCP 経由で kintone データ取得 |
| `live.spec` | 実 Anthropic API での応答 (3 件) |
| `panel-toggle.spec` | パネル開閉 (3 件) |
| `session-history.spec` | Session 履歴 (3 件) |
| `smoke.spec` | プラグインマウント (3 件) |

---

## 10. セキュリティ

### 10.1 secret の最小権限

- Worker: 何も保持しない (リクエスト時にヘッダで都度受領)
- Plugin: client_secret / Anthropic API Key は `setProxyConfig` 経由で kintone proxy 内部に保管 (JS から `getConfig` で読めない)
- Vault Credential: client_secret は Anthropic に 1 回だけ送り、以降は Anthropic 内で暗号化保管

### 10.2 OAuth フローの安全策

- **PKCE (S256)**: Authorization Code 横取りに対する標準的防御
- **state**: CSRF 防御 (sessionStorage に保管 + postMessage payload と照合)
- **postMessage origin 検証**: Worker URL の origin 一致を必須に
- **redirect_uri 固定**: cybozu OAuth クライアント登録時に Worker URL に固定

### 10.3 XSS / インジェクション

- チャット表示は React の JSX でエスケープ
- Worker `/oauth/callback` の HTML は escape + JSON inline は `</script>` クロス防御 (`<` 化)

---

## 11. 国際化・モバイル

- 現状: 日本語 + Desktop のみ
- モバイル対応: Phase 1c 以降で `manifest.mobile` + ChatPanel レイアウト調整

---

## 12. ライセンス

- **MIT License**
