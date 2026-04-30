# ファイル添付機能 (Step 1: Foundation) — 設計

> **デザインハンドオフ**: [docs/design_handoff_attachments/](../../docs/design_handoff_attachments/) に **High-fidelity** な仕様一式 (色 / spacing / 角丸 / アニメ / SVG アイコン) があり、本設計と整合させている。実装時は両方を参照。
> - `README.md`: 仕様の文章版
> - `reference/attachments.jsx`: AttachmentChip / AttachmentChipRow / UserMessageAttachments の参考実装 (デザインツール用 inline JSX、本番コードは TS + 既存スタイル規約に移植)
> - `reference/variant-rich.jsx`: Composer / UserMessage 改修箇所のリファレンス
> - `reference/data.jsx`: 5 状態のサンプルデータ
> - `reference/Cowork Agent Chat Panel.html`: デザインキャンバス全体

## 1. 全体像

```
┌── User ────────────────────────────────────────────────────┐
│  Composer の 📎 ボタン → <input type="file" multiple>      │
│   ↓ select                                                 │
│  chatStore.addAttachedFile (status: 'pending')             │
│   ↓                                                         │
│  useFileReader (新フック)                                   │
│   ├─ extension / size validation                           │
│   ├─ FileReader.readAsText  (text 系)                      │
│   ├─ FileReader.readAsDataURL (PDF / 画像) → base64 抽出    │
│   └─ updateAttachedFile (status: 'ready' | 'error')        │
│   ↓                                                         │
│  Composer chip (横並び、削除可)                             │
│   ↓ 送信ボタン                                              │
│  ChatPanel.handleSubmit                                     │
│   └─ buildUserMessageContent(text, attachedFiles)          │
│        ├─ text block 1 つ目 = ユーザー入力                  │
│        ├─ 添付ごとに対応 block (text/document/image)        │
│        └─ Array<ContentBlock>                              │
│   ↓                                                         │
│  postUserMessage(sessionId, contentArray)                   │
│   ↓                                                         │
│  events stream で Agent ターン進行                          │
└─────────────────────────────────────────────────────────────┘

メッセージ送信完了 → chatStore.clearAttachedFiles
```

## 2. データモデル

### 2.1 `AttachedFile` 型

新規ファイル [packages/plugin/src/core/files/types.ts](../../packages/plugin/src/core/files/types.ts):

```ts
/** content block 経路の判別 (拡張子から決まる) */
export type AttachmentKind = 'text' | 'document' | 'image';

export type AttachedFileStatus =
  | 'pending'   // 追加直後 (validation 前)
  | 'reading'   // FileReader 進行中
  | 'ready'     // 読込完了、送信可
  | 'error';    // バリデーション or 読込失敗

export interface AttachedFile {
  /** UI / 削除キー用。File オブジェクトの参照は持たない (送信後 GC させたい) */
  localId: string;
  filename: string;
  size: number;
  mimeType: string;
  kind: AttachmentKind;
  status: AttachedFileStatus;
  /** error 時のメッセージ */
  errorText?: string;
  /**
   * 読込完了 (status='ready') 後の content。
   * - kind=text → 文字列 (UTF-8 デコード済)
   * - kind=document/image → base64 文字列 (data: prefix なし)
   */
  content?: string;
}
```

### 2.2 拡張子 → kind / MIME マップ

```ts
export const EXTENSION_TO_KIND: Record<string, { kind: AttachmentKind; mime: string }> = {
  // text
  txt:   { kind: 'text', mime: 'text/plain' },
  md:    { kind: 'text', mime: 'text/markdown' },
  json:  { kind: 'text', mime: 'application/json' },
  csv:   { kind: 'text', mime: 'text/csv' },
  // document
  pdf:   { kind: 'document', mime: 'application/pdf' },
  // image
  png:   { kind: 'image', mime: 'image/png' },
  jpg:   { kind: 'image', mime: 'image/jpeg' },
  jpeg:  { kind: 'image', mime: 'image/jpeg' },
  gif:   { kind: 'image', mime: 'image/gif' },
  webp:  { kind: 'image', mime: 'image/webp' },
};
```

