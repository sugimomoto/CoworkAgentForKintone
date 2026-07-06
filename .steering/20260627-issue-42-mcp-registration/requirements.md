# requirements.md — Issue #42 追加 MCP Server 登録 + Vault Credential 管理

## 対象 Issue
- #42 (enhancement, size: L, target:customizer, tier:1-wedge) / 親 #44, #9 / 連動 #40, #17

## ゴール
ユーザーが必要とするリモート MCP を**柔軟に追加**できるようにする。kintone MCP に並列して、
任意の MCP Server を登録し、エージェントから tool を呼べる状態を作る。

## 基本モデル（合意済み — kintone の仕組みを N サーバーに一般化）
3 つの責務に分離する:

| 層 | 何を持つか | スコープ | 置き場 |
|---|---|---|---|
| **① サーバー定義** | name / URL / 認証方式 /（OAuth時）authorization_endpoint・token_endpoint・client_id・**client_secret**・scope | **テナント共有**（admin が設定） | **Plugin Config**（client_secret は kintone proxy 同様 setProxyConfig で秘匿） |
| **② 認証情報 (credential)** | 各ユーザーの access/refresh token（OAuth）or 各自の API キー（bearer） | **per-user** | **Chat Panel Settings → MCP**（接続・状態表示・**解除**） + per-user Vault |
| **③ attach** | どのエージェントでそのツールを使うか / tool ON-OFF | テナント共有の登録 + Agent 個別 | **Agent 詳細編集（#40）** |

> これは現状の kintone（client_id/secret は Plugin Config = テナント共有 / OAuth 認可は各ユーザー /
> ツールは Agent toolset）を、複数サーバーに拡張したもの。

## 合意した設計決定（AskUserQuestion）
- **登録者/スコープ**: 各ユーザーが自分用に認証情報を持つ（per-user credential / per-user Vault）。
  サーバー定義自体はテナント共有（admin が Plugin Config で定義）。
- **認証方式**: `none` / `static_bearer`(API キー) / `mcp_oauth`(OAuth, kintone と同じ confidential client_secret_basic + 自動 refresh) の3種を対象。
- **attach**: 登録はテナント全体で可視 → 各エージェントで個別 ON/OFF（#40 連動）。
- **UI 配置**: サーバー定義+secret は Plugin Config、認証/認可と解除の管理は Settings。

## 技術的に確定した前提（調査済）
- **allowed_hosts の管理は不要**: MCP 接続は `allow_mcp_servers: true` で許可される（`allowed_hosts` は
  container のコード実行 egress 用で MCP とは別系統）。実証: 現状 `allowed_hosts: []` でも kintone MCP は動作。
  → 追加 MCP は agent の `mcp_servers` 紐付けだけで到達可能。環境更新は不要。
- **Vault credential は任意サーバーの OAuth refresh を保持可能**（`auth.refresh{refresh_token,
  token_endpoint, token_endpoint_auth(client_secret_basic|post), scope}`）。kintone と同形。
