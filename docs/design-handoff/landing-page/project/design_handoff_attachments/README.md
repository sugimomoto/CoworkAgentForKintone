# Handoff: ファイル添付機能 (Step 1: Foundation)

## Overview

Cowork Agent for kintone のチャットパネルに、メッセージ送信時に **PDF / 画像 / テキスト系ファイル (CSV / Markdown / JSON など)** を添付できる UI を追加します。

ユーザーフロー:

1. Composer 左下の 📎 ボタンを押す → ファイルピッカー
2. 選択したファイルが Composer 上部にチップ列として表示 (reading → ready 遷移)
3. 送信 → user メッセージ上部に小さなラベルとして残る
4. メッセージ送信完了 → `chatStore.clearAttachedFiles`

設計ドキュメントの完全版 (型定義 / chatStore 拡張 / read 関数 / system プロンプト改修等) は別途共有。本ハンドオフは **チャット側 UI** に絞った内容です。

## About the Design Files

`reference/` の HTML/JSX 一式は **デザインのリファレンス** であり、本番コードではありません。React + inline JSX + CSS-in-JS で書かれていますが、これは社内デザインツール上で動かすための形式です。

プロダクト本体のコードベース ([packages/plugin/src/desktop/](../../packages/plugin/src/desktop/)) は React + TypeScript + Zustand を使っており、そこに既存のスタイル / 状態管理パターンに合わせて **再実装** してください。HTML 側のスタイル値 (色 / 角丸 / spacing) は移植元として参照する形を想定しています。

## Fidelity

**High-fidelity** — 色 / spacing / typography / 角丸 / アニメーション挙動まで含めて確定値です。`reference/variant-rich.jsx` の既存 Composer / RichMessage と同じ語彙で書かれているので、そのまま値を移植してください。

## Screens / Views

### A. Composer (添付なし)

既存の `Composer.tsx` と同じ。`reference/variant-rich.jsx` の `RichComposer` を参照。

### B. Composer (添付あり)

- **構造**: 1px ボーダー + 14px 角丸の **カード1枚** で囲まれた領域に、以下を縦積み:
  1. **AttachmentChipRow** (上段): 横スクロール可能なチップ列 + footer (件数 · 合計サイズ · 警告)
  2. **入力欄 + 📎 ボタン + 送信ボタン** (下段): 既存の Composer 構造と同じ
- **カード**: `background: c.card` (light: `#ffffff`), `border: 1px solid c.border`, `border-radius: 14px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${accent}1a inset`
- **placeholder**: 添付がある時は「添付について聞く / 指示を入力...」、ない時は「このアプリについて聞く / レコードを操作...」
- **送信ボタン**: reading 中ファイルがある間 disabled (`background: c.border`, `color: c.muted`, `cursor: not-allowed`, `opacity: 0.7`)
- **📎 ボタン**: 既存 `richIconBtn` と同じ (30×30, 8px radius, `color: c.muted`, transparent bg)。クリックで隠し `<input type="file" multiple accept="...">` を発火

### C. AttachmentChip (3 状態)

サイズ: `padding: 6px 6px 6px 9px`, `border-radius: 8px`, `max-width: 220px`, `gap: 7px`

#### C-1. ready

- **bg**: `c.card` (light: `#ffffff`) / **border**: `c.cardBorder` (light: `rgba(35,18,0,0.08)`)
- **icon tile** (左, 18×18, `border-radius: 5px`): bg = `accent + 1a` (accentSoft), color = `accent`, kind ごとの SVG (text/document/image)
- **filename**: `font-size: 11.5px`, `font-weight: 500`, `color: c.text`, `text-overflow: ellipsis`
- **subline**: `font-size: 9.5px`, `color: c.muted`, 形式 = `"PDF · 2.4 MB"` / `"テキスト · 12 KB"` / `"画像 · 1.1 MB"`
- **削除ボタン** (右, 18×18): X アイコン, `color: c.muted`, transparent bg

#### C-2. reading

