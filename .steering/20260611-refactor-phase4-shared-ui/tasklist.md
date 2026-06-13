# タスクリスト: リファクタリング Phase 4 — 共通コンポーネント化 + 重複排除 + リポジトリ衛生

requirements.md / design.md に基づく実装タスク。T1 (衛生) は独立していつでも実施可。T2 (Worker) は Phase 1 完了後、T3〜T5 (UI / 文言) は Phase 3 完了後。

## T1. リポジトリ衛生 (PR-E) — 独立・先行可

- [ ] T1.1 `.gitignore` に design-handoff の `*.jsx` / `*.tsx` パターンを追加
- [ ] T1.2 `git rm -r --cached` で追跡中の書き出しファイル (68 件 + design_handoff_pebble_sprout) を index から除外 (ワーキングツリーには残す)
- [ ] T1.3 検証: `git ls-files 'docs/design-handoff/**/*.jsx' 'docs/design-handoff/**/*.tsx'` が 0 件
- [ ] T1.4 `docs/presentations/` を作成し `kintone-cafe-vol29-lt-slides.md` を移動 (コミットするかは方針確認のうえ)
- [ ] T1.5 `docs/repository-structure.md` に「デザイン書き出しは Git 管理外」を追記

## T2. Worker 重複排除 (PR-D)

- [ ] T2.1 `tools/factory.ts` に `toolResult(data)` を追加
- [ ] T2.2 全ツール (~12 ファイル) の return 文を `toolResult()` に置換
- [ ] T2.3 検証: 既存テスト green / レスポンス JSON が不変であること
- [ ] T2.4 3 ハンドラの `anthropic-version` / `anthropic-beta` の値が一致しているか確認 (不一致なら統一前に報告)
- [ ] T2.5 `src/anthropic.ts` に `anthropicHeaders()` を新設し、skills-sync / files-download / credentials-upsert を置換
- [ ] T2.6 `WORKER_BUNDLE_VERSION` をバンプし、ローカル環境で Worker 再デプロイ確認

## T3. 共通 UI コンポーネント新設 (PR-AB 前半)

- [ ] T3.1 `desktop/components/ui/Button.tsx` (variant: primary / secondary / danger × size: sm / md) + テスト
- [ ] T3.2 `desktop/components/ui/Modal.tsx` (Modal / ModalHeader / ModalFooter、aria 属性・バックドロップ内包、overlay variant `z-[210]`) + テスト
- [ ] T3.3 `desktop/components/ui/FormField.tsx` (htmlFor 対応) + テスト
- [ ] T3.4 `desktop/components/ui/PasswordInput.tsx` (表示トグル) + テスト
- [ ] T3.5 `desktop/components/ui/ErrorAlert.tsx` / `LoadingPlaceholder.tsx` + テスト
- [ ] T3.6 全コンポーネントに `testId` パススルーがあること

## T4. 既存画面への適用 (PR-AB 後半 — 画面ごとに commit を分ける)

- [ ] T4.0 置換前の基準スクリーンショットを取得 (チャットパネル / Agent 編集モーダル / スキル追加モーダル / config 画面)
- [ ] T4.1 `AgentDetailModal.tsx` + `agent-detail/*`: Modal / Button / FormField に置換
- [ ] T4.2 `ConfirmDialog.tsx`: 内部実装を Modal (overlay) ベースに置換
- [ ] T4.3 `SkillAddModal.tsx` + `skill-add/*`: Modal / Button / ErrorAlert に置換
- [ ] T4.4 `config/ConfigScreen.tsx`: Button / PasswordInput / FormField に置換
- [ ] T4.5 settings 配下の残り (AccessPicker / SkillsPane 等) の該当パターンを置換
- [ ] T4.6 検証: 骨格クラス (`fixed inset-0 z-[200]` 等) が ui/ 以外に grep でヒットしない
- [ ] T4.7 置換後スクリーンショットを取得し T4.0 と比較、差分ゼロを確認
- [ ] T4.8 既存ユニットテスト / E2E green

## T5. 文言集約 (PR-C)

- [ ] T5.1 `core/copy/ja.ts` を新設 (common / agentDetail / skillAdd / config / chat 名前空間)
- [ ] T5.2 settings 配下の文言を COPY 参照に置換 (内容は不変)
- [ ] T5.3 config 配下の文言を COPY 参照に置換
- [ ] T5.4 chat (ChatPanel / Composer / MessageList 等) の文言を COPY 参照に置換
- [ ] T5.5 検証: diff に文言の内容変更が混入していないこと / 全テスト green
- [ ] T5.6 (任意) 文言ゆれの棚卸しメモを作成 (「エージェント」vs「Agent」等) — 修正自体は別作業とし、ここでは変更しない

## T6. 仕上げ

- [ ] T6.1 `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green
- [ ] T6.2 E2E 全スイートをローカル実行
- [ ] T6.3 実環境で主要画面の見た目を最終確認
- [ ] T6.4 `docs/development-guidelines.md` に「UI は ui/ の共通コンポーネントを使う」「文言は core/copy/ja.ts に置く」規約を追記

## 完了条件

- requirements.md の AC-1〜5 が全て満たされている
- 4 PR とも CI green でマージ済み
- スクリーンショット比較で見た目のリグレッションがないことを確認済み