- **Anthropic は `mcp_server_url` 一致で credential を自動注入**（session の `vault_ids` 経由）。
- **既存テンプレ**: notify(#13) が「2つ目の MCP を static_bearer + Vault + agent attach」する実装雛形。

## スコープ（やること）
### Plugin Config（admin・テナント共有のサーバー定義）
- MCP Server 定義の追加/編集/削除フォーム: name, URL, authType(none|bearer|oauth)。
- OAuth 時: authorization_endpoint, token_endpoint, client_id, scope, redirect_uri、
  および client_secret（token endpoint への proxy 経由注入＝ kintone と同様 setProxyConfig 登録）。
- 定義一覧は Plugin Config 内に保存（config schema を `mcpServers: [...]` で拡張）。

### Chat Panel Settings → MCP（per-user・認証/認可管理）
- テナントに定義済みの MCP Server 一覧を表示（接続済/未接続の状態つき）。
- 各サーバーに対し本人が「接続」: OAuth=認可フロー / bearer=トークン入力 → per-user Vault に credential 作成。
- 接続テスト（`tools/list` 取得）/ 公開ツール一覧表示 / **解除**（Vault credential を archive）。
- mcp_oauth_validate を使った接続状態の確認（#124 で追加済の検証経路を再利用）。

### Agent 詳細編集（既存 AgentDetailModal に差し込む・#40 依存は解消済み）
- 登録済 MCP Server を Agent に attach/detach、tool ごとの ON-OFF。
- attach 時に Agent の `mcp_servers` と `tools(mcp_toolset)` を更新、
  session 作成時に当該 Vault を `vault_ids` に含める（allowed_hosts 操作は不要）。

## スコープ: none / bearer / OAuth すべて今回の実装に含める
（ユーザー指示により OAuth も今回スコープ。フェーズ分割はせず一括実装する。）

実装順序の目安（依存順。すべて本 Issue の成果物）:
1. 基盤: サーバー定義(Plugin Config) + getPluginConfig 拡張。
2. 接続(none/bearer): Settings 一覧/接続/tools-list/解除 + per-user Vault(static_bearer)。
3. 接続(OAuth): 汎用 OAuth connect（kintone 専用フローを McpServerDef でパラメタライズ）。
   - **confidential `client_secret_basic`（client_secret を Plugin Config 保持・proxy 注入）を主**＝ kintone 方式の一般化。
   - public (`token_endpoint_auth: none`) は client_secret 空欄で同フロー吸収（おまけ）。`post` は対象外。
   - 初回 token 交換はプラグインが実施（Vault は交換しない）。以降の refresh は Vault が自動（#124 実証）。
4. attach: 既存 AgentDetailModal に McpAttachSection を差込 + session vault_ids 拡張（#40 依存は解消済み）。

> 補足: Vault credential 作成 API は `access_token` 必須 + `refresh{refresh_token, token_endpoint,
> token_endpoint_auth, client_id, scope}`。token 交換は client 側、refresh のみ platform 自動。

## 受け入れ条件
- [ ] Plugin Config で MCP Server 定義（name/URL/authType, OAuth は endpoints+client）を追加/編集/削除できる
- [ ] Settings → MCP に定義済サーバー一覧 + 本人の接続状態が出る
- [ ] bearer: 各ユーザーがトークンを入力 → 接続でき、解除もできる
- [ ] OAuth: 各ユーザーが認可フローで接続でき、access_token 失効後も自動 refresh で継続（#124 の知見）
- [ ] 接続テスト/tools 一覧（`tools/list`）が表示される
- [ ] Agent 編集で attach ON/OFF・tool ON-OFF ができ、kintone と並列で追加 MCP の tool が呼べる
- [ ] 追加 MCP が attach + `allow_mcp_servers:true` だけでツール呼び出しに成功する（allowed_hosts 操作なし）
- [ ] 既存 kintone / notify 連携にデグレなし

## スコープ外（今回）
- MCP-spec 準拠の OAuth 自動ディスカバリ（WWW-Authenticate / RFC8414 / dynamic client registration）。
  v1 は admin が endpoints/client を明示設定する方式とする（自動ディスカバリは将来検討）。
- 1 ユーザーが任意 URL を自由登録（サーバー定義は admin がテナントで管理。ユーザーは「接続」のみ）。
- GitHub 連携(#17) の具体ツール実装（本 Issue は基盤。#17 が最初の利用インスタンス）。

## 主要論点の決着（すべて design / point1・2 で確定済み）
1. **OAuth 汎用化の Worker 経路** → ✅ 決定: confidential `client_secret_basic`（client_secret を Plugin Config 保持）。
   per-server に setProxyConfig 登録（token_endpoint への Basic 注入 + Worker `/credentials/upsert/{serverId}` への注入）。
   public は `token_endpoint_auth:none` で同フロー吸収、`post` は対象外。（design 未決#1 / point2）
2. **環境 allowed_hosts** → ✅ 不要: MCP 接続は `allow_mcp_servers:true` で許可（allowed_hosts は container egress 用）。
   競合管理・updateEnvironment は不要。（design 未決#2）
3. **サーバー定義の保存先** → ✅ Plugin Config の `mcpServers`(JSON)。getPluginConfig 拡張。（design 未決#3）
4. **tools/list の取得元** → ✅ `kintone.plugin.app.proxy` 経由で接続時取得 + サーバー定義にキャッシュ。（design 未決#4）
5. **kintone/notify を新機構に寄せるか** → ✅ 寄せない（互換維持・新機構は追加 MCP 専用）。（design 未決#5）
6. **M4 と #40 の順序** → ✅ 解消: AgentDetailModal は編集可能で実装済み。McpAttachSection を差し込むだけ。（point1）

→ 着手前に詰めるべき未決事項は無し。M1 から実装可能。