- **bg**: `c.cardHi` (light: `rgba(255,191,0,0.06)`) / **border**: `c.cardBorder`
- **icon tile**: kind icon の代わりに **spinner** (11×11, `border: 1.5px solid c.cardBorder`, `border-top-color: accent`, `animation: 0.9s linear infinite`)
- **subline**: `"読込中…"`
- **削除ボタン**: 非表示

#### C-3. error

- **bg**: `c.warnSoft` (light: `#fef3c7`) / **border**: `c.warn + 55` (light: `#b4530955`)
- **icon tile**: bg = `#fff6e8`, color = `c.warn`, **三角警告アイコン**
- **filename + subline**: color = `c.warn`
- **subline**: `errorText` を表示 (例: `"未対応の拡張子"`, `"サイズ上限 (10 MB) 超過"`)
- **削除ボタン**: 表示

### D. AttachmentChipRow (footer)

チップ列の下に1行:

- `font-size: 10px`, `color: c.subtle` (通常時) / `c.warn` (警告時)
- 形式: `"3件 · 3.5 MB"` (通常) / `"5件 · 31.4 MB · ⚠ 合計サイズが大きめです"` (合計 ≥ 30MB)
- 警告は **30 MB 以上** のときのみ表示 (送信は止めない、注意喚起のみ)

### E. UserMessage (送信後)

メッセージバブルの **上部** に小さなラベル列:

- `display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; margin-bottom: 5px`
- 各ラベル:
  - `padding: 3px 8px 3px 6px`, `background: c.card`, `border: 1px solid c.cardBorder`, `border-radius: 6px`
  - `font-size: 10.5px`, `color: c.muted`, `max-width: 220px`
  - 左に kind icon (11×11, `color: accent`)
  - 右に filename (`color: c.text`, `font-weight: 500`, ellipsis)

## Interactions & Behavior

### ファイル選択フロー

1. 📎 ボタンクリック → 隠し `<input type="file" multiple>` の `click()`
2. `onChange` で `FileList` を取得 → `useFileAttacher.attach(files)`
3. 各 File に対して並列に:
   - `validateFile(file, currentCount)` → 失敗なら status: `error` で chatStore に追加 (errorText つき)
   - 成功なら status: `reading` で追加 → `readAsText` or `readAsBase64` → status: `ready` に更新
4. UI は chatStore の `attachedFiles` を購読してリアクティブに更新

### 送信フロー

1. ユーザーが送信ボタンを押す
2. `attachedFiles.filter(f => f.status === 'ready')` をスナップショット
3. user メッセージを `attachments: [...]` 込みで追加
4. `clearAttachedFiles()` (再送信防止)
5. `buildUserMessageContent(text, files)` で content block 配列を構築
6. `postUserMessage(sessionId, content)` で送信

### バリデーション

- 拡張子: `txt | md | json | csv | pdf | png | jpg | jpeg | gif | webp` のみ
- per-file サイズ: 10 MB
- 件数: 1メッセージあたり最大 10 件
- 合計サイズ: 30 MB 以上で footer に警告 (送信は可能)

## State Management

新しい state は chatStore に集約:

```ts
// store/chatStore.ts に追加
attachedFiles: AttachedFile[];
addAttachedFile(file: AttachedFile): void;
updateAttachedFile(localId: string, patch: Partial<AttachedFile>): void;
removeAttachedFile(localId: string): void;
clearAttachedFiles(): void;
```

`reset` / `startNewConversation` で `clearAttachedFiles` を併発する。

UserMessage 型に `attachments?: Array<{ filename: string; kind: AttachmentKind }>` を追加。

## Design Tokens

ライトモード (`reference/variant-rich.jsx` の `richColors(false, accent)` から):

