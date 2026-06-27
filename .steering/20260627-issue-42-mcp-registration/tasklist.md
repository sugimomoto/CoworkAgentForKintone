# tasklist.md — Issue #42 追加 MCP Server 登録 + Vault Credential 管理

正本: requirements.md / design.md / docs/design-handoff/mcp-registration/。
none / bearer / OAuth すべて今回スコープ。allowed_hosts 管理は不要（`allow_mcp_servers:true`）。

## 完了済み（spec/design フェーズ）
- [x] requirements.md（Model A・3層・認証3種・OAuth 全部入り）
- [x] design.md（未決5点判断・OAuth 汎用化・handoff 反映）
- [x] design-request*.md（Claude Design 依頼）
- [x] design handoff 取り込み（docs/design-handoff/mcp-registration/、commit 67cbe9e）

---

## M1 — 基盤 + カタログ（Plugin Config 再設計）
- [ ] `core/mcp/registry.ts` 新規: handoff `mcpRegistry.ts` を移植（型 `McpServerDef`/`McpConnection`/
      `McpAttachment` + `MCP_AUTH`/`TOKEN_AUTH`/`REDIRECT_URI`/`maskedSecret`/`isHttpsUrl`/
      `needsClientSecret`/`canSaveServerDef`/`connectLabel`/`attachHeadState`）。単体テスト。
- [ ] `core/kintone/pluginConfig.ts`: `mcpServers`(JSON) の読み書きを追加。`getPluginConfig` 戻り値に
      `mcpServers: McpServerDef[]`（未設定=空配列・不正 JSON フォールバック）。テスト。
- [ ] `src/config/ConfigScreen.tsx` 2ゾーン再設計（handoff `ConfigScreen.tsx` 参照）:
  - [ ] Shell（左レール: 接続セットアップ / MCP サーバー、ステータス pill）。
  - [ ] 接続セットアップ — 未設定=ウィザード(Step0-3 既存機能維持) / 設定済み=ステータス+行インライン部分更新。
  - [ ] MCP サーバー ゾーン: 一覧 + 追加/編集/削除（`McpServerForm` 移植）。
  - [ ] 既存の極薄シャドウ等を design トーンへ。`ConfigScreen.test.tsx` 更新。
- [ ] `McpServerForm` 組込: name/url/authType(3セグ)、oauth 展開(endpoints/clientId/scope/tokenEndpointAuth)、
      basic|post 時 client_secret(伏字・再入力)、redirect_uri 読取+コピー。`canSaveServerDef` で保存活性。
- [ ] OAuth confidential 時の setProxyConfig 登録（token_endpoint + per-server upsert URL）を保存フローに追加。

## M2 — 接続 none/bearer（Settings → MCP）
- [ ] `core/managed-agents/resources.ts`: 汎用 credential upsert を整理（既存 `upsertStaticBearerCredential` を
      汎用 MCP 用に流用/改名）。list/validate(既存 `validateMcpOAuth`)/archive を per-user で使えるよう確認。
- [ ] `core/mcp/toolsList.ts` 新規: `kintone.plugin.app.proxy` 経由で JSON-RPC `tools/list` を叩くクライアント
      （bearer は Authorization 付与）。レスポンス parse + エラー処理。テスト（proxy モック）。
- [ ] `desktop/settings/` の MCP プレースホルダを `McpServersPane` 実装に置換（handoff 参照、8状態）。
  - [ ] 未接続 / bearer 入力→tools/list 疎通→per-user static_bearer upsert / 接続済(tools 一覧) /
        接続テスト / 解除(archive) / 空状態。
- [ ] `useMcpConnections` フック: カタログ × per-user credential を突合（connected/invalid/idle）。
- [ ] tools/list キャッシュをサーバー定義へ反映（最小は表示のみ）。

## M3 — 接続 OAuth（汎用 connect）
- [ ] kintone 専用フロー（`useUserBinding`/`tokenExchange`/`buildAuthorizationUrl`）から汎用部分を抽出し
      `connectMcpOAuth(def)` を実装（authorization/token endpoint, clientId, scope, redirect_uri パラメタ化）。
  - [ ] **public PKCE（token_endpoint_auth:none）を第一級**（client_secret 不要）。
  - [ ] confidential（basic/post）: token 交換は token_endpoint への proxy 注入。
- [ ] mcp_oauth credential の汎用 upsert（access+refresh+token_endpoint_auth）:
  - [ ] public → 既存 `/credentials/upsert`。
  - [ ] confidential → Worker `/credentials/upsert/{serverId}`（proxy で client_secret 注入）を追加。
- [ ] 失効/再接続導線: `validateMcpOAuth` 確定 invalid のみ「要再接続」（#124 方針）。`authDiagnostics` 観測を流用。
- [ ] OAuth 接続の `McpServersPane` 状態（認可ポップアップ→交換中）を結線（kintone connect の見た目流用）。

## M4 — attach（Agent 連携・#40 協調）
- [ ] `McpAttachSection`（handoff 参照）を AgentDetailModal 近傍に組込（attach トグル + tool ON/OFF）。
- [ ] attach 保存: agent の `mcp_servers`/`tools(mcp_toolset)` を update（`name=def.id`）。metadata に attach 済 serverId。
- [ ] `createUserSession` の `vault_ids` 収集を「attach 済サーバーの per-user credential vault」まで拡張。
- [ ] kintone と並列で追加 MCP の tool が Agent から実際に呼べることを確認（実機）。
- [ ] **依存**: #40（Agent 詳細編集）未着手。最小 attach UI を #42 側で先行 or #40 と合流（段取りは要相談）。

## 横断
- [ ] 既存 kintone / notify / useUserBinding / useSession のデグレなし（全テスト緑）。
- [ ] 型チェック / lint / vitest 全通過。
- [ ] 実機検証（none/bearer/OAuth 各 1 サーバーで接続→ツール呼び出し→解除）。
- [ ] docs-sync 判定（ユーザー向け機能追加なので docs 更新要否を確認。MCP 登録/接続は機能追加 → 反映候補）。

## 未確定（着手前に詰める）
- M4 と #40 の順序（最小先行 / 合流 / #40 先行）。
- confidential OAuth を初回から実装するか、public PKCE のみ先行するか（実装規模）。
