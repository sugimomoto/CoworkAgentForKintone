# タスクリスト: 初回実装 (MVP)

**作業タイトル**: initial-implementation
**作成日**: 2026-04-25

進捗マーク: `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了 / `[!]` ブロック中

## TDD タスク表記

各実装タスクは以下のサイクルで進める。タスクリストでは省略表記する。

```
RED       失敗するテストを書く
GREEN     最小限の実装で通す
REFACTOR  重複・読みにくさを整える
```

タスク先頭の絵文字で TDD の段階を示す:

- 🟥 = テスト先行 (Red)
- 🟩 = 実装 (Green)
- 🔵 = リファクタ・統合 (Refactor / 連結)
- ⬜ = TDD 対象外 (設定ファイル / 型定義 / SVG / 試行錯誤的セットアップ。詳細は [docs/development-guidelines.md §5.7](../../docs/development-guidelines.md))

各機能は 🟥 → 🟩 → 🔵 の順で着手する。**🟥 を飛ばして 🟩 から始めることは禁止**。

---

## Phase 0: リポジトリ初期化 / 開発環境整備

> Phase 0 は主に設定ファイル群で TDD 対象外 (⬜) が多い。**最後に「失敗するサンプルテストが意図通り CI で落ちる」ことを確認するスモークテストだけ TDD する**。

### P0-1. モノレポ基盤
- [x] ⬜ `pnpm-workspace.yaml` (`packages/*`)
- [x] ⬜ ルート `package.json` (workspace スクリプト、devDependencies)
- [x] ⬜ `.gitignore` (Node / Python / IDE / Vite 出力 / .ppk / .env)
- [x] ⬜ `.editorconfig`
- [x] ⬜ `.prettierrc` / `.prettierignore`
- [x] ⬜ `eslint.config.js` (flat config、TypeScript + import/order)
- [x] ⬜ `LICENSE` (MIT)
- [ ] ⬜ ルート `README.md` スケルトン

### P0-2. プラグインパッケージ初期化 (`packages/plugin/`)

**Phase 0 段階の最小プラグイン (静的ファイルのみ、ビルドなし)** が完了。Vite/React への置換は Phase 1a で実施。

- [x] ⬜ `package.json` (cli-kintone keygen / pack / upload スクリプト)
- [x] ⬜ `plugin/manifest.json` (manifest_version 1, desktop / config 定義済)
- [x] ⬜ `plugin/js/desktop.js` (Phase 0 placeholder)
- [x] ⬜ `plugin/js/config.js` (Phase 0 placeholder)
- [x] ⬜ `plugin/css/desktop.css` / `plugin/css/config.css`
- [x] ⬜ `plugin/html/config.html`
- [x] ⬜ `plugin/image/icon.png` (32×32 Teal placeholder)
- [x] ⬜ `README.md` (ローカルビルド・CI/CD 手順、必要 Secrets)
- [x] ⬜ TypeScript + Vitest 導入 (Phase 1a-1 開始のため最小セット)
- [x] ⬜ `tsconfig.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes 有効)
- [x] ⬜ `vitest.config.ts` (node 環境、coverage 設定)
- [x] ⬜ `src/core/constants.ts` (metadata キー / Anthropic 定数 / ポーリング設定)
- [x] ⬜ Vite + React 18 + Tailwind 3 + Zustand + Testing Library + jsdom 導入
- [x] ⬜ `vite.config.ts` (React プラグイン)
- [x] ⬜ `tailwind.config.ts` (デザイントークン theme.extend に登録)
- [x] ⬜ `postcss.config.js`
- [x] ⬜ `src/styles/global.css` (Tailwind + CSS 変数で light/dark テーマ)
- [x] ⬜ `src/test/setup.ts` (@testing-library/jest-dom マッチャ)
- [x] ⬜ `src/types/kintone-plugin.d.ts` — P1a-3 で実施済

### P0-3. ヘルパーライブラリ初期化 (`packages/kintone-helper/`)
- [ ] ⬜ `pyproject.toml` (hatchling + requests + pytest + responses + ruff + mypy)
- [ ] ⬜ `src/cowork_agent_kintone/__init__.py` (空エクスポート)
- [ ] ⬜ `tests/` + `conftest.py`
- [ ] ⬜ `README.md` スケルトン
- [ ] ⬜ `CHANGELOG.md` (Keep a Changelog 形式)
- [ ] ⬜ `LICENSE` (MIT)
- [ ] ⬜ `.python-version` (3.11)

### P0-4. CI/CD

**配布と運用の責務分担**:
- **GitHub (CI)**: OSS 配布用 `plugin.zip` 生成のみ。kintone へのアップロードはしない
- **ローカル**: `.env` ベースで自分の kintone 開発環境にアップロード (`pnpm plugin:upload` / `plugin:deploy`)

- [ ] ⬜ `.github/workflows/ci.yml` — Lint / 型 / テスト (TypeScript + Python) (Phase 1a 着手時)
- [x] ⬜ `.github/workflows/build-plugin.yml` — PR/push で zip 化 + Artifact 保管、`plugin-v*` タグで Release 添付 (OSS 配布)
- [x] ⬜ `.env.example` (リポジトリルート) + `.env` 読み込み済 `scripts/upload.mjs` (ローカルアップロード)
- [ ] ⬜ `.github/workflows/publish-pypi.yml` — タグ push で PyPI に公開 (Phase 1b helper 完成時)

### P0-5. プリコミットフック
- [ ] ⬜ `lefthook.yml` 設定 — Prettier / ESLint / tsc / Ruff / mypy / Vitest / pytest (差分のみ)
- [ ] ⬜ README に `pnpm install && pnpm lefthook install` の手順追加

### P0-6. TDD 環境の検証 (本 Phase 唯一の TDD タスク)
- [x] 🟥 プラグイン側に「常に失敗するテスト 1 件」 (`smoke.test.ts`) → ローカルで失敗確認
- [x] 🟩 通る最小実装に変更 → 緑確認
- [x] 🔵 スモークテストを削除
- [ ] 🟥 helper 側のスモークテスト (Phase 1b 着手時に実施)

**Phase 0 完了判定**: `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` / `pytest` がいずれも通過し、TDD 環境が機能していることが確認できる

---

## Phase 1a: 最小動作確認 (UI + Agent 会話の疎通)

### P1a-1. Managed Agents 連携基盤
- [x] ⬜ `src/core/managed-agents/types.ts` — Agent / Environment / Vault / Session / Event の型定義
- [x] 🟥 `client.test.ts` — `apiHeaders()` が必須ヘッダを含むことを検証
- [x] 🟩 `client.ts` の `apiHeaders()` 実装
- [x] 🟥 `client.test.ts` — `apiRequest()` が成功時 JSON を返すことを検証 (`fetch` モック)
- [x] 🟩 `apiRequest()` 実装
- [x] 🟥 `client.test.ts` — エラーレスポンス時の例外
- [x] 🟩 `ApiError` クラス + エラーハンドリング実装
- [x] 🟥 `client.test.ts` — 204 / body 空のとき null を返す
- [x] 🟩 No Content 対応実装
- [x] 🟥 `resources.test.ts` — Agent `list` / `create` / `retrieve` の各リクエスト形を検証
- [x] 🟩 `resources.ts` Agent 実装
- [x] 🟥 `resources.test.ts` — Environment / Vault / Session の同様テスト
- [x] 🟩 Environment / Vault / Session 実装
- [x] 🟥 `resources.test.ts` — `listAll` (auto-pagination) と `filterByMetadata`
- [x] 🟩 ヘルパ実装 (`listAll`, `filterByMetadata`)
- [x] 🟥 `events.test.ts` — `POST events (user.message)` のリクエスト形 (string / array 両対応)
- [x] 🟩 `events.ts` の `postUserMessage()` 実装
- [x] 🟥 `events.test.ts` — `listEvents` のクエリパラメータ
- [x] 🟥 `events.test.ts` — `fetchAllEventsSince` が page カーソルを正しく扱う
- [x] 🟥 `events.test.ts` — 既知イベント ID で差分取得 (見つからない場合は全件)
- [x] 🟩 `fetchAllEventsSince` 実装
- [x] 🔵 共通の query string ビルダ抽出 / 型整理

### P1a-2. Bootstrap (Agent / Environment / Session の動的解決)
- [x] 🟥 `resolveAgent.test.ts` — 既存 Default Agent が見つかれば返す
- [x] 🟥 `resolveAgent.test.ts` — 見つからなければ作成して返す
- [x] 🟥 `resolveAgent.test.ts` — 別 source / type=custom / 多ページ対応
- [x] 🟩 `resolveAgent.ts` 実装 (Phase 1a 用 system prompt + agent_toolset)
- [x] 🟥 `resolveEnvironment.test.ts` — bootstrap Environment 検索 / 作成
- [x] 🟥 `resolveEnvironment.test.ts` — purpose=bootstrap 以外のものは無視
- [x] 🟩 `resolveEnvironment.ts` 実装 (Phase 1a 用、kintone 接続なし)
- [x] 🟥 `resolveSession.test.ts` — `agent_id` + metadata で自ユーザーの最新 Session 返却
- [x] 🟥 `resolveSession.test.ts` — domain / userCode 違いは除外
- [x] 🟥 `resolveSession.test.ts` — 該当なしで作成、metadata と title 付与
- [x] 🟥 `resolveSession.test.ts` — `forceNew=true` で list スキップして作成
- [x] 🟩 `resolveSession.ts` 実装
- [x] 🟥 `resolveAgent.test.ts` — 既存 Agent が複数ある場合は created_at 最古を返す
- [x] 🟥 `resolveAgent.test.ts` — 作成後 verification で他プロセスが作った古い Agent を発見して優先
- [x] 🟥 `resolveAgent.test.ts` — 並行呼び出しで create が 1 回だけ (in-flight 共有)
- [x] 🟥 `resolveAgent.test.ts` — create 失敗時にキャッシュ破棄して再試行可能
- [x] 🟩 競合対策実装 (in-flight Promise 共有 + created_at 最古優先 + 作成後再検証)
- [x] 🔵 「list + filter by metadata」共通ヘルパ抽出 (`findByMetadata`) — 3 解決関数で利用、List params に `| undefined` を明示

### P1a-3. kintone 連携基盤
- [x] ⬜ `src/types/kintone-plugin.d.ts` — kintone グローバル型定義 (本プラグインで使う範囲)
- [x] 🟥 `user.test.ts` — `getKintoneUserCode` / `getKintoneDomain` / `getCurrentSessionContext` / kintone 未定義時のエラー
- [x] 🟩 `user.ts` 実装 (`KintoneNotAvailableError` 含む)

### P1a-4. UI コンポーネント (Outside-In)
- [x] 🟥 `Composer.test.tsx` — 入力 → 送信ボタン押下で onSubmit が呼ばれる
- [x] 🟥 `Composer.test.tsx` — Enter で送信、Shift+Enter で改行、空送信は不可
- [x] 🟥 `Composer.test.tsx` — 送信後クリア / disabled / ヒント行表示
- [x] 🟩 `Composer.tsx` 実装 (Teal 送信ボタン + ⌘K ヒント + Tailwind スタイル)
- [x] 🟥 `Header.test.tsx` — name / AGENT バッジ / Status / 設定・閉じるボタン
- [x] 🟩 `Header.tsx` 実装 (34×34 Avatar + status dot + IconButton ヘルパ)
- [x] 🟥 `UserMessage.test.tsx` / `AgentMessage.test.tsx` / `ThinkingDots.test.tsx` の表示
- [x] 🟩 各 MessageItem 実装 (AgentAvatar 共通化 + 3 ドットアニメーション)
- [x] 🟥 `MessageList.test.tsx` — kind 別振分 (user/agent/thinking) + 未知 kind 無視
- [x] 🟩 `MessageList.tsx` 実装
- [x] ⬜ インライン SVG アイコンセット (Star / Clock / Settings / Close / Send / AgentAvatar) — Header / Composer 内に埋込済
- [x] 🟥 `ChatPanel.test.tsx` — Header/MessageList/Composer 統合、送信→postUserMessage 呼出、エラー表示、bootstrapping 中 disabled
- [x] 🟩 `ChatPanel.tsx` で各コンポーネントを連結 (useSession + useEventPoller)
- [x] ⬜ `src/desktop/index.tsx` — マウント処理 (kintone イベントは E2E で確認)

### P1a-5. 状態管理 / フック
- [x] 🟥 `chatStore.test.ts` — 10 シナリオ (add/replace/remove/setSessionId/setStatus/reset/resetConversation)
- [x] 🟩 `chatStore.ts` 実装 (Zustand)
- [x] 🟥 `useSession.test.ts` — bootstrapping → ready / error の状態遷移、startNewConversation
- [x] 🟩 `useSession.ts` 実装 (resolveAgent/Env/Session 連鎖)
- [x] 🟥 `useEventPoller.test.ts` — ポーリング起動 / イベント変換 / バックオフ / 終了検知
- [x] 🟩 `useEventPoller.ts` 実装 (2s→3s→5s→10s バックオフ、stop_reason.end_turn で停止)
- [ ] 🔵 hook 間の共通モジュール抽出 — 現時点では重複なし、必要に応じて後続で

### P1a-6. 設定画面
- [x] ⬜ `ConfigScreen.tsx` 実装 (Phase 1a 最小: Proxy 設定案内 + 保存ボタン)
- [ ] 🟥 `ConfigScreen.test.tsx` — 保存ボタン / 接続テスト (Phase 1b で拡張)
- [x] ⬜ `src/config/index.tsx` エントリ (createRoot + DOMContentLoaded)

### P1a-7. localStorage 連携
- [x] 🟥 `usePanelOpenState.test.ts` — 既定値 / setIsOpen / 再マウント復元 / 壊れた値対応
- [x] 🟩 `usePanelOpenState.ts` 実装

### P1a-8. ビルド・パッケージング (TDD 対象外)
- [x] ⬜ `scripts/build.mjs` — manifest 番号 +1 + esbuild (desktop/config IIFE) + Tailwind CSS
- [x] ⬜ `src/desktop/index.tsx` + `src/config/index.tsx` エントリ作成
- [x] ⬜ 生成物を .gitignore に追加 (`plugin/js/`, `plugin/css/`)
- [x] ⬜ `pnpm plugin:pack` で `plugin.zip` 生成 (105KB / 30MB 上限内)

### P1a-9. 動作検証 (E2E、自動化 + 手動)
- [x] ⬜ Playwright 導入 (`@playwright/test`、Chromium binaries)
- [x] ⬜ `playwright.config.ts` (storageState 共有、setup project + chromium project)
- [x] ⬜ `e2e/auth.setup.ts` — kintone ログイン → セッション保存 (動作確認済)
- [x] ⬜ `e2e/smoke.spec.ts` — パネル表示 / Header / Composer 確認
- [x] ⬜ `e2e/chat-flow.spec.ts` — Anthropic ルートインターセプト + UserMessage 追加検証
- [x] ⬜ `pnpm plugin:e2e:install` / `plugin:e2e` / `plugin:e2e:ui` スクリプト整備
- [x] ⬜ `.env` に `KINTONE_TEST_APP_ID` 設定 (ユーザー作業)
- [x] kintone 検証環境にプラグインをインストール (Stop フックで自動化済)
- [x] 設定画面で API Key 登録 (config.spec.ts で自動化)
- [x] `pnpm plugin:e2e` でスモーク + chat-flow が緑になることを確認 (16/16 PASS)
- [x] 「こんにちは」と送信 → Agent 応答が `thinking` → `agent.message` で表示 (live.spec.ts で自動化)
- [x] パネル開閉状態が保存・復元される (panel-toggle.spec.ts で自動化)
- [~] 別アプリで同じ Session の続きが表示される — Session 取り扱い再設計 (`.steering/20260425-session-redesign/`) で「自動復元しない」方針に変更したため取り下げ
- [ ] alpha タグで GitHub Release を作成

**Phase 1a 完了判定**: requirements.md §4 Phase 1a 完了条件 + テストカバレッジ `core/` 80%+ 達成

---

## Phase 1b: 認証基盤 + 読取 + HITL 基盤

### P1b-1. ヘルパーライブラリ実装 (Inside-Out TDD)
- [ ] 🟥 `tests/test_auth.py` — 環境変数からの読込 / Basic 認証ヘッダ生成 / 環境変数欠落時の例外
- [ ] 🟩 `auth.py` 実装
- [ ] 🟥 `tests/test_errors.py` — `KintoneApiError` のメッセージ・コード保持
- [ ] 🟩 `errors.py` 実装
- [ ] 🟥 `tests/test_http.py` — タイムアウト / 4xx 時の例外化 / 5xx リトライ
- [ ] 🟩 `_http.py` 実装
- [ ] 🟥 `tests/test_client.py` — `Client()` が環境変数から自動初期化
- [ ] 🟩 `client.py` 実装
- [ ] 🟥 `tests/test_apps.py` — `get_apps` / `get_app_schema` / `get_form_layout` の正常系・異常系
- [ ] 🟩 `apps.py` 実装
- [ ] 🟥 `tests/test_cursor.py` — カーソル API の継続、10,001 件取得、トークン期限切れ
- [ ] 🟩 `cursor.py` 実装
- [ ] 🟥 `tests/test_records.py::test_get_records_*` — クエリ指定・fields 指定・カーソル統合・境界値 (0 / 500 / 10,000 / 10,001 件)
- [ ] 🟩 `records.py` の `get_records` 実装
- [ ] 🔵 共通 HTTP 呼出のリファクタリング (重複削除)
- [ ] ⬜ PyPI に dev release として公開 (`cowork-agent-kintone==0.1.0a1`)

### P1b-2. Vault / ユーザー Environment 解決
- [ ] 🟥 `resolveVault.test.ts` — metadata 検索 / 作成 / 認証情報の Vault への書込
- [ ] 🟩 `resolveVault.ts` 実装
- [ ] 🟥 `ensureEnvironment.test.ts` — bootstrap Environment が見つかった場合は破棄、ユーザー専用 Environment 作成
- [ ] 🟥 `ensureEnvironment.test.ts` — 既存ユーザー Environment があれば再利用
- [ ] 🟩 `ensureEnvironment.ts` 実装
- [ ] 🟥 Session 作成時に `vault_ids` が渡されることのテスト
- [ ] 🟩 Session 作成ロジック更新

### P1b-3. UserBindingBootstrap UI (Outside-In)
- [ ] 🟥 `CredentialDialog.test.tsx` — ID/PW 入力 → 登録ボタン押下 → onRegister が呼ばれる
- [ ] 🟥 `CredentialDialog.test.tsx` — 空入力時はバリデーションエラー
- [ ] 🟩 `CredentialDialog.tsx` 実装
- [ ] 🟥 `useUserBinding.test.ts` — Vault / Environment の解決状態 (有/無/待機中) の遷移
- [ ] 🟩 `useUserBinding.ts` 実装
- [ ] 🟥 `ChatPanel.test.tsx` 拡張 — 未バインディングなら CredentialDialog を表示、バインディング後にチャットへ遷移
- [ ] 🟩 ChatPanel に組込

### P1b-4. Tool / Plan / Progress / Result カード UI
- [ ] 🟥 `ToolCallCard.test.tsx` — ツール名 / 詳細 / items の表示
- [ ] 🟩 `ToolCallCard.tsx` 実装
- [ ] 🟥 `PlanCard.test.tsx` — read-only モードでの表示 (ヘッダ / ステップ / 見積)
- [ ] 🟩 `PlanCard.tsx` 実装 (read-only のみ)
- [ ] 🟥 `ProgressCard.test.tsx` — タイトル / % / バー / substeps / 進捗更新
- [ ] 🟩 `ProgressCard.tsx` 実装
- [ ] 🟥 `ResultCard.test.tsx` — ヘッダ / Rows / followup pill
- [ ] 🟩 `ResultCard.tsx` 実装
- [ ] ⬜ アニメーション CSS (msg-in / dot / shimmer)
- [ ] 🟥 `MessageList.test.tsx` 拡張 — 4 種カードの振分け
- [ ] 🟩 MessageList 拡張

### P1b-5. イベント解釈拡張
- [ ] 🟥 `eventInterpreter.test.ts` — `agent.tool_use` / `agent.tool_result` を ToolCallCard モデルに変換
- [ ] 🟥 `eventInterpreter.test.ts` — `<plan>...</plan>` マーカーを PlanCard モデルに変換
- [ ] 🟥 `eventInterpreter.test.ts` — `Progress: i/n` を ProgressCard 更新に変換
- [ ] 🟥 `eventInterpreter.test.ts` — Result 形式 (構造化 JSON) を ResultCard モデルに変換
- [ ] 🟩 `eventInterpreter.ts` 実装
- [ ] 🔵 マーカー定数の集約 (`core/constants.ts`)

### P1b-6. Agent system prompt の更新
- [ ] ⬜ kintone 操作ガイドライン追記 (テキスト変更、TDD 対象外。プロンプト出力の検証は Phase 1d のシナリオテストで行う)
- [ ] ⬜ Plan (read-only) ルール追記
- [ ] ⬜ Progress 出力フォーマット規約追記

### P1b-7. 動作検証 (E2E、手動)
- [ ] 新規ユーザーで CredentialDialog が表示される
- [ ] 認証情報入力 → Vault / Environment が作成される
- [ ] 「アプリ 42 のレコードを 10 件取得して」→ ToolCard / Result カードが表示される
- [ ] 10,000 件超のレコード取得が成功する (テスト用大量データ)
- [ ] 長時間タスクで Progress カードが更新され、パネル閉→再開で復元

**Phase 1b 完了判定**: requirements.md §4 Phase 1b 完了条件 + helper カバレッジ 80%+ 達成

---

## Phase 1c: 書き込み + HITL 承認

### P1c-1. ヘルパーライブラリ書込 API
- [ ] 🟥 `tests/test_records.py::test_add_records_*` — 99/100/101/200 件の境界値テスト、Progress 出力検証
- [ ] 🟩 `add_records` 実装 (100 件超は自動分割、`print(f"Chunk {i}/{n} done")` 出力)
- [ ] 🟥 `tests/test_records.py::test_update_records_*` — 同様
- [ ] 🟩 `update_records` 実装
- [ ] 🟥 `tests/test_records.py::test_delete_records_*` — 同様
- [ ] 🟩 `delete_records` 実装
- [ ] 🟥 `tests/test_bulk.py` — 19/20/21 操作の境界値、混在操作 (add + update + delete)
- [ ] 🟩 `bulk.py` の `bulk_request` 実装
- [ ] 🟥 部分失敗時の例外に処理済み ID が付与されることをテスト
- [ ] 🟩 部分成功レポート機構実装
- [ ] 🔵 共通の chunk 分割ユーティリティ抽出
- [ ] ⬜ PyPI 更新 (`0.1.0a2`)

### P1c-2. HITL 承認 UI
- [ ] 🟥 `PlanCard.test.tsx` 拡張 — `destructive=true` で 3 ボタン表示
- [ ] 🟥 各ボタン押下時に対応する `user.message` 文言が onSubmit に渡されること
- [ ] 🟥 「修正」押下時に Composer にフォーカスが移ること
- [ ] 🟩 `PlanCard.tsx` を destructive 対応に拡張
- [ ] ⬜ グロー shadow / warn 系カラーのスタイル適用 (Tailwind クラス追加、テスト不要)
- [ ] 🟥 `chatStore.test.ts` 拡張 — 承認/キャンセル時の状態遷移
- [ ] 🟩 chatStore に承認状態追加

### P1c-3. Agent system prompt の最終化
- [ ] ⬜ 破壊的操作前の Plan 発話必須ルール追記
- [ ] ⬜ 「承認します。実行してください。」の明示返信待ち条件追記
- [ ] ⬜ 承認なしで実行した場合の中断ルール追記

### P1c-4. ヘルパーライブラリ Environment の更新
- [ ] 🟥 `ensureEnvironment.test.ts` 拡張 — Environment metadata の `helperVersion` チェック
- [ ] 🟥 バージョン不一致時に再作成、Vault は再利用されることをテスト
- [ ] 🟩 `ensureEnvironment.ts` にバージョン管理ロジック追加

### P1c-5. 動作検証 (E2E、手動)
- [ ] 「カテゴリ未設定レコードを 5 件作成して」→ destructive 不要パスで実行
- [ ] 「最近のレコード 3 件を更新して」→ Plan (destructive) → 承認 → 実行 → 結果報告
- [ ] 承認しない場合 (キャンセル) → 操作中止
- [ ] 100 件超の一括更新 → ヘルパー側で自動分割、Progress カード段階更新

**Phase 1c 完了判定**: requirements.md §4 Phase 1c 完了条件 + テストカバレッジ維持

---

## Phase 1d: アプリ横断転記 (検証 + プロンプト調整)

> Phase 1d は新規実装が少なく、検証とドキュメント中心。TDD よりも **プロンプト品質のアサーション** が中心となる。

### P1d-1. system prompt 微調整
- [ ] ⬜ 複合タスクの全体計画発話ルール追記
- [ ] ⬜ 途中失敗時のリカバリ提案ルール追記
- [ ] ⬜ 既処理レコード ID の逐次報告ルール追記

### P1d-2. 検証シナリオ (Acceptance テストとして自動化)
- [ ] 🟥 `tests/scenarios/test_cross_app_transfer.py` (helper) — モックされた kintone API でアプリ横断転記の入出力契約を検証
- [ ] 🟩 必要に応じてヘルパーに横断ヘルパ関数を追加
- [ ] 「問合せアプリの未対応レコードを案件アプリに転記して」 (E2E、手動)
- [ ] 「売上アプリの今月分を月次集計アプリに転記して」 (E2E、手動)
- [ ] 「2 つのアプリの不整合レコードを検出して教えて」 (E2E、手動)
- [ ] 各シナリオの結果を `docs/scenarios/` に記録

### P1d-3. ドキュメント整備
- [ ] ⬜ ルート `README.md` 完成 (セットアップ、利用方法、スクリーンショット、アーキテクチャ概要)
- [ ] ⬜ `packages/plugin/README.md`
- [ ] ⬜ `packages/kintone-helper/README.md`
- [ ] ⬜ `docs/glossary.md` 更新 (Phase 中に新出した用語)

### P1d-4. リリース
- [ ] ⬜ kintone-helper を `0.1.0` (stable) で PyPI 公開
- [ ] ⬜ `ensureEnvironment.ts` を `0.1.0` 参照に更新 (既存ユーザー環境を再作成)
- [ ] ⬜ `packages/plugin/manifest.json` を `0.1.0` に更新
- [ ] ⬜ GitHub Release `plugin-v0.1.0` 作成、`plugin.zip` 添付
- [ ] ⬜ アナウンス用ノート (Issues / Discussions に告知)

**Phase 1d 完了判定**: requirements.md §4 Phase 1d 完了条件 + 配布面 3 項目すべて ✅

---

## 横断タスク (各 Phase で必要に応じ実施)

### TDD 規律
- [ ] 各 PR は **🟥 テストコミット → 🟩 実装コミット** の順で構成 (squash merge 前のコミット履歴で確認)
- [ ] ⬜ TDD 例外 (設定ファイル等) はその旨を PR 本文に記載
- [ ] **テストが落ちる状態を最低 1 回確認** してから実装に進む (Red フェーズの省略禁止)

### 品質
- [ ] PR ごとに ESLint / Prettier / tsc / Ruff / mypy / Vitest / pytest が CI で通る
- [ ] テストカバレッジ目標: `core/` 80%+ / `kintone-helper` 80%+
- [ ] 依存監査 (`pnpm audit` / `pip audit`) — CI 週次

### ドキュメント連動
- [ ] 仕様変更があれば `docs/functional-design.md` / `docs/architecture.md` を即時更新
- [ ] 用語追加は `docs/glossary.md`

### コミュニケーション
- [ ] 各 Phase 完了時に振り返り (本人のみでも記録を残す)
- [ ] 重大な未確定事項が解消された場合、`docs/architecture.md` §13 を更新

---

## 完了条件 (本ステアリング全体)

- [ ] requirements.md §4 のすべての受け入れ条件が ✅
- [ ] `plugin-v0.1.0` が GitHub Releases に公開
- [ ] `cowork-agent-kintone==0.1.0` が PyPI に公開
- [ ] ルート `README.md` が完成、第三者がインストール・動作確認可能
- [ ] 各 Phase の振り返りメモを本ディレクトリに残す (`retrospective.md`)
