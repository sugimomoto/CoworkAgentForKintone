# Phase 1b-2 — Vault + ユーザー Environment + CredentialDialog タスクリスト

要件: [requirements.md](./requirements.md)
設計: [design.md](./design.md)

凡例: 🟥 失敗するテスト先行 / 🟩 実装 / 🔵 リファクタ / ⬜ 設定・ドキュメント

## V0. 準備

- [ ] ⬜ `core/constants.ts` に `HELPER_PACKAGE_NAME` / `HELPER_VERSION='0.1.0a3'` / `HELPER_WHEEL_URL` (GitHub Release 直リンク) を追加
- [ ] ⬜ `core/managed-agents/types.ts` に Vault 関連型 (`Vault` / `CreateVaultBody` / `SetVaultKeysBody`) を整備
- [ ] ⬜ `src/test/fixtures.ts` に `makeVault(overrides?)` を追加

## V1. Resources 層 (Vault API ラッパ)

- [ ] 🟥 `resources.test.ts` 拡張 — `listVaults` / `createVault` / `setVaultKeys` の正常系・metadata 含み
- [ ] 🟩 `core/managed-agents/resources.ts` に上記 3 関数を追加
- [ ] 🟥 `setVaultKeys` のリクエスト body shape (`{ keys: { K: V, ... } }`) 確認
- [ ] 🟩 ヘルパー類 (`apiRequest` / `filterByMetadata`) は再利用

## V2. resolveVault

- [ ] 🟥 `resolveVault.test.ts` — 既存 Vault が見つかればそれを返す (作成しない)
- [ ] 🟥 — 該当ユーザーの Vault が無ければ作成、metadata と display_name を確認
- [ ] 🟥 — 他ユーザー / 他ドメイン / 他 source の Vault は除外
- [ ] 🟥 — in-flight Promise 保護 (連続呼出で 1 つしか作成されない)
- [ ] 🟥 — `setVaultCredentials(vaultId, creds)` が `setVaultKeys` を呼んで 3 キー upsert
- [ ] 🟩 `core/bootstrap/resolveVault.ts` 実装

## V3. ensureUserEnvironment

- [ ] 🟥 `ensureEnvironment.test.ts` — 既存ユーザー Env が見つかればそれを返す
- [ ] 🟥 — 無ければ作成、name / config (allowed_hosts, packages.pip, pip_extra_index_url) / metadata 確認
- [ ] 🟥 — 他ユーザーの Env や bootstrap Env は除外 (metadata 突合)
- [ ] 🟥 — race-deterministic: 複数マッチ時は pickOldest
- [ ] 🟥 — in-flight Promise 保護
- [ ] 🟩 `core/bootstrap/ensureEnvironment.ts` 実装
- [ ] ⬜ `resolveBootstrapEnvironment.ts` は本 Phase では触らない

## V4. chatStore 拡張

- [ ] 🟥 `chatStore.test.ts` 拡張 — `vaultId` / `userEnvironmentId` / `bindingStatus` / `bindingError` の初期値
- [ ] 🟥 — `setVaultId` / `setUserEnvironmentId` / `setBindingStatus` の挙動 (status 'error' のみ error 値が保持される)
- [ ] 🟥 — `reset()` で全部初期化される
- [ ] 🟩 `chatStore.ts` 拡張

## V5. useUserBinding

- [ ] 🟥 `useUserBinding.test.ts` — `status='ready'` 後にマウントされたら listVaults + listEnvironments を呼んで状態判定
- [ ] 🟥 — Vault と User Env 両方ある → `'bound'` + 各 id を store に保存
- [ ] 🟥 — どちらか不在 → `'unbound'`
- [ ] 🟥 — 検索失敗 → `'error'`
- [ ] 🟥 — `bind(values)` 呼出: `'binding'` → resolveVault → setVaultCredentials → ensureUserEnvironment → `'bound'`
- [ ] 🟥 — `bind` 連続呼出で in-flight 保護
- [ ] 🟥 — `bind` 失敗時 `'error'`、エラーメッセージが store に保持される
- [ ] 🟩 `desktop/hooks/useUserBinding.ts` 実装

## V6. CredentialDialog

- [ ] 🟥 `CredentialDialog.test.tsx` — `open=false` で何も描画しない
- [ ] 🟥 — `open=true` で domain/login/password の入力欄と「キャンセル」「登録」ボタンが表示
- [ ] 🟥 — `initialDomain` 既定値が domain 入力に入る
- [ ] 🟥 — 必須バリデーション: 空の状態で登録ボタンは disabled
- [ ] 🟥 — domain 形式バリデーション (`example.cybozu.com` OK / `not a host` NG)
- [ ] 🟥 — 登録ボタン押下で `onSubmit(values)` が呼ばれ、Promise 中はボタン disabled + スピナー
- [ ] 🟥 — `onSubmit` reject 時にエラーメッセージが赤帯で表示される
- [ ] 🟥 — キャンセル / ESC / 背景クリックで `onClose` が呼ばれる
- [ ] 🟩 `desktop/components/CredentialDialog.tsx` 実装

