# タスクリスト: リファクタリング Phase 4 — 共通コンポーネント化 + 重複排除 + リポジトリ衛生

requirements.md / design.md に基づく実装タスク。T1 (衛生) は独立していつでも実施可。T2 (Worker) は Phase 1 完了後、T3〜T5 (UI / 文言) は Phase 3 完了後。

> **実施結果サマリ (2026-06-14)**
> 実コードに当てた結果、当初計画の前提が一部崩れたためスコープを調整して完了とした。
> - **PR-E (T1) / PR-D (T2): 計画どおり実施・マージ済み** (#80 / #82)
> - **PR-AB (T3/T4): スコープ縮小して実施・マージ済み** (#84)。Button / Modal / ErrorAlert は
>   画面ごとに角丸・padding・構造が異なり「見た目不変」を保てないため**対象外**とし、
>   重複が明確で安全な **FormField / PasswordInput のみ**を集約した。
> - **PR-C (T5): 中止**。テストフィクスチャを除くと本番コードに集約価値のある文言重複がほぼ無く
>   (汎用ボタンラベルの偶発一致のみ)、日本語の大半は単一利用のドメイン内容 (prompt / workflow)。
>   全文言の1ファイル集約はロケーリティを壊す高チャーン・低価値・「見た目不変」破壊リスクのため見送り。

## T1. リポジトリ衛生 (PR-E) — 独立・先行可 ✅ #80

- [x] T1.1 `.gitignore` に design-handoff の `*.jsx` / `*.tsx` パターンを追加
- [x] T1.2 `git rm -r --cached` で追跡中の書き出しファイル (68 件 + design_handoff_pebble_sprout) を index から除外 (ワーキングツリーには残す)
- [x] T1.3 検証: `git ls-files 'docs/design-handoff/**/*.jsx' 'docs/design-handoff/**/*.tsx'` が 0 件
- [ ] T1.4 `docs/presentations/` を作成し `kintone-cafe-vol29-lt-slides.md` を移動 — **未実施** (リファクタ対象外。スライドは現状リポジトリルートに untracked のまま。配置方針は別途判断)
- [x] T1.5 `docs/repository-structure.md` に「デザイン書き出しは Git 管理外」を追記

## T2. Worker 重複排除 (PR-D) ✅ #82

- [x] T2.1 `tools/factory.ts` に `toolResult(data)` を追加
- [x] T2.2 全ツール (~12 ファイル) の return 文を `toolResult()` に置換 (delete-records / download-file / get-record はレスポンス形が異なるため意図的に据え置き)
- [x] T2.3 検証: 既存テスト green / レスポンス JSON が不変であること
- [x] T2.4 3 ハンドラの `anthropic-version` / `anthropic-beta` の値が一致しているか確認 (一致を確認)
- [x] T2.5 `src/anthropic.ts` に `anthropicHeaders()` を新設し、skills-sync / files-download / credentials-upsert を置換
- [x] T2.6 `WORKER_BUNDLE_VERSION` をバンプし、ローカル環境で Worker 再デプロイ確認

## T3. 共通 UI コンポーネント新設 (PR-AB 前半) — スコープ縮小 ✅ #84

- [ ] T3.1 `desktop/components/ui/Button.tsx` — **対象外** (画面ごとに角丸 [7px]/[8px]・padding が異なり見た目不変を保てない)
- [ ] T3.2 `desktop/components/ui/Modal.tsx` — **対象外** (モーダルごとにタブ/バッジ等の構造差があり共通化で見た目が変わる)
- [x] T3.3 `desktop/components/ui/FormField.tsx` (ラベル付きラッパ)
- [x] T3.4 `desktop/components/ui/PasswordInput.tsx` (表示トグル)
- [ ] T3.5 `desktop/components/ui/ErrorAlert.tsx` / `LoadingPlaceholder.tsx` — **対象外** (警告ボックスの padding が4種混在しており統一で見た目が変わる)
- [ ] T3.6 全コンポーネントに `testId` パススルー — **未実施** (今回集約した2コンポーネントは既存呼出に testId 不要のため見送り)

## T4. 既存画面への適用 (PR-AB 後半) — スコープ縮小 ✅ #84

- [ ] T4.0 基準スクリーンショット取得 — **未実施** (Button/Modal 置換を行わず、クラス据え置きで DOM 不変のため目視確認に代替)
- [ ] T4.1 `AgentDetailModal.tsx`: Modal / Button 置換 — **対象外** (T3.1/T3.2 に同じ)。FormField は `DraftForm` で共通版に置換済み
- [ ] T4.2 `ConfirmDialog.tsx`: Modal 化 — **対象外**
- [ ] T4.3 `SkillAddModal.tsx`: Modal / Button / ErrorAlert 置換 — **対象外**。FormField は `SkillFileTab` / `SkillTextTab` で共通版に置換済み (`SkillFormField.tsx` 削除)
- [x] T4.4 `config/ConfigScreen.tsx`: PasswordInput (秘密情報3フィールド) に置換、`showApiKey`/`showSecret`/`showCfToken` state を削除 (Button は対象外)
- [ ] T4.5 settings 残り (AccessPicker / SkillsPane 等) — **対象外** (該当パターンが Button/Modal 中心のため)
- [x] T4.6 検証: クラス・プレースホルダ・`id` 据え置きで DOM/見た目が不変であること
- [ ] T4.7 置換後スクリーンショット比較 — **未実施** (上記により目視確認に代替)
- [x] T4.8 既存ユニットテスト green (plugin 954 tests)

## T5. 文言集約 (PR-C) — 中止 (集約価値なしと判断)

- [ ] T5.1 `core/copy/ja.ts` 新設 — **中止**
- [ ] T5.2 settings 文言を COPY 参照に置換 — **中止**
- [ ] T5.3 config 文言を COPY 参照に置換 — **中止**
- [ ] T5.4 chat 文言を COPY 参照に置換 — **中止**
- [ ] T5.5 検証 — **中止**
- [ ] T5.6 文言ゆれ棚卸しメモ — **中止** (将来 i18n 要件が出た時点で再検討)

## T6. 仕上げ

- [x] T6.1 `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green
- [x] T6.2 E2E / ユニットスイートをローカル実行 (plugin 954 + kintone-mcp 144 green)
- [x] T6.3 実環境で主要画面の見た目を最終確認 (Phase 3 完了時にユーザー動作確認済み + PR-AB は DOM 不変)
- [ ] T6.4 `docs/development-guidelines.md` への共通コンポーネント/文言規約の追記 — **未実施** (共通化が FormField/PasswordInput の2点に留まり、規約として明文化するほどの面ではないため見送り)

## 完了条件 (実施結果)

- requirements.md の AC のうち、**安全に「見た目不変」を保てる範囲を実施**。Button/Modal/文言の全面集約は
  見た目リグレッション・低価値churn のリスクが上回るため意図的にスコープ外とした。
- **実施した 3 PR (#80 / #82 / #84) は CI green でマージ済み**。
- クラス・id・プレースホルダ据え置きにより DOM レベルで見た目のリグレッションがないことを確認済み。