### 2.3 制限値

```ts
export const FILE_LIMITS = {
  /** 1 ファイルあたり max */
  perFileBytes: 10 * 1024 * 1024,    // 10 MB
  /** 1 メッセージあたり最大ファイル数 */
  maxFilesPerMessage: 10,
  /** 1 メッセージの合計サイズ警告閾値 (送信前 confirm) */
  warnTotalBytes: 30 * 1024 * 1024,  // 30 MB
};
```

### 2.4 chatStore 拡張

`ChatState` に追加:

```ts
attachedFiles: AttachedFile[];

addAttachedFile(file: AttachedFile): void;
updateAttachedFile(localId: string, patch: Partial<AttachedFile>): void;
removeAttachedFile(localId: string): void;
clearAttachedFiles(): void;
```

- `reset` / `startNewConversation` で `clearAttachedFiles` を併発
- 全 attachedFiles が `ready` のときだけ送信ボタンを enable する用に、Composer 側で `useChatStore((s) => s.attachedFiles)` で購読

## 3. ファイル読込 / base64 化

### 3.1 read 関数 ([core/files/read.ts](../../packages/plugin/src/core/files/read.ts) 新規)

```ts
export async function readAsText(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(r.error ?? new Error('FileReader error'));
    r.readAsText(file, 'utf-8');
  });
}

export async function readAsBase64(file: File): Promise<string> {
  // readAsDataURL で `data:<mime>;base64,<payload>` 形式を取得 → payload だけ返す
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(r.error ?? new Error('FileReader error'));
    r.readAsDataURL(file);
  });
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : '';
}
```

`readAsDataURL` を使う理由: `readAsArrayBuffer + btoa(String.fromCharCode(...))` だと数 MB 級で stack overflow になりやすい。`readAsDataURL` はブラウザが直接 base64 化するので安全 + 高速。

### 3.2 useFileReader hook ([desktop/hooks/useFileReader.ts](../../packages/plugin/src/desktop/hooks/useFileReader.ts) 新規)

```ts
/**
 * Composer の onAttach 経由で渡された File[] を順次:
 *   1. validateFile (extension / size)
 *   2. chatStore.addAttachedFile (status: 'reading')
 *   3. read 完了 → updateAttachedFile (status: 'ready')
 *   4. read 失敗 / バリデーション失敗 → updateAttachedFile (status: 'error')
 *
 * 並列処理 OK (Promise.allSettled で各 file 独立に処理)。
 */
export function useFileAttacher(): { attach: (files: FileList | File[]) => void } {
  ...
}
```

### 3.3 validateFile

```ts
export function validateFile(file: File, currentCount: number): { ok: true } | { ok: false; reason: string } {
  if (currentCount >= FILE_LIMITS.maxFilesPerMessage) {
    return { ok: false, reason: `添付は最大 ${FILE_LIMITS.maxFilesPerMessage} 件までです` };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSION_TO_KIND[ext]) {
    return { ok: false, reason: `未対応の拡張子です (.${ext})` };
  }
  if (file.size > FILE_LIMITS.perFileBytes) {
    return { ok: false, reason: `サイズ上限 (${FILE_LIMITS.perFileBytes / 1024 / 1024} MB) を超えています` };
  }
  return { ok: true };
}
```

## 4. UI 設計

### 4.1 Composer 改修

[packages/plugin/src/desktop/components/Composer.tsx](../../packages/plugin/src/desktop/components/Composer.tsx) を拡張:

