# 要求: リファクタリング Phase 4 — 共通コンポーネント化 + 重複排除 + リポジトリ衛生

## 背景

2026-06-11 実施のコードベース全体レビューで、plugin の UI 層と kintone-mcp Worker の双方に、コピー&ペーストで増殖したパターンが確認された。

### plugin UI 層の重複

1. **モーダル骨格** — `AgentDetailModal.tsx` / `SkillAddModal.tsx` (および削除確認オーバーレイ) が、`fixed inset-0 z-[200] bg-black/40` のバックドロップ + ヘッダー (タイトル / サブタイトル / 閉じるボタン) + スクロールボディ + フッターという同一構造を各自実装している
2. **ボタンスタイル** — primary (`bg-accent text-white`) / secondary (`border border-border hover:bg-card-hi`) / danger (`border-warn/40 text-warn`) の Tailwind クラス塊が 6 箇所以上で複製
3. **フォームフィールド** — ラベル + input/textarea のパターン、パスワード表示トグル付き input が `AgentDetailModal` / `SkillAddModal` / `ConfigScreen` で複製
4. **ローディング / エラー表示** — `読み込み中...` プレースホルダと `border-warn/30 bg-warn-soft` のエラーボックスが複数箇所で複製
5. **日本語文言の散在** — UI 文言が JSX 直書き (AgentDetailModal だけで 27 箇所)。文言の監査・統一が困難

### kintone-mcp Worker の重複

6. **ツール結果整形** — `{ structuredContent, content: [{ type: 'text', text: JSON.stringify(...) }] }` のボイラープレートが約 12 ツールで複製
7. **Anthropic API ヘッダ構築** — `X-Api-Key` / `anthropic-version` / `anthropic-beta` の組み立てが `skills-sync.ts` / `files-download.ts` / `credentials-upsert.ts` の 3 箇所で複製

### リポジトリ衛生

8. `docs/design-handoff/` 配下にデザインツール書き出しの JSX/TSX が 68 ファイルコミットされている (再書き出し可能な生成物)
9. リポジトリルートに発表スライド `kintone-cafe-vol29-lt-slides.md` が未追跡のまま放置されている

## ゴール

- UI の見た目を変えずに、繰り返しパターンを共通コンポーネント / ヘルパーに集約する (推定 300〜400 行削減)
- 今後のスタイル変更 (テーマ調整等) が 1 箇所の修正で済む状態にする
- 文言を 1 ファイルから監査できる状態にする
- リポジトリから再生成可能な生成物・置き場違いのファイルを整理する

## スコープ

- **A. 共通 UI コンポーネント新設** (`packages/plugin/src/desktop/components/ui/` 等):
  - `Modal` (+ `ModalHeader` / `ModalFooter`) — role="dialog" / aria-modal / バックドロップクリックで閉じる挙動を内包
  - `Button` — variant (primary / secondary / danger) × size (sm / md)、loading / disabled 対応
  - `FormField` / `PasswordInput` — ラベル付きフィールドと表示トグル付きパスワード入力
  - `AsyncStateView` または `ErrorAlert` + `LoadingPlaceholder` — ローディング / エラーの定型表示
- **B. 既存画面への適用**: `AgentDetailModal` / `SkillAddModal` / `ConfigScreen` / その他モーダル類のインラインクラス塊を共通コンポーネントに置換
- **C. 文言の集約**: `packages/plugin/src/core/copy/ja.ts` (新設) に UI 文言定数を集約し、主要画面 (settings / config / chat) の直書き文言を置換。i18n フレームワークは導入しない (将来の多言語化の下準備に留める)
- **D. Worker の重複排除**:
  - `toolResult(data)` ヘルパーを `tools/factory.ts` に追加し全ツールで使用
  - `anthropicHeaders(apiKey, beta?)` ヘルパーを新設し 3 ハンドラで使用
- **E. リポジトリ衛生**:
  - `.gitignore` に `docs/design-handoff/**/*.jsx` / `**/*.tsx` を追加し、追跡済みの 68 ファイルを `git rm --cached` で除外
  - `kintone-cafe-vol29-lt-slides.md` を `docs/presentations/` へ移動 (または削除を確認のうえ実施)

### スコープ外

- デザイン変更・新しい variant の追加 (既存の見た目の再現のみ)
- react-i18next 等の i18n ライブラリ導入
- landing パッケージへの共通コンポーネント適用 (Astro 側は対象外)

## ユーザーストーリー

### US-1: プラグイン開発者 (UI 改修担当)

> 私はブランドカラー変更やボタンの角丸調整を頼まれることがある。**Button コンポーネント 1 箇所を直せば全画面に反映される**なら、6 箇所の Tailwind クラス塊を grep して回る必要がなくなり、直し漏れによる画面間の不統一も起きない。

### US-2: 新しくモーダルを追加する開発者

> 新機能でモーダルを 1 つ追加したい。**`<Modal title=... footer=...>` に中身を渡すだけ**で、aria 属性・バックドロップ・ESC/外側クリックの挙動が既存モーダルと揃うのが理想だ。

### US-3: プロダクトオーナー (文言品質)

> UI の文言ゆれ (「エージェント」と「Agent」の混在など) を監査したい。**`ja.ts` を 1 ファイル読めば全文言を確認できる**状態なら、リリース前のコピー確認が現実的な作業になる。

### US-4: リポジトリのメンテナ

> clone やコードレビューのとき、**デザインツールの書き出し JSX 68 ファイルが検索や blame に混ざらない**でほしい。

## 受け入れ条件

### AC-1: 共通コンポーネントが存在し、既存画面が使用している

- `Modal` / `Button` / `FormField` / `PasswordInput` / エラー・ローディング表示の共通コンポーネントが存在し、それぞれユニットテストを持つ
- `AgentDetailModal` / `SkillAddModal` / `ConfigScreen` にモーダル骨格・ボタン・フォームフィールドのインライン実装が残っていない (`grep` で `fixed inset-0 z-\[200\]` 等の骨格クラスがコンポーネント外にヒットしない)

### AC-2: 見た目のリグレッションがない

- 置換前後でスクリーンショット比較 (主要画面: チャットパネル / Agent 編集モーダル / スキル追加モーダル / config 画面) に意図しない差分がない
- 既存ユニットテスト / E2E が green

### AC-3: 文言が集約されている

- `core/copy/ja.ts` が存在し、settings / config 配下のコンポーネントの表示文言がこれを参照している
- 文言の内容自体は変更されていない (純粋な移動)

### AC-4: Worker の重複が解消されている

- 全ツールが `toolResult()` を使用し、`structuredContent + JSON.stringify` の手書きボイラープレートが残っていない
- Anthropic ヘッダ構築が `anthropicHeaders()` 1 箇所に集約
- kintone-mcp の既存テストが全て green (出力形式は不変)

### AC-5: リポジトリ衛生

- `git ls-files 'docs/design-handoff/**/*.jsx' 'docs/design-handoff/**/*.tsx'` が 0 件
- リポジトリルートに発表スライドが存在しない (docs/presentations/ へ移動済みまたは削除済み)

## 制約事項

- Phase 3 (God ファイル分割) 完了後に着手する (分割済みの小さいコンポーネントに適用する方が安全なため)。ただし **E (リポジトリ衛生) は独立しており、いつでも先行実施可能**
- 見た目・挙動・文言の内容は一切変えない (純粋な構造変更)
- 新規ライブラリは追加しない (clsx / tailwind-merge など既存依存の範囲で実装)
- PR は A+B (UI 共通化) / C (文言) / D (Worker) / E (衛生) で分割する
- 各 PR で `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green を維持
