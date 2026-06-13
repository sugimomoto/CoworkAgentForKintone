# 設計: リファクタリング Phase 4 — 共通コンポーネント化 + 重複排除 + リポジトリ衛生

## 概要

requirements.md のスコープ A〜E を 4 PR で実施する。A+B (UI 共通化) が本体、C (文言集約) / D (Worker 重複排除) / E (リポジトリ衛生) は独立。E はフェーズ順序に依存せず先行実施可能。

Phase 3 完了が前提 (A+B のみ。分割済みの小さいコンポーネントに適用するため)。

## A. 共通 UI コンポーネント

### 配置と方針

```
desktop/components/ui/
├── Modal.tsx          … Modal / ModalHeader / ModalFooter
├── Button.tsx         … variant × size
├── FormField.tsx      … ラベル + フィールドのラッパ
├── PasswordInput.tsx  … 表示トグル付き input
├── ErrorAlert.tsx     … warn 系エラーボックス (+ 任意の再試行ボタン)
└── LoadingPlaceholder.tsx
```

- スタイルは**既存のクラス文字列をそのまま定数化** (デザイントークンの変更はしない)
- クラス合成は既存依存の `clsx` + `tailwind-merge` を使用
- 各コンポーネントに `data-testid` パススルー (`testId?: string`) を持たせ、E2E 互換を保つ

### Modal

```typescript
export interface ModalProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  /** Tailwind 幅クラス。default 'w-[680px]' */
  widthClass?: string;
  /** バックドロップクリックで閉じるか。default true */
  closeOnBackdrop?: boolean;
  testId?: string;
}
```

- `role="dialog"` / `aria-modal="true"` / バックドロップ `bg-black/40` / 内側クリックの `stopPropagation` を内包
- z-index は現行の `z-[200]` を踏襲。ConfirmDialog (Phase 3 で新設済み) は Modal の上に重なるため `z-[210]` の overlay variant を持つ
- ESC で閉じる挙動は**現行に存在しないため追加しない** (挙動不変の原則。導入するなら別作業)

### Button

```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';  // default 'secondary'
  size?: 'sm' | 'md';                            // default 'md'
}
```

クラスは現行 3 系統をそのまま採用:
- primary: `bg-accent text-white hover:opacity-90 font-semibold`
- secondary: `border border-border text-text hover:bg-card-hi`
- danger: `border border-warn/40 text-warn hover:bg-warn-soft`
- 共通: `rounded-[7px] disabled:opacity-50` + size 別 padding/text

`loading` prop は持たせない (現行はボタンごとに「保存中…」等の文言を出し分けており、文言は呼び出し側の責務とする)。

### FormField / PasswordInput / ErrorAlert / LoadingPlaceholder

- `FormField`: `label` + children のラッパ (現行の `text-[10.5px] font-semibold text-muted` ラベル様式)。`htmlFor` を受け、明示的ラベル関連付けに対応
- `PasswordInput`: `pr-[64px]` + 右端の「表示/隠す」トグル (現 ConfigScreen の実装を移植)
- `ErrorAlert`: `border-warn/30 bg-warn-soft text-warn` ボックス、`onRetry?` 付き
- `LoadingPlaceholder`: `読み込み中...` の定型

## B. 既存画面への適用

対象 (Phase 3 分割後のファイル):

| 画面 | 置換対象 |
|---|---|
| `AgentDetailModal.tsx` | モーダル骨格 → Modal、フッターボタン 3 種 → Button |
| `agent-detail/DraftForm.tsx` ほかセクション | ラベル付きフィールド → FormField |
| `SkillAddModal.tsx` / `skill-add/*` | モーダル骨格 → Modal、ボタン → Button、エラーボックス → ErrorAlert |
| `desktop/components/ConfirmDialog.tsx` | 内部実装を Modal (overlay variant) ベースに置換 |
| `config/ConfigScreen.tsx` | ボタン → Button、パスワード入力 → PasswordInput、フィールド → FormField |
| その他 settings 配下 (AccessPicker / SkillsPane 等) | 該当パターンがあれば同様に置換 |