- **左側に 📎 ボタン**を追加。クリックで `inputRef.current.click()` (隠し `<input type="file" multiple accept="...">`)
- ファイル選択 → `onAttach(files)` (props で受ける) を発火
- **添付チップ列を入力欄の上**に表示 (既に attachedFiles があるとき)
- 送信ボタンの `disabled` 条件を拡張: `disabled || running || hasReading || hasError`

#### Props 拡張

```ts
export interface ComposerProps {
  ...
  /** 添付ファイル一覧 (chatStore 由来) */
  attachedFiles?: AttachedFile[];
  /** 📎 ボタンクリック時 / ファイル選択時に呼ばれる */
  onAttach?: (files: FileList) => void;
  /** チップの ✕ ボタン */
  onRemoveAttachment?: (localId: string) => void;
}
```

ChatPanel が attachedFiles を chatStore から取って渡す + onAttach は useFileAttacher の attach を渡す。

### 4.2 添付チップ ([desktop/components/AttachmentChip.tsx](../../packages/plugin/src/desktop/components/AttachmentChip.tsx) 新規)

[docs/design_handoff_attachments/README.md §C](../../docs/design_handoff_attachments/README.md) の高精細仕様に従う。3 状態:

#### C-1 ready

- `padding: 6px 6px 6px 9px`, `border-radius: 8px`, `max-width: 220px`, `gap: 7px`
- bg: `c.card` (`#ffffff`) / border: `c.cardBorder` (`rgba(35,18,0,0.08)`)
- icon tile (左 18×18, `border-radius: 5px`): bg = `accentSoft` (`accent + 1a`), color = `accent`、kind ごとの inline SVG
- filename: 11.5px / weight 500 / color `c.text`、ellipsis
- subline: 9.5px / `c.muted`、形式 = `"PDF · 2.4 MB"` / `"テキスト · 12 KB"` / `"画像 · 1.1 MB"`
- 削除ボタン (右 18×18): X アイコン

#### C-2 reading

- bg: `c.cardHi` (`rgba(255,191,0,0.06)`) / border: `c.cardBorder`
- icon tile を **spinner** に置き換え (11×11、`border: 1.5px solid c.cardBorder`、`border-top-color: accent`、`animation: attach-spin 0.9s linear infinite`)
- subline: `"読込中…"`
- 削除ボタンは **非表示**

#### C-3 error

- bg: `c.warnSoft` (`#fef3c7`) / border: `c.warn + 55` (`#b4530955`)
- icon tile: bg = `#fff6e8`, color = `c.warn`、三角警告 SVG
- filename + subline: color = `c.warn`
- subline は `errorText` (例: `"未対応の拡張子"`, `"サイズ上限 (10 MB) 超過"`)
- 削除ボタンは表示

### 4.3 AttachmentChipRow (footer)

チップ列の下に 1 行 footer:
- `font-size: 10px`, color = `c.subtle` (通常) / `c.warn` (警告)
- 形式: `"3件 · 3.5 MB"` (通常) / `"5件 · 31.4 MB · ⚠ 合計サイズが大きめです"` (合計 ≥ 30 MB)
- 警告は **30 MB 以上** のみ表示。送信は止めない (注意喚起のみ)

### 4.4 Composer (添付あり時) のカード化

