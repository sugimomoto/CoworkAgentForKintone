# Phase 1b-3 — OAuth pivot タスクリスト

TDD ベースで進める。各タスクは「テスト → 実装 → green」サイクル。Worker 側 →
Plugin core (依存ライブラリ的な部分) → Plugin UI → 統合 (E2E) の順。

凡例:
- [ ] 未着手 / [x] 完了
- 🧪 = テストコード / 🛠 = 実装 / 🧹 = 削除 or リネーム / 📝 = ドキュメント / 🚀 = デプロイ系

---

## W. Worker 側 (`packages/kintone-mcp`)

### W1. 既存コード整理 (Bearer 透過モードへの移行は完了済)

- [x] 🧹 `src/jwt.ts` 削除
- [x] 🧹 `src/mint.ts` 削除
- [x] 🧹 `src/server/tool-filters.ts` 削除
- [x] 🧹 `tests/` を `tests.disabled.phase1b3/` に退避
- [x] 🛠 `src/kintone.ts` を OAuth Bearer ヘッダ専用に書き換え
- [x] 🛠 `src/mcp.ts` を Bearer 透過 + ヘッダログに変更
- [x] 🛠 `src/index.ts` を `/oauth/callback` ルート追加
- [x] 🛠 `wrangler.toml` を `KINTONE_SUBDOMAIN` vars 化
- [x] 🛠 `src/oauth-callback.ts` 新規追加
- [ ] 🧹 `tests.disabled.phase1b3/` 削除 (新テスト群が出揃ってから)

### W2. Worker テスト再構築 (新仕様)

- [ ] 🧪 `tests/kintone.test.ts`: KintoneCreds = { domain, bearer }、buildHeaders で `Authorization: Bearer` が付くこと
- [ ] 🧪 `tests/mcp.test.ts`:
  - [ ] Bearer 無し → 401
  - [ ] Bearer 有り + initialize → serverInfo を返す
  - [ ] Bearer 有り + tools/list → 4 ツールが揃う
  - [ ] Bearer 有り + tools/call → kintoneRequest がモックで呼ばれる
- [ ] 🧪 `tests/oauth-callback.test.ts`:
  - [ ] code/state クエリ → HTML に値が埋め込まれる (XSS 対策の escape も検証)
  - [ ] postMessage 用 inline script に payload が出る
  - [ ] error クエリ → エラー表示分岐
- [ ] 🧪 `tests/tools/factory.test.ts`: 新 KintoneCreds 型に合わせて update
- [ ] 🧪 `tests/tools/kintone-tools.test.ts`: 同上
- [ ] 🧪 `tests/tools/build-query.test.ts`: 既存維持で OK (creds 非依存)

### W3. Worker `/credentials/upsert` 実装 (TDD)

- [ ] 🧪 `tests/credentials-upsert.test.ts` を先に書く:
  - [ ] X-Anthropic-Api-Key ヘッダ無し → 401
  - [ ] body 不正 (vaultId 欠損) → 400
  - [ ] credentialId 無し + refreshToken 有 + X-Kintone-OAuth-Client-Secret 無し → 400
  - [ ] credentialId 無し → Anthropic に POST /v1/vaults/{vaultId}/credentials が呼ばれる
    - body のネスト (`auth.refresh.token_endpoint_auth.client_secret`) が正しく組まれる
    - X-Api-Key ヘッダが Anthropic 呼出に転載される
  - [ ] credentialId 有り → Anthropic に POST /v1/vaults/{vaultId}/credentials/{credentialId} が呼ばれる
    - body に client_secret / client_id / token_endpoint が **含まれない**
  - [ ] Anthropic 200 → `{ credential_id, vault_id }` を返す
  - [ ] Anthropic 4xx/5xx → そのまま転載
- [ ] 🛠 `src/credentials-upsert.ts` を実装
- [ ] 🛠 `src/index.ts` のルータに `/credentials/upsert` 追加
- [ ] 🛠 typecheck pass

### W4. Worker デプロイ + smoke

- [ ] 🚀 `wrangler deploy`
- [ ] 🧪 curl で `/credentials/upsert` smoke (X-Anthropic-Api-Key 無し → 401)

---

## P0. Plugin 共通基盤の整理

### P0-1. 旧コード削除

- [ ] 🧹 `packages/plugin/src/core/mcp/mintClient.ts` + テスト削除
- [ ] 🧹 `packages/plugin/src/desktop/components/CredentialDialog.tsx` + テスト削除
- [ ] 🧹 `packages/plugin/src/core/bootstrap/ensureEnvironment.ts` (旧 user environment) があれば削除確認

### P0-2. types / store 拡張

