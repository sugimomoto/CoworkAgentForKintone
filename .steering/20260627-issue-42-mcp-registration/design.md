# design.md — Issue #42 追加 MCP Server 登録 + Vault Credential 管理

Model A（admin がカタログ定義 / ユーザーは接続）。kintone の仕組みを一般化する。
none / bearer / **OAuth すべて今回のスコープ**（一括実装）。

## 未決事項の判断（requirements の 1〜5）
1. **OAuth 汎用化の経路**（今回スコープ・決定）:
   - **主モデル = confidential `client_secret_basic`（client_secret を Plugin Config 保持）＝ kintone 方式の一般化**。
     admin が server ごとに client_id + client_secret を Plugin Config に登録し、secret はブラウザに出さず
     kintone proxy 経由で注入する（既存 kintone OAuth の実証済みパターンをサーバー数ぶんに拡張）。
   - **token 交換はプラグインが実施**（kintone.proxy 経由で token_endpoint を叩く）。Vault は交換しない
     （API は access_token 必須）。以降の refresh のみ Vault が自動（#124 実証）。
   - **secret の per-server 注入（唯一の新規増分）**: 対象が N 個になるため URL で secret を区別する:
     (a) token 交換用＝各サーバーの **token_endpoint** への setProxyConfig（Basic 注入）、
     (b) Vault refresh 用＝Worker に **per-server upsert URL** `/credentials/upsert/{serverId}` を追加し、
     その URL 限定の proxy header で secret を Worker に渡して `auth.refresh.token_endpoint_auth.client_secret` に積む。
   - **public（secret 不要）= `token_endpoint_auth: none`** は「client_secret 空欄」として**同じフローで自然に吸収**（おまけ）。
   - **`post` は対象外**（kintone proxy がボディ注入不可。`basic` のみ＝kintone と同じ）。
2. **allowed_hosts は管理不要** → 仕様確認の結果、MCP エンドポイントへの接続は `allow_mcp_servers: true`
   で許可される（`allowed_hosts` は *container（コード実行）の一般 egress* 用で MCP とは別系統）。
   実証: 現状 `allowed_hosts: []` でも kintone MCP は動作。よって **MCP を agent の `mcp_servers` に
   紐づける + `allow_mcp_servers: true`（既存環境で設定済）だけで十分**。host 和集合管理・updateEnvironment
   は不要。
3. **サーバー定義の保存先** → **Plugin Config** に `mcpServers`(JSON 文字列) を追加。admin 編集・テナント共有。
4. **tools/list 取得元** → **kintone.plugin.app.proxy 経由**で MCP URL に JSON-RPC `tools/list` を POST。
   接続時に取得し、結果（tool 名/説明）を**サーバー定義にキャッシュ**（全ユーザー共通の属性のため）。
5. **kintone/notify を新機構へ寄せるか** → 寄せない（互換維持優先）。新機構は追加 MCP 専用。

## データモデル
### サーバー定義（テナント / Plugin Config）
```ts
type McpAuthType = 'none' | 'bearer' | 'oauth';
interface McpServerDef {
  id: string;            // 安定 slug。agent の mcp_server_name に使う（kintone/notify と衝突しない）
  name: string;          // 表示名
  url: string;           // MCP エンドポイント（https）
  authType: McpAuthType;
  tools?: { name: string; description?: string }[]; // tools/list キャッシュ
  // oauth のみ（client_secret は config に保存しない＝ proxy 注入）
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId?: string;
  scope?: string;
  tokenEndpointAuthType?: 'none' | 'basic' | 'post'; // none=PKCE public(secret不要), basic/post=confidential
}
```
- Plugin Config キー `mcpServers` に `JSON.stringify(McpServerDef[])` で保存。
- `getPluginConfig` を拡張して `mcpServers: McpServerDef[]` を返す（現行 workerUrl/oauthClientId と並列）。

### 認証情報（per-user / Vault）
- 既存の **per-user Vault**（`resolveUserVault`）に、`mcp_server_url = McpServerDef.url` で credential を作る
  （1 vault×1url=1 credential の既存制約に合致）。
- bearer → `static_bearer`（token = ユーザーが入力した API キー、`Authorization: Bearer` 注入）。
  既存 `upsertStaticBearerCredential` を流用（notify は webhook URL だったが、ここでは API キー）。
- oauth → `mcp_oauth`（access/refresh, Phase 2）。`upsertKintoneCredential` を汎用化した関数を使う。
- 接続状態は `mcp_oauth_validate`（#124 で追加）/ credential 存在で判定。解除は `archiveVaultCredential`。

### attach（per-agent / #40）
- Agent の `mcp_servers` に `{type:'url', name: def.id, url: def.url}` を追加、`tools` に
  `{type:'mcp_toolset', mcp_server_name: def.id, default_config, configs:[tool ON/OFF]}` を追加。