- 1px ボーダー + 14px 角丸の **カード 1 枚** で囲む
- `background: c.card`, `border: 1px solid c.border`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${accent}1a inset`
- 縦積み: AttachmentChipRow → 入力欄 + 📎 + 送信
- placeholder: 添付あり時は **「添付について聞く / 指示を入力...」**、ない時は既存の **「このアプリについて聞く / レコードを操作...」**
- Composer 内余白: 添付あり `padding: 6px 8px 8px 14px` / 添付なし `padding: 8px 8px 8px 14px`
- Chip 行 padding: `padding: 8px 10px 0`

### 4.5 UserMessage の添付ラベル (送信後)

メッセージバブルの**上部**に小さなラベル列:
- `display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; margin-bottom: 5px`
- 各ラベル: `padding: 3px 8px 3px 6px`、bg `c.card`、border `1px solid c.cardBorder`、`border-radius: 6px`、max-width 220px
- font-size 10.5px、左に kind icon (11×11, `color: accent`)、右に filename (`color: c.text`, weight 500, ellipsis)

### 4.6 アイコン (inline SVG)

`reference/attachments.jsx` 内の `ATTACHMENT_KIND_META` から移植:
- **text**: 横線が並ぶドキュメントアイコン
- **document** (PDF): 折り返し付きドキュメントアイコン
- **image**: 山 + 太陽の写真風アイコン
- **error**: 三角警告
- **削除**: X (細線)
- **添付ボタン**: ペーパークリップ

### 4.7 デザイントークン (light mode)

[docs/design_handoff_attachments/README.md §Design Tokens](../../docs/design_handoff_attachments/README.md) と同期。

| Token | Value | 用途 |
|---|---|---|
| `bg` | `#faf8f3` | パネル背景 |
| `panel` | `rgba(255,255,255,0.85)` | ヘッダ/フッタガラス |
| `border` | `rgba(35,18,0,0.10)` | 主区切り |
| `text` | `#231200` | 本文 |
| `muted` | `#6b5f4a` | 補助テキスト |
| `subtle` | `#a89d85` | 最小テキスト |
| `card` | `#ffffff` | カード/チップ ready 背景 |
| `cardBorder` | `rgba(35,18,0,0.08)` | カード境界 |
| `cardHi` | `rgba(255,191,0,0.06)` | chip reading 背景 |
| `accent` | `#0d9488` | プライマリ |
| `accentSoft` | `accent + 1a` | アイコンタイル背景 |
| `warn` | `#b45309` | エラー文字/枠線 |
| `warnSoft` | `#fef3c7` | エラー背景 |

### 4.8 アニメーション

```css
@keyframes attach-spin {
  to { transform: rotate(360deg); }
}
.attach-chip-spinner {
  animation: attach-spin 0.9s linear infinite;
}
```

`global.css` に追加 (既存の `cw-msg-completed` 等と同じ場所)。

## 5. メッセージ統合 (content block 組み立て)

### 5.1 buildUserMessageContent ([core/files/messageContent.ts](../../packages/plugin/src/core/files/messageContent.ts) 新規)

```ts
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string }; title?: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export function buildUserMessageContent(
  text: string,
  attachedFiles: AttachedFile[],
): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  for (const file of attachedFiles) {
    if (file.status !== 'ready' || !file.content) continue;
    if (file.kind === 'text') {
      // CSV / md / json / txt は text block に inline。区切り線で範囲を明確化
      blocks.push({
        type: 'text',
        text: `添付ファイル: ${file.filename}\n---\n${file.content}\n---`,
      });
    } else if (file.kind === 'document') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: file.mimeType, data: file.content },
        title: file.filename,
      });
    } else if (file.kind === 'image') {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.content },
      });
    }
  }

  // 最後にユーザー入力テキストを追加 (空でも block を作る)
  blocks.push({ type: 'text', text });

  return blocks;
}
```

### 5.2 ChatPanel.handleSubmit の改修

```ts
const handleSubmit = useCallback(
  async (text: string) => {
    const userId = ...;
    const filesSnapshot = useChatStore.getState().attachedFiles.filter((f) => f.status === 'ready');

    // UI 用: ユーザーメッセージは text + 添付ファイル名一覧 (チップ表示用) を持たせる
    addMessage({
      id: userId,
      kind: 'user',
      text,
      attachments: filesSnapshot.map((f) => ({ filename: f.filename, kind: f.kind })), // (UserMessage 型の拡張)
    });
    addMessage({ id: `pending-thinking-${Date.now()}`, kind: 'thinking' });
    setAgentRunning(true);

    // 送信完了前に attachedFiles をクリア (再送信防止)
    clearAttachedFiles();

    if (bindingStatus === 'unbound' || bindingStatus === 'error') {
      setPendingText(text);
      // pending には添付も含めたいので別途 pendingAttachments も保持する案 → MVP では添付ありの未バインド送信は非サポート (= 連携後は再添付してもらう)
      return;
    }

    try {
      const sid = await ensureSession();
      const content = buildUserMessageContent(text, filesSnapshot);
      await postUserMessage(sid, content);
    } catch {
      // 失敗時の握りつぶしは既存どおり
    }
  },
  [...],
);
```