- [ ] 🧪 `core/managed-agents/types.ts`: `VaultCredentialAuthMcpOAuth` 型追加 (test ファイル無し、コンパイラ検証のみ)
- [ ] 🧪 `store/chatStore.test.ts`: vaultId フィールドの set/get、ユーザーコードでネームスペース分離
- [ ] 🛠 `store/chatStore.ts`: vaultId フィールド + setter、persist key を `cowork-agent.<user_code>` に変更
- [ ] 🛠 既存テストへの影響を fix

### P0-3. pluginConfig 拡張

- [ ] 🧪 `core/kintone/pluginConfig.test.ts` 追加: workerUrl / oauthClientId / scope の読み出し、未設定値は null
- [ ] 🛠 `core/kintone/pluginConfig.ts` 拡張、`oauthClientSecret` / `anthropicApiKey` は **読み出さない**

---

## P1. Plugin OAuth core (TDD で先に書く)

### P1-1. PKCE / state 生成

- [ ] 🧪 `core/oauth/pkce.test.ts`:
  - [ ] generatePkce: codeVerifier base64url, codeChallenge = SHA256(verifier) base64url
  - [ ] state は十分なエントロピー
  - [ ] save/load/clear が sessionStorage を使う
- [ ] 🛠 `core/oauth/pkce.ts` 実装

### P1-2. popup 制御

- [ ] 🧪 `core/oauth/popup.test.ts`:
  - [ ] window.open mock + postMessage で resolve
  - [ ] 不正 origin の message 無視
  - [ ] state 不一致 message 無視
  - [ ] popup が user キャンセル (closed) で reject
  - [ ] timeout で reject
- [ ] 🛠 `core/oauth/popup.ts` 実装

### P1-3. tokenExchange

- [ ] 🧪 `core/oauth/tokenExchange.test.ts`:
  - [ ] kintone.plugin.app.proxy mock、URL / method / body 形式 (`application/x-www-form-urlencoded`)
  - [ ] 成功時 KintoneTokens を返す
  - [ ] 4xx 失敗時 例外
  - [ ] access_token 欠損時 例外
- [ ] 🛠 `core/oauth/tokenExchange.ts` 実装

### P1-4. credentialsUpsertClient

- [ ] 🧪 `core/oauth/credentialsUpsertClient.test.ts`:
  - [ ] kintone.plugin.app.proxy mock、Worker URL / method / body
  - [ ] body に client_secret / client_id / Anthropic API key が **含まれていない** ことを検証
  - [ ] credentialId 有り無しで body 切り替え
  - [ ] 4xx 失敗時 例外 + status code 取得可能
- [ ] 🛠 `core/oauth/credentialsUpsertClient.ts` 実装

---

## P2. Plugin bootstrap 改修

### P2-1. resolveAgent

- [ ] 🧪 `core/bootstrap/resolveAgent.test.ts`:
  - [ ] mcp_servers に `{ type: 'url', name: 'kintone', url: '<worker>/mcp' }` を含む
  - [ ] tools に `mcp_toolset { mcp_server_name: 'kintone', default_config: { ..always_allow.. } }` を含む
- [ ] 🛠 `core/bootstrap/resolveAgent.ts` 改修

### P2-2. resolveSession

- [ ] 🧪 `core/bootstrap/resolveSession.test.ts`:
  - [ ] vault_ids: [vaultId] を渡す
  - [ ] vaultId が null の場合は vault_ids: []
- [ ] 🛠 `core/bootstrap/resolveSession.ts` 改修

### P2-3. resolveVault (新規 or 既存改修)

- [ ] 🧪 `core/bootstrap/resolveVault.test.ts`:
  - [ ] chatStore.vaultId が null → POST /v1/vaults で新規作成、display_name に user code を含む
  - [ ] chatStore.vaultId 有 → GET で生存確認、archive 済なら新規作成、生存なら再利用
- [ ] 🛠 `core/bootstrap/resolveVault.ts` 改修 (旧 setVaultKeys 系を削除して再構築)

---

## P3. useUserBinding 書き直し

- [ ] 🧪 `desktop/hooks/useUserBinding.test.ts`:
  - [ ] 設定不足 → status='error'
  - [ ] connect 成功フロー (popup mock + tokenExchange mock + upsertClient mock + chatStore 副作用)
  - [ ] popup キャンセル → status='unbound' に戻る
  - [ ] tokenExchange 失敗 → status='error'
  - [ ] upsert 失敗 (404) → credentialId クリアして再 upsert (fallback)
  - [ ] refresh: 既存 credentialId 有 + 生存 → status='bound'
  - [ ] refresh: 既存 credentialId 無 → status='unbound'
- [ ] 🛠 `desktop/hooks/useUserBinding.ts` 全リライト

---