- Agent metadata に attach 済 serverId 群を記録（drift 再計算/表示用、#86 の reconcile に倣う）。

## 環境 networking（管理不要）
- MCP 接続は `allow_mcp_servers: true`（既存 `resolveBootstrapEnvironment` で設定済）で許可される。
  追加 MCP のために `allowed_hosts` を触る必要はない。`updateEnvironment` も本 Issue では不要。
- 念のため: 既存環境が `allow_mcp_servers: true` であることだけ前提として確認する（変更は不要）。

## サーフェス別の実装
### A. Plugin Config（admin・テナント定義）
- `desktop/config/` に「MCP Server」セクション追加: 一覧 + 追加/編集/削除フォーム。
  - 入力: name, url, authType。OAuth 時は authorization/token endpoint, clientId, scope, client_secret。
  - 保存: `mcpServers`(JSON) を setConfig。
  - OAuth の client_secret と（Phase 2）per-server upsert/token endpoint の proxy 設定を setProxyConfig 登録。
  - 保存時に allowed_hosts 同期をトリガ。

### B. Chat Panel Settings → MCP（per-user・接続/解除）
- `desktop/settings/` の `MCPPanePlaceholder` を実装に置換（admin 専用 2-pane 内、ただし**接続操作は本人**）。
  - テナント定義済サーバー一覧（name/url/authType）+ 本人の接続状態（接続済/未接続）。
  - 「接続」: bearer=トークン入力モーダル → proxy 経由で tools/list 検証 → per-user Vault に static_bearer upsert。
    oauth=認可フロー（Phase 2）。
  - 「接続テスト」: tools/list を取得し公開ツールを表示（+ サーバー定義の tools キャッシュ更新）。
  - 「解除」: 当該 credential を archive。
- 新フック `useMcpConnections`（一覧×本人 credential の突合）。`resources.ts` の list/validate/archive を利用。

### C. Agent 詳細編集（#40 連動・最小）
- attach/detach UI（登録済サーバーの ON/OFF）+ tool ON-OFF。
- 保存で agent の mcp_servers/tools を update。（session 作成時に per-user Vault を `vault_ids` へ含める
  — 既存 `createUserSession` の vault_ids 収集を「attach 済サーバーの credential」まで拡張）。environment は触らない。

## tools/list 取得（kintone.proxy 経由）
```
POST <mcp url>  (JSON-RPC) { method: 'tools/list' }
  headers: bearer 時 Authorization: Bearer <user token>
```
- 接続直後（token が手元にある間）に呼ぶ。CORS 回避のため kintone.plugin.app.proxy を使用。
- 結果を Settings に表示 + サーバー定義の `tools` にキャッシュ（admin 環境に書き戻しは別途・最小は表示のみ）。

## OAuth（mcp_oauth）汎用 connect — 今回スコープ
kintone 専用の `useUserBinding` / `tokenExchange` / `buildAuthorizationUrl` を、`McpServerDef` で
パラメタライズした汎用 connect フック `connectMcpOAuth(def)` へ抽出する（kintone はリスク回避のため当面据え置き、
将来この汎用機構へ寄せられる形にする）。

フロー（per-user、Settings の「接続」から）:
1. `generatePkce()` → authorization URL を組立（`authorizationEndpoint` + client_id + redirect_uri + scope
   + state + code_challenge）。`openOAuthPopup()` で code 取得（Worker `/oauth/callback` を共用＝汎用なので流用可）。
2. **token 交換**: `tokenEndpoint` に grant_type=authorization_code, code, redirect_uri, code_verifier を POST。
   client 認証は def.tokenEndpointAuthType により分岐: `none`→ 無し / `basic`→ Authorization Basic / `post`→ body。
   confidential の secret はプラグインに持たせず **token_endpoint への setProxyConfig** が注入（kintone と同方式）。
3. **Vault upsert（mcp_oauth）**: access_token + expires_at + `refresh{refresh_token, token_endpoint,
   token_endpoint_auth, client_id, scope}` を per-user Vault に作成。
   - public(none): 既存 `/credentials/upsert` で OK（secret 不要）。
   - confidential: **per-server upsert URL** `/credentials/upsert/{serverId}` 経由（proxy が client_secret を注入）。
4. 以降の refresh は Vault が自動。失効検知/再認可は **#124 の知見**（`mcp_oauth_validate` ゲートで過剰再認可を回避、
   `window.__coworkAuthLog` 観測）を最初から踏襲。

redirect_uri は Worker `/oauth/callback` を共用（admin が third-party OAuth アプリにこの URL を登録）。

## Worker への追加
- none/bearer/OAuth(public): 既存 `/credentials/upsert`（static_bearer / mcp_oauth 対応済）で足りる。
- OAuth(confidential): `/credentials/upsert/{serverId}`（URL 限定 proxy header で client_secret を注入）+
  必要なら汎用 token 交換の中継。public PKCE のみ対応なら不要。

