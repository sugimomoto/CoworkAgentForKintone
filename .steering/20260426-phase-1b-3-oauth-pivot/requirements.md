# Phase 1b-3 — Remote MCP + kintone OAuth pivot 要求定義

## 背景・前提

### Phase 1b-2 (JWT Bearer 案) からの方針転換

旧 Phase 1b-2 [.steering/20260426-phase-1b-2-mcp-jwt/](../20260426-phase-1b-2-mcp-jwt/)
は、Plugin が kintone の `login` / `password` を入力させて Worker `/mint` に渡し、
Worker が JWT に詰めて `static_bearer` Vault Credential に保管する設計だった。

実装 + デプロイまで完了したが、実環境テストで **Cloudflare WAF が cybozu.com への
Worker からのリクエスト (`X-Cybozu-Authorization` ヘッダ + Worker IP) を error 1003
"Direct IP access not allowed" で拒否する** ことが判明。User-Agent 設定 / POST +
`X-HTTP-Method-Override: GET` などのワークアラウンドはすべて失敗。Worker IP が
進行的に block される事象まで観測した。

調査の結果、cybozu.com OAuth クライアントを用いた **OAuth Bearer 認証**であれば
WAF を通過することが参考実装 ([r3-yamauchi/kintone-oauth-mcp-server-cfw](https://github.com/r3-yamauchi/kintone-oauth-mcp-server-cfw))
で確認できた。さらに Anthropic Beta API には **`auth.type = mcp_oauth` の Vault
Credential** があり、access_token / refresh_token を保管して期限切れ時の refresh も
Anthropic 内部で自動実行できる仕組みが揃っている。

これらをふまえ、本フェーズでは:

- Plugin から `login` / `password` を受け取る方式を **完全廃止**
- 代わりに **kintone OAuth Authorization Code + PKCE** で end-user 自身に認可させる
- 取得した tokens は **`mcp_oauth` Vault Credential** に保管
- Worker は kintone API を **`Authorization: Bearer <oauth_access_token>`** で叩く

### 検証で確認済の事項 (2026-04-26)

スクリプト [`scripts/verify-mcp-oauth.mjs`](../../scripts/verify-mcp-oauth.mjs) で
以下まで end-to-end 動作確認済:

1. cybozu OAuth が PKCE (S256) + `client_secret_basic` token endpoint auth をサポート
2. `mcp_oauth` Vault Credential の作成 (refresh ブロック含む) が API で可能
3. Anthropic は session の `vault_ids` から、Agent の `mcp_servers[].url` と
   一致する `mcp_server_url` を持つ Credential を自動でマッチングし、
   MCP リクエストに `Authorization: Bearer <access_token>` を付与してくる
4. Worker `/mcp` が Bearer をそのまま kintone REST API に転送 → **WAF 1003 が出ない**
5. ツール呼び出し (`kintone-get-apps`) が成功し、実環境のアプリ一覧を取得

## kintone Plugin の運用モデル (改訂)

- Plugin の **設定画面は管理者しかアクセスできない** (この前提は維持)
- 管理者 = Worker 管理者 = OAuth クライアント管理者を兼務
- 一般 end-user (kintone のユーザー) は管理者が立てた 1 つの Worker + 1 つの OAuth
  クライアントを共有
- **各 end-user は自分のブラウザで OAuth 認可フローを踏み、自分専用の Vault
  Credential に access_token / refresh_token が保管される**
- Plugin が起動時にバインディング状態を確認し、未連携なら「kintone と連携」ボタン
  を提示

## アーキテクチャ概要

```
┌────────── 管理者の責務 (Plugin 設定画面 / 一度だけ) ──────────┐
│                                                               │
│  Cloudflare Worker (1 ドメイン専用)                           │
│    KINTONE_SUBDOMAIN を vars に設定して deploy                │
│                                                               │
│  cybozu.com OAuth クライアント                                │
│    redirect_uri = <worker>/oauth/callback                     │
│    client_id / client_secret を Plugin Config に保存          │
│    setProxyConfig で /oauth2/token 用 Basic auth ヘッダ登録   │
└───────────────────────────────────────────────────────────────┘

┌────────── end-user 起動時のバインディングフロー ──────────────┐
│                                                               │
│  ① Plugin: 「kintone と連携」ボタン押下                       │
│       PKCE code_verifier / challenge / state 生成             │
│       popup で /oauth2/authorization に飛ばす                 │
│         redirect_uri = <worker>/oauth/callback                │
│                                                               │
│  ② cybozu.com: ユーザーログイン & 同意                        │
│                                                               │
│  ③ Worker /oauth/callback (popup 内)                          │
│       受け取った code/state を                                │
│       window.opener.postMessage(...) で親に転送 → 自動 close  │
│                                                               │
│  ④ Plugin (opener): postMessage 受信                          │
│       state 検証 (CSRF 防御)                                  │
│       kintone.plugin.app.proxy で /oauth2/token 呼出          │
│         (Basic auth ヘッダは setProxyConfig 由来 = client_     │
│          secret は Plugin コードに露出しない)                 │
│       grant_type=authorization_code & code_verifier 付き      │
│                                                               │
│  ⑤ Plugin: Vault Credential 作成 (mcp_oauth)                  │
│       access_token / refresh_token / refresh ブロック         │
│       (token_endpoint_auth.type = "client_secret_basic")      │
│                                                               │
│  ⑥ Plugin: chatStore に credential.id を保存                  │
│       完了後は連携済 = ボタン消えてチャット入力欄が出る       │
└───────────────────────────────────────────────────────────────┘

┌────────── 通常チャット時 ───────────────────────────────────┐
│                                                             │
│  Plugin → Anthropic Session → MCP request                   │
│            (Anthropic が vault_ids から credential を解決し  │
│             access_token を Bearer に付与)                  │
│              ↓                                              │
│         Worker /mcp                                         │
│              ↓ Authorization: Bearer <kintone_access_token> │
│         kintone REST API                                    │
└─────────────────────────────────────────────────────────────┘
```

## 機能要件

### F1. Worker (`packages/kintone-mcp`)

- **F1-1**: `/mcp` は `Authorization: Bearer <token>` を受け取り、kintone API を
  `Authorization: Bearer <token>` で叩く (透過モード)。kintone domain は env
  `KINTONE_SUBDOMAIN` から取る (1 Worker = 1 ドメイン)。
- **F1-2**: `/oauth/callback` で受信した `code` / `state` を `postMessage` で
  親ウィンドウに転送し、画面上にも可視表示する (検証スクリプトでも使えるように)。
- **F1-3**: Worker は OAuth client_secret / kintone 認証情報を持たない。WAF 観点で
  問題が発生した場合の影響を最小化するため、stateless な転送のみ。
- **F1-4**: `/mint` / JWT / `MINT_API_KEY` / `JWT_HMAC_SECRET` は完全削除。
- **F1-5**: 既存の 4 ツール (`kintone-get-apps` / `kintone-get-app` /
  `kintone-get-form-fields` / `kintone-get-records`) を維持。tool-filters の
  api_token 分岐は不要 (OAuth 一本化)。

### F2. Plugin Config 設定画面 (管理者向けウィザード UX)

cybozu OAuth クライアントは API 登録できないため、管理者が GUI で手動作成する
必要がある。Plugin Config はその手順を **段階的に案内する** ウィザード風 UX に
する。

#### F2-1. ステップ構成

設定画面は次の 3 ステップを縦に並べた 1 画面とする。各ステップは前のステップが
完了するまで disabled 表示にする。

**Step 1. Cloudflare Worker URL を入力**

- 入力欄: `Worker URL` (例: `https://cowork-agent-kintone-mcp.<account>.workers.dev`)
- ヘルパー文言: 「Cloudflare Workers にデプロイした URL を入力してください」
- 入力されると Step 2 にコールバック URL が動的に表示される

**Step 2. cybozu OAuth クライアントを登録**

このステップは **入力欄なし、案内のみ**。

表示内容:

1. **登録すべきコールバック URL を表示 + コピー用ボタン**

   ```
   <Worker URL>/oauth/callback
   ```

   - コピーボタン (`navigator.clipboard.writeText`)

2. **登録すべき スコープ** を表示 + コピー用ボタン (改行区切り or スペース区切り)

   - デフォルト推奨スコープ: `k:app_record:read` `k:app_record:write`
     `k:app_settings:read` `k:file:read`

3. **OAuth クライアント追加画面への直接リンク (新タブで開くボタン)**

   - リンク先 URL: `https://<現在の cybozu サブドメイン>/admin/integrations/oauth/list`
   - サブドメインは `kintone.getLoginUser()` 系ではなく `location.hostname`
     から取得 (Plugin が動作している kintone 環境そのもの)
   - ボタン文言: 「cybozu.com 共通管理 → OAuth クライアント追加画面を開く」

4. **手順テキスト** (折りたたみ可):
   1. 上のリンクから OAuth クライアント追加画面を開く
   2. クライアント名は任意 (例: "Cowork Agent for kintone")
   3. リダイレクト URI には ↑のコールバック URL を貼り付け
   4. スコープに ↑のスコープをすべてチェック
   5. 「追加」を押すと client_id / client_secret が表示される
   6. 表示された 2 つを次のステップに貼り付け

**Step 3. client_id / client_secret を入力して保存**

- `client_id` (text input)
- `client_secret` (password input + 表示/非表示トグル)
- (任意) `scope` (text input、デフォルト値プリセット)
- 「保存」ボタン

#### F2-2. 保存処理

保存ボタン押下時:

1. `kintone.plugin.app.setConfig` で以下を保存:
   - `workerUrl`
   - `oauthClientId`
   - `scope`
   - **`oauthClientSecret` は保存しない** (kintone setConfig は HTML 埋込みで
     一般ユーザーから可視のため秘匿不可。setProxyConfig + Worker secret で
     2 経路に分けて保管する。詳細は F2-2a / F2-2b 参照)
2. `kintone.plugin.app.setProxyConfig` で 2 つの URL に対して固定情報を登録
   (詳細は F2-2a / F2-2b)
3. 管理者は別途 `wrangler secret put KINTONE_OAUTH_CLIENT_SECRET` で同じ
   client_secret を Worker secret にも保存する必要がある (詳細は F2-2c)
4. 設定済みフラグ (`saved: true`) を setConfig に保存し、再表示時に「設定済み /
   再登録」状態を見分ける

#### F2-2a. setProxyConfig: kintone OAuth `/oauth2/token` 用

token 交換 (authorization code → tokens) と Anthropic 自動 refresh 時のために
client_secret を Basic 認証ヘッダで注入。

- URL: `new URL('/oauth2/token', location.origin).toString()` (現在の cybozu サブドメイン基準)
- method: `POST`
- 固定ヘッダ:
  ```
  Authorization: Basic <base64(client_id:client_secret)>
  Content-Type: application/x-www-form-urlencoded
  ```

#### F2-2b. setProxyConfig: Worker `/credentials/upsert` 用

Anthropic Vault Credential 作成・更新を Worker 経由で行う。Worker 自体は秘密
情報を保持せず、必要な値はすべて kintone proxy がフラットヘッダで注入する。

- URL: `<workerUrl>/credentials/upsert`
- method: `POST`
- 固定ヘッダ:
  ```
  X-Anthropic-Api-Key: <ANTHROPIC_API_KEY>
  X-Kintone-OAuth-Client-Id: <kintone OAuth client_id>
  X-Kintone-OAuth-Client-Secret: <kintone OAuth client_secret>
  Content-Type: application/json
  ```
- 固定 body data: 不要

> 3 つのヘッダはすべて kintone setProxyConfig に登録される (= Plugin の JS コード
> や setConfig HTML には一切露出しない)。Worker はリクエスト到来時に header から
> 取り出して Anthropic API body に詰めるのみ。Worker secret / Worker vars に
> client_id / client_secret は **保持しない**。

#### F2-2c. Worker の env / secret (簡素化)

Worker が必要とするのは `KINTONE_SUBDOMAIN` (`[vars]`) のみ。`KINTONE_OAUTH_CLIENT_SECRET`
等の Worker secret は **不要** (リクエスト毎にヘッダ経由で渡るため)。

> Worker setup の admin 手順は `wrangler deploy` 1 回のみ (secret 設定不要)。
> Plugin Config からも Worker secret 関連の案内は削除する。

#### F2-3. 再表示・再設定

- 既存設定がある状態で開いた場合は、各ステップに保存値を埋めて表示
  - `oauthClientSecret` は復元しない (一度も画面に表示されない、二度と表示できない)
  - 再保存時は client_id / client_secret 両方の再入力を要求 (proxy ヘッダ更新のため)
- 「OAuth クライアントを変更したい」ケースに対応するため、Step 3 の入力は常に
  編集可能にする

#### F2-4. 廃止項目

- 旧 `MINT_API_KEY` 入力欄は削除
- 旧 Worker JWT 関連の説明文も削除

### F3. Plugin 起動時バインディング判定

- **F3-1**: chatStore に保存済の `credentialId` を Anthropic API で取得し、未 archive
  なら "bound" 状態。
- **F3-2**: 未バインド時は「kintone と連携」ボタンを表示。WelcomeMessage に文言追加。
- **F3-3**: 旧 `CredentialDialog` (login/password 入力) を完全削除。

### F4. Plugin OAuth 連携フロー

- **F4-1**: ボタン押下で:
  - PKCE `code_verifier` (32 bytes random, base64url) と `code_challenge` (S256) 生成
  - `state` (16 bytes random, base64url) 生成
  - 2 つを sessionStorage に保存
  - popup で `<authorization_url>?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...&code_challenge=...&code_challenge_method=S256` を開く
- **F4-2**: `window.addEventListener('message', ...)` で popup からの postMessage を
  受信:
  - `event.origin` が Worker URL の origin と一致するかを検証
  - payload の `state` が sessionStorage 値と一致するかを検証
  - 不一致なら無視
- **F4-3**: 検証成功で `kintone.plugin.app.proxy` を介して `/oauth2/token` を
  POST `application/x-www-form-urlencoded`:
  - body: `grant_type=authorization_code&code=...&redirect_uri=...&code_verifier=...`
  - Basic auth ヘッダは setProxyConfig 由来
- **F4-4**: 取得した `access_token` / `refresh_token` / `expires_in` を使い、
  Anthropic に Vault Credential を作成 (`auth.type = mcp_oauth`):
  - `mcp_server_url = <worker>/mcp`
  - `expires_at` = ISO timestamp (now + expires_in)
  - `refresh.refresh_token` / `token_endpoint` / `client_id` / `scope`
  - `refresh.token_endpoint_auth.type = "client_secret_basic"` +
    `client_secret` (Plugin コードに渡す唯一のタイミング、Vault に保存される)
- **F4-5**: 失敗時はトースト等でユーザーに通知し、最初からやり直せる。

### F5. Anthropic 連携 (Agent + Session 構成)

- **F5-1**: Agent 作成時、`mcp_servers` に Worker `/mcp` を `{ name: "kintone",
  type: "url", url: ... }` で登録、`tools` に `mcp_toolset (mcp_server_name: "kintone",
  default_config: { enabled: true, permission_policy: { type: "always_allow" } })`
  を追加。
- **F5-2**: Session 作成時、`environment_id` (既存 bootstrap Env) と
  `vault_ids: [vaultId]` を渡す。
- **F5-3**: 既存の chatStore.credentialId に対応する Vault は 1 つに集約 (vaultId
  も chatStore に保持)。

### F6. テスト・回帰

- **F6-1**: 既存の Plugin unit tests (238 件) のうち、login/password / JWT /
  CredentialDialog 関連は廃止 or 書き換え。
- **F6-2**: Worker tests は OAuth Bearer 透過モードの最低限を再構築 (現在は
  `tests.disabled.phase1b3` に退避中)。最低でも `/mcp` の認証分岐 (Bearer 無し →
  401, Bearer 有り → kintone へ転送) と `/oauth/callback` のレンダリングをカバー。
- **F6-3**: E2E setup spec (旧 JWT 用) は OAuth フローへ書き換え。または「OAuth
  flow は手動操作必須なので E2E 自動化からは外す」方針に切替。

## 非機能要件

- **NFR1**: client_secret は Plugin の JS バンドルに含まれない (Plugin Config に
  保存されるだけで、JS からは読めるが setProxyConfig 経由で kintone API 経由に
  なるため、proxy ヘッダとして外部送信される時に kintone がインジェクト)。
  → Phase 1b-2 と比べて、kintone proxy が **ヘッダ固定値の保護に setConfig は
  使わず setProxyConfig のヘッダ機構を使う** ところが新規。
- **NFR2**: Worker は依然として 1 cybozu ドメインに閉じる。複数ドメイン対応は
  別フェーズ。
- **NFR3**: state / code_verifier は sessionStorage で OK (popup 寿命のみ有効、
  ブラウザ閉じれば消える)。
- **NFR4**: redirect_uri 変更時は Worker URL もろとも管理者が再設定する想定
  (運用上は固定値)。

## スコープ外

- 複数 cybozu ドメインのサポート
- OAuth scope の動的調整 (Plugin 設定画面でユーザー入力できるが UI 編集体験は
  最小限)
- Token rotation / Vault Credential の再連携 UX 改善 (refresh 失敗時のリカバリ等)
  → Anthropic 自動 refresh が動かなくなったケースは「再連携してください」案内で OK
- E2E でブラウザ操作を伴う OAuth 自動化 (今フェーズでは手動検証で OK)

## 完了条件

- [ ] Plugin Config 画面で Worker URL + kintone OAuth client 情報を入力・保存できる
- [ ] チャットパネルから「kintone と連携」フローを完走でき、Vault Credential が作成される
- [ ] チャットメッセージを送ると Anthropic 経由で Worker `/mcp` が呼ばれ、
      kintone のデータが返ってくる
- [ ] アプリリロード後も Vault Credential が有効な間は再認可なしで動作する
- [ ] access_token 期限切れ後 (≥1h 待機) も Anthropic 自動 refresh で動作継続
- [ ] 既存 unit tests / typecheck / E2E の中で本フェーズに関係する範囲が green