### 5.3 UserMessage の型拡張

`MessageList.tsx` の `ChatMessage` union に user の attachments フィールドを追加:

```ts
| { id: string; kind: 'user'; text: string; attachments?: Array<{ filename: string; kind: AttachmentKind }> }
```

UI 上 user メッセージの上に小さな「📎 ファイル名」のラベルを並べる程度。送信後の history で「何を添付したか」が見えるようにする。

## 6. システムプロンプト更新

`DEFAULT_AGENT_SYSTEM_PROMPT` に追記し、`promptVersion` を v10 → **v11**:

```
【ファイル添付】
  - ユーザーは PDF / 画像 / テキスト系ファイル (CSV / Markdown / JSON 等) を
    メッセージに添付できます (content block として渡されます)。
  - CSV を添付された場合: 1 行目は見出しとして扱い、kintone への登録依頼なら
    kintone-get-form-fields でフィールド型を確認した上で kintone-add-records を
    使ってください。
  - 画像を添付された場合: 画像内容を読み取り (OCR / シーン解析)、
    必要に応じて kintone レコードに反映してください。
  - PDF を添付された場合: 内容を要約・抽出してください。長文の場合は
    重要箇所を引用しつつまとめます。
  - 添付ファイルがない通常の会話と同じガイドライン (kintone-* ツール / artifact 生成等) を
    引き続き適用してください。
```

## 7. 既存コードへの変更まとめ

| ファイル | 変更内容 |
|---|---|
| `core/files/types.ts` | (新規) `AttachedFile`, `AttachmentKind`, `EXTENSION_TO_KIND`, `FILE_LIMITS` |
| `core/files/read.ts` | (新規) `readAsText`, `readAsBase64` |
| `core/files/messageContent.ts` | (新規) `ContentBlock`, `buildUserMessageContent` |
| `core/files/validate.ts` | (新規) `validateFile` |
| `desktop/hooks/useFileAttacher.ts` | (新規) `attach(files)` を返すフック |
| `desktop/components/AttachmentChip.tsx` | (新規) チップ UI (3 状態: ready / reading / error) |
| `desktop/components/AttachmentChipRow.tsx` | (新規) チップ列 + footer (件数 / 合計サイズ / 警告) |
| `desktop/components/Composer.tsx` | 📎 ボタン + 添付チップ行 + 添付あり時のカード化 + placeholder 切替 |
| `desktop/components/MessageList.tsx` | UserMessage に attachments フィールド追加、表示拡張 |
| `desktop/components/MessageItem/UserMessage.tsx` | 添付 attachments を小さなラベルで表示 |
| `desktop/ChatPanel.tsx` | useFileAttacher を組み込み、handleSubmit で content 配列構築 |
| `store/chatStore.ts` | attachedFiles + add/update/remove/clear。reset / startNewConversation 連動 |
| `core/managed-agents/events.ts` | 既存 `postUserMessage` の content 配列対応は OK (string | Array) のまま使う |
| `core/bootstrap/resolveAgent.ts` | system プロンプト更新 + promptVersion v11 |
| `styles/global.css` | 添付チップのスタイル / アニメ |

## 8. テスト戦略