## P4. Plugin UI

### P4-1. ConnectKintoneButton

- [ ] 🧪 `desktop/components/ConnectKintoneButton.test.tsx`:
  - [ ] status='unbound' → ボタン表示「kintone と連携」
  - [ ] status='binding' → スピナー
  - [ ] status='error' → エラー + 再試行ボタン
  - [ ] status='bound' → null
- [ ] 🛠 `desktop/components/ConnectKintoneButton.tsx` 実装

### P4-2. ChatPanel から CredentialDialog 削除 + ConnectKintoneButton 注入

- [ ] 🧪 `desktop/ChatPanel.test.tsx` (既存) を更新: bound 時は Composer 表示、unbound 時は ConnectKintoneButton 表示
- [ ] 🛠 `desktop/ChatPanel.tsx` を改修

### P4-3. ConfigScreen 3 ステップウィザード

- [ ] 🧪 `config/ConfigScreen.test.tsx`:
  - [ ] Step 1 で workerUrl 未入力なら Step 2/3 disabled
  - [ ] Step 2 で callbackUrl が `<workerUrl>/oauth/callback` で計算される
  - [ ] Step 2 で OAuth admin 画面リンクが `https://<location.hostname>/admin/integrations/oauth/list`
  - [ ] Step 3 保存時に setProxyConfig が **3 経路分**呼ばれる:
    - [ ] /oauth2/token (Basic auth)
    - [ ] <workerUrl>/credentials/upsert (X-Anthropic-Api-Key + X-Kintone-OAuth-Client-Id + X-Kintone-OAuth-Client-Secret)
    - [ ] https://api.anthropic.com/ (POST + GET それぞれで X-Api-Key)
  - [ ] setConfig には oauthClientSecret / anthropicApiKey が **保存されない**
- [ ] 🛠 `config/ConfigScreen.tsx` 全リライト

---

## I. 統合 / E2E

### I1. ローカル smoke (実環境)

- [ ] 🚀 Plugin をビルド + kintone にアップロード (auto-deploy フックで自動)
- [ ] ✋ Plugin Config 画面を開いて 3 ステップ完走
- [ ] ✋ ChatPanel から ConnectKintoneButton で OAuth flow 完走 + Vault Credential 作成成功
- [ ] ✋ チャットメッセージ送信 → kintone データ取得 (アプリ一覧)
- [ ] ✋ アプリリロード後も bound 状態継続

### I2. E2E

- [ ] 🧪 `e2e/oauth-binding.spec.ts` 作成 (Playwright で popup 制御):
  - [ ] ConnectKintoneButton クリック → popup 開く
  - [ ] cybozu OAuth 同意 (初回のみ)
  - [ ] /oauth/callback で postMessage が opener に届く
  - [ ] Composer が表示され bound 状態確定
  - [ ] localStorage に vlt_/vcrd_ id が保存されている
- [ ] 🧪 既存 e2e (チャット起動 / セッション履歴) を beforeAll で 1 度バインドして共通 fixture 化
- [ ] 🧹 旧 `e2e/setup.spec.ts` (JWT バインディング想定) を削除

### I3. typecheck / lint / unit 全通し

- [ ] ✅ `pnpm -r typecheck` green
- [ ] ✅ `pnpm -r test` green
- [ ] ✅ `pnpm lint` green

---

## R. 後片付け / ドキュメント

- [ ] 🧹 `scripts/verify-mcp-oauth.mjs` を最新の Worker URL + KINTONE_OAUTH_SCOPE で動くよう README 一行追加
- [ ] 📝 README.md 更新: Phase 1b-3 の admin セットアップ手順 (Worker deploy → cybozu OAuth client 作成 → Plugin Config 入力 → 動作確認)
- [ ] 📝 `.env.example` から不要キー削除 (JWT_HMAC_SECRET / MINT_API_KEY)
- [ ] 🧹 Worker `tests.disabled.phase1b3/` 削除
- [ ] 🧹 Worker `/debug/echo` を残すか削除するか判断 (検証完了後に削除推奨)

---

## 完了条件 (再掲)

- [ ] Plugin Config 画面で Worker URL + ANTHROPIC_API_KEY + kintone OAuth client 情報を入力・保存できる
- [ ] チャットパネルから「kintone と連携」フローを完走でき、Vault Credential が作成される
- [ ] チャットメッセージを送ると Anthropic 経由で Worker `/mcp` が呼ばれ、kintone のデータが返る
- [ ] アプリリロード後も Vault Credential が有効な間は再認可なしで動作する
- [ ] 既存 unit tests / typecheck / E2E (本フェーズ範囲) green
- [ ] Worker が secret を一切静的保持していないこと (`wrangler secret list` が空)