## 影響範囲 / 非デグレ
- 既存 kintone/notify の bootstrap・session・credential 経路は不変（新機構は追加経路）。
- getPluginConfig の戻り値拡張は後方互換（mcpServers 未設定なら空配列）。

## テスト方針
- pluginConfig: mcpServers の parse/serialize（不正 JSON フォールバック）。
- resources: updateEnvironment / listVaultCredentials / archive の単体（既存パターン）。
- useMcpConnections: 定義×credential の突合（接続済/未接続/解除）。
- tools/list parse、bearer 接続→credential 作成→解除の一連（proxy をモック）。
- 既存 useUserBinding/useSession のデグレなし。

## マイルストーン（すべて今回スコープ）
- **M1 基盤**: pluginConfig 拡張（`mcpServers`）+ サーバー定義 CRUD(Plugin Config)。（環境更新は不要）
- **M2 接続(none/bearer)**: Settings → MCP 一覧/接続/tools-list/解除 + useMcpConnections + per-user Vault(static_bearer)。
- **M3 接続(OAuth)**: `connectMcpOAuth(def)` 汎用フロー（public PKCE 優先 / confidential は proxy 注入）+ mcp_oauth upsert。
- **M4 attach**: Agent attach/detach + session vault_ids 拡張（#40 と協調）。

---

## handoff 反映（2026-06-28・docs/design-handoff/mcp-registration/ 取り込み後）
Claude Design 成果物を正とし、以下を確定:

### 型・ヘルパーの正本 = `mcpRegistry.ts`
- `McpServerDef`（カタログ）/ `McpConnection`（per-user 接続状態: idle|connected|invalid 等）/
  `McpAttachment`（agent ごと {serverId, enabledTools[]}）。
- ヘルパー: `MCP_AUTH` / `TOKEN_AUTH` / `REDIRECT_URI` / `maskedSecret` / `isHttpsUrl` /
  `needsClientSecret` / `canSaveServerDef` / `connectLabel` / `attachHeadState`。
- 実装はこの型を移植して使う（design.md の暫定型はこれに置換）。

### Surface A は ConfigScreen **全面再設計**（スコープ増・要計画反映）
- 当初の「pluginConfig 拡張だけ」ではなく、`ConfigScreen` を **2 ゾーン左レール**へ刷新:
  - 接続セットアップ: 未設定=ウィザード(Step0-3) / 設定済み=ステータス+行インライン部分更新。
  - MCP サーバー: 常時 CRUD ゾーン（`McpServerForm` + 一覧）。
- 既存機能（Cloudflare デプロイ / Worker URL / Anthropic Key / cybozu OAuth 案内 / kintone client）は維持しつつ hifi 化。
- 参照: handoff `ConfigScreen.tsx`（`Shell`/`ConfigSetupWizard`/`ConfigStatusView`/`StatusRow`）。

### コンポーネント対応（handoff → 実装）
| handoff 参照 | 組込先 |
|---|---|
| `mcpRegistry.ts` | `packages/plugin/src/core/mcp/registry.ts`（新規・型/ヘルパ） |
| `McpServerForm.tsx` + `ConfigScreen.tsx` | `src/config/` の ConfigScreen 刷新（A） |
| `McpServersPane.tsx` | `src/desktop/settings/` の MCP プレースホルダ置換（B） |
| `McpAttachSection.tsx` | `src/desktop/`（AgentDetailModal 近傍, C / #40 協調） |

### バックエンド/配線（handoff には無い・実装側）
- カタログ保存: Plugin Config `mcpServers`(JSON) + getPluginConfig 拡張。OAuth secret / token endpoint /
  per-server upsert は setProxyConfig 登録（confidential 時）。
- per-user 接続: `resolveUserVault` に `mcp_server_url=def.url` で credential 作成
  （bearer→static_bearer 既存流用 / oauth→汎用 mcp_oauth upsert）。解除=archive。状態=`validateMcpOAuth`(既存)。
- tools/list: `kintone.plugin.app.proxy` 経由で接続時取得 → サーバー定義にキャッシュ。
- attach: agent の `mcp_servers`/`tools` 更新 + session `vault_ids` に attach 済サーバーの credential を含める。
- allowed_hosts: 不要（`allow_mcp_servers:true`）。

### 更新後マイルストーン
- **M1 基盤+カタログ**: registry.ts 移植 + pluginConfig 拡張 + **ConfigScreen 2ゾーン再設計**(A)。
- **M2 接続(none/bearer)**: McpServersPane(B) 組込 + per-user Vault(static_bearer) + tools/list + 解除。
- **M3 接続(OAuth)**: 汎用 connectMcpOAuth + mcp_oauth upsert（public PKCE 優先 / confidential proxy 注入）。
- **M4 attach**: McpAttachSection(C) + agent mcp_servers/tools 更新 + session vault_ids 拡張（#40 協調）。