検証は **見た目の同一性**: 置換前後で主要画面のスクリーンショットを取得し比較する (Playwright の screenshot を流用)。ピクセル完全一致までは求めないが、レイアウト・配色・余白の目視差分ゼロを確認する。

## C. 文言の集約 (core/copy/ja.ts)

### 設計

```typescript
// core/copy/ja.ts — フラットな名前空間オブジェクト。i18n ライブラリは導入しない
export const COPY = {
  common: {
    save: '保存', saving: '保存中…', cancel: 'キャンセル', delete: '削除',
    loading: '読み込み中...', retry: '再試行',
  },
  agentDetail: {
    editTitle: (name: string) => `${name} を編集`,
    createTitle: 'カスタム エージェントを追加',
    resetToDefault: '初期値に戻す',
    // ...
  },
  skillAdd: { /* ... */ },
  config: { /* ... */ },
  chat: { /* ... */ },
} as const;
```

確定事項:

- **適用範囲は settings / config / chat 配下の UI 文言**。core 内のエラーメッセージ (debug ログ等) は対象外
- 引数を取る文言は関数として定義 (テンプレート崩れを型で防ぐ)
- 文言の内容は 1 字も変えない (純粋な移動)。移行 PR の diff レビューで文言変更が混入していないことを確認する
- Button の `loading` を持たせない判断 (design A) と整合: 「保存中…」等は COPY から呼び出し側が渡す

## D. Worker の重複排除

### toolResult ヘルパー

`packages/kintone-mcp/src/tools/factory.ts` に追加:

```typescript
export function toolResult(data: unknown): CallToolResult {
  return {
    structuredContent: data as Record<string, unknown>,
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}
```

全ツール (~12 ファイル) の return 文を `return toolResult(result);` に置換。**出力 JSON はバイト単位で不変** (テストのスナップショットが変わらないこと)。

### anthropicHeaders ヘルパー

`packages/kintone-mcp/src/anthropic.ts` (新設):

```typescript
export function anthropicHeaders(apiKey: string, beta?: string): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    ...(beta ? { 'anthropic-beta': beta } : {}),
  };
}
```

`skills-sync.ts` / `files-download.ts` / `credentials-upsert.ts` の手書きヘッダ構築を置換。各ファイルで `anthropic-version` の値が一致していることを移行時に確認 (不一致が見つかった場合は挙動変更になるため、要確認事項として報告してから統一する)。

Worker 変更のため `WORKER_BUNDLE_VERSION` をバンプする (機能変更なしの patch)。

## E. リポジトリ衛生

1. `.gitignore` に追加:
   ```gitignore
   # Design tool exports (re-exportable, not source)
   docs/design-handoff/**/*.jsx
   docs/design-handoff/**/*.tsx
   docs/design_handoff_pebble_sprout/*.jsx
   ```
2. 追跡解除: `git rm -r --cached` で該当 68 ファイル + `docs/design_handoff_pebble_sprout/*.jsx` を index から外す (ワーキングツリーには残す)
3. `docs/presentations/` を作成し `kintone-cafe-vol29-lt-slides.md` を移動 (現在未追跡。移動後にコミットするかは登壇資料の管理方針としてユーザーに確認 — デフォルトはコミットする)
4. `docs/repository-structure.md` に design-handoff の扱い (書き出し成果物は Git 管理外) を追記

## 影響範囲

- UI: 見た目・文言・挙動の変更なし (スクリーンショット比較で担保)
- Worker: レスポンス不変。バンドルバージョンのみ更新
- E2E: data-testid 維持により無変更で green の想定
- git 履歴: design-handoff の JSX は履歴には残る (履歴書き換えはしない)

## PR 分割と順序

1. **PR-E**: リポジトリ衛生 — 他と独立、**いつでも実施可** (Phase 1 より先でも良い)
2. **PR-D**: Worker 重複排除 — Phase 1 完了後ならいつでも可
3. **PR-AB**: UI 共通コンポーネント新設 + 置換 (Phase 3 完了後)。コンポーネント新設 commit → 画面ごとの置換 commit に分ける
4. **PR-C**: 文言集約 (PR-AB 完了後。共通コンポーネント化で文言の所在が確定してから)