| レイヤ | テスト |
|---|---|
| `core/files/types.ts` | 拡張子マップの妥当性 (内部的なので最小限) |
| `core/files/validate.ts` | 拡張子 / サイズ / 件数のバリデーション網羅 |
| `core/files/messageContent.ts` | text / document / image 各 block の組み立て、複数添付 |
| `chatStore` | addAttachedFile / updateAttachedFile / removeAttachedFile / clearAttachedFiles / startNewConversation 連動 |
| `useFileAttacher` | File モックを渡して chatStore の状態遷移を検証 (vitest + jsdom 環境) |
| `Composer` | 📎 ボタンクリックで onAttach / chip 表示 / 送信 disable の挙動 |
| `AttachmentChip` | ready / reading / error 各状態 + ✕ ボタン |
| `ChatPanel` | 添付込み送信で `postUserMessage` が content 配列で呼ばれること |

実機検証 (manual):
- PDF 1 枚を添付して「要約して」 → 応答
- 画像 1 枚を添付して「何が写ってる?」 → 応答
- CSV を添付して「kintone のお客様アプリに登録して」 → kintone-add-records が走る
- 画像 + PDF 同時添付で「両方の関係を説明して」 → 応答
- 11 ファイル目添付 / 11MB のファイル / `.docx` を添付 → エラーチップ表示

## 9. ロールアウト / リスク

- **promptVersion bump (v10 → v11)** で既存ユーザーの Default Agent は新規作成される (旧 Agent は archive されず残る)。既存セッションは新 Agent に引き継がれない (既存挙動)
- **Anthropic API リクエストサイズ上限** が不明 (公式ドキュメントで明確な値は出ていない)。10MB × 10 ファイル + base64 化 = ~135MB は確実に超える。`F5-6` の 30 MB 警告で実用範囲に収める想定
- **base64 化の RAM 使用量** — 10 MB ファイルを base64 化すると ~13 MB の文字列が生成される。複数同時で 100 MB 超えると IE-class の古いブラウザで OOM の可能性 (kintone は Chrome/Edge 推奨なので実害は低い)
- **大きな PDF のトークン消費** — 10 MB PDF は数万トークン以上消費する可能性。**Anthropic 側の課金が増える**ことをユーザーが認識できるよう、Step 5 (今回非対象) で警告ダイアログを足したい
- **artifact 基盤との競合**: 同じ Composer / ChatPanel / chatStore に手を入れるが、領域は分離されているので衝突リスクは低い
- **デザインリファレンスの移植**: `docs/design_handoff_attachments/reference/*.jsx` は inline JSX + CSS-in-JS で書かれているが、本実装は **React + TypeScript + Tailwind / global.css** に合わせて移植する。色トークンは既存のテーマ変数 (`var(--cw-accent)` 等) と整合させる必要があり、ハンドオフの値とテーマ変数を 1 度マッピングする作業が初手で発生する

## 10. 段階分割 (本フェーズ内)

ハンドオフの「実装の出発点」 (README §実装の出発点) と整合させた順序:

1. **Day 1**: 型定義 (`AttachedFile` / `EXTENSION_TO_KIND` / `FILE_LIMITS`) + chatStore 拡張 + read / validate ヘルパー + 既存テスト維持
2. **Day 1 後半**: useFileAttacher hook + AttachmentChip / AttachmentChipRow (3 状態 + footer) を `reference/attachments.jsx` から TS 移植
3. **Day 2 前半**: Composer 改修 — 📎 ボタン + 添付あり時のカード化 + placeholder 切替 + 送信 disable 拡張
4. **Day 2 後半**: UserMessage に `attachments` フィールド + 上部ラベル列表示。ChatPanel.handleSubmit に `buildUserMessageContent` 統合
5. **Day 3**: system プロンプト + promptVersion v10 → v11 + 実機シナリオテスト (PDF / 画像 / CSV / 複数同時)
6. **仕上げ**: エラーケース確認 (10MB / 11 ファイル / 未対応拡張子) + 全 unit + E2E 確認