| トークン | 値 | 用途 |
|---|---|---|
| `bg` | `#faf8f3` | パネル背景 |
| `panel` | `rgba(255,255,255,0.85)` | ヘッダー/フッターガラス |
| `border` | `rgba(35,18,0,0.10)` | 主区切り |
| `text` | `#231200` | 本文 |
| `muted` | `#6b5f4a` | 補助テキスト |
| `subtle` | `#a89d85` | 最小テキスト |
| `card` | `#ffffff` | カード/チップ ready 背景 |
| `cardBorder` | `rgba(35,18,0,0.08)` | カード境界 |
| `cardHi` | `rgba(255,191,0,0.06)` | 強調背景 / chip reading 背景 |
| `accent` | `#0d9488` (デフォルト) | プライマリ / アイコン |
| `accentSoft` | `accent + 1a` | アイコンタイル背景 |
| `warn` | `#b45309` | エラー文字 / 枠線 |
| `warnSoft` | `#fef3c7` | エラー背景 |

ダークモードトークンは `richColors(true, accent)` を参照。

### Spacing / radius

| 用途 | 値 |
|---|---|
| Composer カード | `border-radius: 14px` |
| Chip | `border-radius: 8px` |
| Icon tile (chip 内) | `border-radius: 5px`, 18×18 |
| 削除ボタン | 18×18, `border-radius: 4px` |
| UserMessage 添付ラベル | `border-radius: 6px` |
| Composer 内余白 (添付あり) | `padding: 6px 8px 8px 14px` |
| Composer 内余白 (添付なし) | `padding: 8px 8px 8px 14px` |
| Chip 行 padding | `padding: 8px 10px 0` |

### Typography

| 要素 | サイズ / weight |
|---|---|
| Chip filename | 11.5px / 500 |
| Chip subline | 9.5px / 400 |
| Chip footer | 10px / 400 |
| UserMessage 添付ラベル | 10.5px (filename: 500) |
| Composer input | 13px / 400 |

### Animation

- spinner: `@keyframes attach-spin { to { transform: rotate(360deg); } }`, `0.9s linear infinite`

## Assets

新規アセットなし。アイコンはすべて inline SVG (`reference/attachments.jsx` 内)。

## Files

`reference/` フォルダ内:

| ファイル | 役割 |
|---|---|
| `Cowork Agent Chat Panel.html` | デザインキャンバス全体。`#attachments` セクションで5状態を並列表示 |
| `attachments.jsx` | **新規 UI コンポーネント** — `AttachmentChip`, `AttachmentChipRow`, `UserMessageAttachments`, `formatAttachmentSize`, `ATTACHMENT_KIND_META` |
| `variant-rich.jsx` | Composer / UserMessage の改修箇所 — `RichComposer` と `RichMessage` の `user` ブランチを参照 |
| `data.jsx` | `ATTACHMENT_SAMPLES` (5パターン) と `SENT_ATTACHMENTS_SAMPLE` |
| `design-canvas.jsx` / `artifact.jsx` / `styles.css` | デザインキャンバス共通基盤 (本機能の実装には直接関係なし) |

## 実装の出発点

1. `core/files/types.ts` を新規作成 (`AttachedFile`, `AttachmentKind`, `EXTENSION_TO_KIND`, `FILE_LIMITS`)
2. `core/files/read.ts` (`readAsText`, `readAsBase64`)
3. `core/files/validate.ts` (`validateFile`)
4. `chatStore` 拡張 (`attachedFiles` + 4 actions)
5. `desktop/hooks/useFileAttacher.ts` (`attach(files)` を返すフック)
6. `desktop/components/AttachmentChip.tsx` — `reference/attachments.jsx` の `AttachmentChip` を TypeScript + 既存スタイル規約に移植
7. `desktop/components/Composer.tsx` 改修 — 📎 ボタン + チップ列 + 送信 disable
8. `desktop/components/MessageItem/UserMessage.tsx` 改修 — `attachments` フィールドの表示
9. `core/files/messageContent.ts` (`buildUserMessageContent`)
10. `desktop/ChatPanel.tsx` の `handleSubmit` を content 配列対応に
11. `core/bootstrap/resolveAgent.ts` の system プロンプト + promptVersion bump