## V7. resolveSession.createUserSession の拡張

- [ ] 🟥 `resolveSession.test.ts` 拡張 — `createUserSession` に `vaultId` を渡すと session body の `vault_ids` に含まれる
- [ ] 🟥 — `vaultId` 未指定なら `vault_ids: []`
- [ ] 🟥 — 既存テストは緑のまま
- [ ] 🟩 `core/bootstrap/resolveSession.ts` を任意 `vaultId` 受取に拡張

## V8. useSession.ensureSession の分岐

- [ ] 🟥 `useSession.test.ts` 拡張 — bound 状態 (vaultId / userEnvironmentId 両方ある) で ensureSession を呼ぶと createUserSession に user env と vault が渡る
- [ ] 🟥 — unbound 状態でも ensureSession は失敗せず動く (= 既存 Phase 1a 互換、bootstrap env で作成) ※ 本 Phase で送信導線は変わるが ensureSession 単体の互換は保つ
- [ ] 🟩 `desktop/hooks/useSession.ts` の ensureSession 分岐を実装

## V9. ChatPanel 統合

- [ ] 🟥 `ChatPanel.test.tsx` 拡張 — bindingStatus='unbound' で送信すると CredentialDialog が開き、ensureSession/postUserMessage は呼ばれない
- [ ] 🟥 — bound 後、保留テキストが postUserMessage に流れる
- [ ] 🟥 — Dialog キャンセル時、楽観追加した user message と pending thinking が削除される
- [ ] 🟥 — bound 状態の通常送信は既存通り (Dialog 出ない)
- [ ] 🟩 `desktop/ChatPanel.tsx` を useUserBinding 統合 + pendingText 制御に修正

## V10. Header からの再オープン (任意、余力次第)

- [ ] 🟥 `Header.test.tsx` 拡張 — onSettingsClick が指定されていれば設定アイコンが描画される (既に実装済の挙動を再確認)
- [ ] 🟩 `ChatPanel.tsx` で onSettingsClick を使って CredentialDialog を再表示するハンドラを配線
- [ ] ⬜ 余力なければ Phase 1b-3 (system prompt 更新時) に持ち越し

## V11. E2E

- [ ] ⬜ `e2e/credential-bind.setup.ts` — 既存 Vault/Env が無いユーザー向けにバインドだけ済ませる setup spec (既存 spec への影響を吸収)
- [ ] ⬜ `e2e/credential-binding.spec.ts` — 初回送信 → Dialog 出現 → 入力 → 登録 → 送信完了
- [ ] ⬜ `e2e/credential-binding.spec.ts` — 既に bind 済の状態で送信すると Dialog が出ない
- [ ] ⬜ `e2e/credential-binding.spec.ts` — Dialog のキャンセルで楽観メッセージが消える
- [ ] ⬜ playwright.config.ts に setup の dependency を追加

## V12. デプロイと動作確認

- [ ] ⬜ `pnpm run deploy` + `pnpm app-deploy` で plugin 配信
- [ ] ⬜ ブラウザで kintone レコード一覧 → 「こんにちは」送信 → CredentialDialog 出現 → ID/PW 入力 → 登録 → 送信完了 → Agent から応答が返る (ここまでは bootstrap 時と同じ挙動になる。Agent system prompt は Phase 1b-3 で kintone 操作対応。本 Phase は配線確認のみ)
- [ ] ⬜ Anthropic Console で当該ユーザーの Vault と User Environment が作成されたこと確認
- [ ] ⬜ 全 単体テスト緑 / 全 E2E 緑

## V13. リファクタ・整理

- [ ] 🔵 `simplify` skill で全変更箇所を 3-agent レビュー
- [ ] ⬜ design.md の未確定事項 (Vault エンドポイント / packages.pip_extra_index_url のキー名) を実装値で確定
- [ ] ⬜ tasklist 内の未完項目を確認しつつチェック更新

## 完了条件

- requirements.md AC-1〜10 + NFR-1〜6 を満たす
- 既存 単体テスト (190+) すべて緑
- 新規追加テスト (目標 +30〜40 件) 緑
- E2E credential-binding spec 緑、既存 16 件も緑
- 実 kintone 環境で初回バインド → 送信完了 のシナリオ確認済
- 元 Phase 1a / Session 再設計 / Phase 1b-1 のステアリングディレクトリは変更しない
