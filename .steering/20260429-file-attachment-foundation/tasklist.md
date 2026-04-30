# ファイル添付機能 (Step 1: Foundation) — タスクリスト

> 状態: ☐ 未着手 / 🔄 着手中 / ✅ 完了
>
> 関連: [requirements.md](./requirements.md) / [design.md](./design.md) / Issue #16
> デザインハンドオフ: [docs/design_handoff_attachments/](../../docs/design_handoff_attachments/)

## 進め方 (TDD)

各機能ユニットは **Red → Green → Refactor** の順で進める:

1. **Red**: 失敗するテストを書く (期待する I/O / DOM / state を仮定)
2. **Green**: 最小実装でテストを通す
3. **Refactor**: ハンドオフ仕様 (色 / spacing 等) や既存コード規約に合わせて整える

UI コンポーネントは「スケルトン → テスト → 実装」の順 (空コンポーネントを置かないとテストが書けないため)。各セクションのチェックリストは **テストタスクから始まる** ように並べてある。

---

## 1. 型定義 / 制約値 (`core/files/`)

- [ ] **1-1 [Red]** [types.test.ts](../../packages/plugin/src/core/files/types.test.ts) を新設し、以下を期待するテストを書く:
  - `EXTENSION_TO_KIND` に 10 種 (txt/md/json/csv/pdf/png/jpg/jpeg/gif/webp) が揃っている
  - 各拡張子の `kind` (text/document/image) が想定どおり
  - `FILE_LIMITS.perFileBytes === 10 * 1024 * 1024`、`maxFilesPerMessage === 10`、`warnTotalBytes === 30 * 1024 * 1024`
- [ ] **1-2 [Green]** [types.ts](../../packages/plugin/src/core/files/types.ts) を新設して上記テストが pass する最小実装

## 2. ファイル読込

- [ ] **2-1 [Red]** [read.test.ts](../../packages/plugin/src/core/files/read.test.ts) を新設:
  - `readAsText(blob)` が UTF-8 で正しくデコードする (jsdom + `Blob`)
  - `readAsBase64(blob)` が `data:` prefix 無しの base64 文字列を返す
  - 既知バイト列 (例: `[0x89, 0x50, 0x4E, 0x47]`) に対して期待値と一致する
- [ ] **2-2 [Green]** [read.ts](../../packages/plugin/src/core/files/read.ts) を実装 (`readAsDataURL` + `,` 以降抽出)

## 3. バリデーション

- [ ] **3-1 [Red]** [validate.test.ts](../../packages/plugin/src/core/files/validate.test.ts) を新設、以下のケース:
  - 拡張子 OK / NG (`.docx` 等の未対応)
  - サイズ OK / NG (10 MB ピッタリ OK / +1 byte NG)
  - 件数 OK / NG (現在 9 → OK / 10 → NG)
  - 拡張子無し (`README` 等) → NG
- [ ] **3-2 [Green]** [validate.ts](../../packages/plugin/src/core/files/validate.ts) を実装

## 4. content block 組み立て

- [ ] **4-1 [Red]** [messageContent.test.ts](../../packages/plugin/src/core/files/messageContent.test.ts) を新設:
  - 空 files + text → text block 1 個
  - text 系ファイル 1 個 → 添付 text block + ユーザー text block の 2 個、形式が `添付ファイル: <name>\n---\n<本文>\n---`
  - PDF 1 個 → document block (`source.type === 'base64'` / `media_type === 'application/pdf'`) + ユーザー text block
  - 画像 1 個 → image block + ユーザー text block
  - 複数 (画像 + PDF + CSV) → 添付順に並ぶ + 最後にユーザー text
  - `status !== 'ready'` のものは除外される
- [ ] **4-2 [Green]** [messageContent.ts](../../packages/plugin/src/core/files/messageContent.ts) を実装

## 5. chatStore 拡張

- [ ] **5-1 [Red]** [chatStore.test.ts](../../packages/plugin/src/store/chatStore.test.ts) に describe('attachedFiles') を追加:
  - 初期値は空配列
  - `addAttachedFile` で末尾に追加
  - `updateAttachedFile(id, patch)` で部分更新、該当無しは no-op
  - `removeAttachedFile(id)` で削除
  - `clearAttachedFiles()` で空に
  - `startNewConversation` / `reset` で空に戻る
- [ ] **5-2 [Green]** chatStore.ts に `attachedFiles` state + 4 actions + reset/startNewConversation 連動

## 6. useFileAttacher フック

- [ ] **6-1 [Red]** [useFileAttacher.test.ts](../../packages/plugin/src/desktop/hooks/useFileAttacher.test.ts) を新設 (jsdom + `Blob`):
  - `attach([validFile])` で chatStore に reading → ready の遷移が起きる
  - 未対応拡張子 → 即座に status='error' で追加 (errorText 付き)
  - 11 個目 → 件数超過エラーで追加されない (or error チップ追加のみ)
  - 11 MB ファイル → サイズ超過エラー
  - 複数を並列 attach できる (Promise.allSettled)
- [ ] **6-2 [Green]** [useFileAttacher.ts](../../packages/plugin/src/desktop/hooks/useFileAttacher.ts) を実装

## 7. AttachmentChip / AttachmentChipRow

- [ ] **7-1 [Red]** [AttachmentChip.test.tsx](../../packages/plugin/src/desktop/components/AttachmentChip.test.tsx) を新設:
  - status='ready' → filename + subline (例: `PDF · 2.4 MB`) + 削除ボタンが表示される
  - status='reading' → spinner 要素 + `読込中…` + 削除ボタン非表示
  - status='error' → errorText + 警告アイコン + 削除ボタン
  - 削除ボタンクリックで `onRemove` が呼ばれる
- [ ] **7-2 [Red]** [AttachmentChipRow.test.tsx](../../packages/plugin/src/desktop/components/AttachmentChipRow.test.tsx) を新設:
  - 1 個ある → footer に `1件 · NN KB`
  - 合計 30 MB 未満 → footer に警告無し
  - 合計 30 MB 以上 → footer に `⚠ 合計サイズが大きめです`
- [ ] **7-3 [Green]** [AttachmentChip.tsx](../../packages/plugin/src/desktop/components/AttachmentChip.tsx) を実装 (3 状態 + ハンドオフの SVG アイコン移植)
- [ ] **7-4 [Green]** [AttachmentChipRow.tsx](../../packages/plugin/src/desktop/components/AttachmentChipRow.tsx) を実装
- [ ] **7-5 [Refactor]** ハンドオフのカラートークンを既存 theme と整合 (`var(--cw-card)` / `var(--cw-muted)` 等にマッピング)。不足分 (`cardHi` / `accentSoft` / `warnSoft` / `warn`) は theme か global.css に追加
- [ ] **7-6 [Refactor]** [global.css](../../packages/plugin/src/styles/global.css) に `@keyframes attach-spin` を追加

## 8. Composer 改修

- [ ] **8-1 [Red]** [Composer.test.tsx](../../packages/plugin/src/desktop/components/Composer.test.tsx) に新規ケース:
  - 📎 ボタンが描画される
  - 添付あり (`attachedFiles.length > 0`) で placeholder が「添付について聞く / 指示を入力...」に切替
  - `reading` 状態のチップがある間は送信ボタン disabled
  - `error` 状態のチップがある間は送信ボタン disabled
- [ ] **8-2 [Red]** Composer test に「📎 クリックで `<input type="file">` の click が起動 → onChange で onAttach が呼ばれる」ケース (`vi.spyOn(input, 'click')` 等)
- [ ] **8-3 [Green]** [Composer.tsx](../../packages/plugin/src/desktop/components/Composer.tsx) に props 追加 (`attachedFiles` / `onAttach` / `onRemoveAttachment`)、📎 ボタン + 隠し input + AttachmentChipRow 配置
- [ ] **8-4 [Green]** 添付あり時のカード化 (`border-radius: 14px` / 1px border / box-shadow) と placeholder 切替
- [ ] **8-5 [Refactor]** ハンドオフ仕様の余白値 (`padding: 6px 8px 8px 14px` 等) を厳密に反映

## 9. UserMessage に attachments

- [ ] **9-1 [Red]** [UserMessage.test.tsx](../../packages/plugin/src/desktop/components/MessageItem/UserMessage.test.tsx) に新規ケース:
  - `attachments` 無しなら従来通り
  - `attachments=[{filename, kind}]` でラベル列が描画される (filename / kind icon)
  - 複数 attachments で flex-wrap される
- [ ] **9-2 [Red]** [MessageList.test.tsx](../../packages/plugin/src/desktop/components/MessageList.test.tsx) に user メッセージの attachments がレンダリングされるケース
- [ ] **9-3 [Green]** [MessageList.tsx](../../packages/plugin/src/desktop/components/MessageList.tsx) の `ChatMessage` user union に `attachments?` を追加
- [ ] **9-4 [Green]** [UserMessage.tsx](../../packages/plugin/src/desktop/components/MessageItem/UserMessage.tsx) に上部ラベル列を実装
- [ ] **9-5 [Refactor]** ハンドオフ仕様 (`padding: 3px 8px 3px 6px` / `border-radius: 6px` / `font-size: 10.5px`) を厳密に

## 10. ChatPanel 統合

- [ ] **10-1 [Red]** [ChatPanel.test.tsx](../../packages/plugin/src/desktop/ChatPanel.test.tsx) に新規ケース:
  - 添付ありで送信 → `postUserMessage` が **content 配列** で呼ばれる (string ではない)
  - 送信完了後 attachedFiles が空になる
  - user メッセージに `attachments` フィールドが残る
- [ ] **10-2 [Green]** [ChatPanel.tsx](../../packages/plugin/src/desktop/ChatPanel.tsx) に `useFileAttacher` を組み込み、Composer に props を渡し、`handleSubmit` で `buildUserMessageContent` 経由 + `clearAttachedFiles` を実装

## 11. system プロンプト + promptVersion bump

- [ ] **11-1 [Red]** [resolveAgent.test.ts](../../packages/plugin/src/core/bootstrap/resolveAgent.test.ts) の `promptVersion` アサーションを `'v11'` へ (= まず Red にする)
- [ ] **11-2 [Red]** test/fixtures.ts も `'v11'` に更新 (現状 `'v10'`)
- [ ] **11-3 [Green]** [resolveAgent.ts](../../packages/plugin/src/core/bootstrap/resolveAgent.ts) の `DEFAULT_AGENT_PROMPT_VERSION` を `'v11'` に
- [ ] **11-4 [Green]** `DEFAULT_AGENT_SYSTEM_PROMPT` に「【ファイル添付】」ブロック (PDF / 画像 / CSV の取り扱いガイド) を追記

## 12. 実機シナリオテスト

- [ ] **12-1** kintone 上で `pnpm plugin:deploy` 後、以下を手動検証:
  - [ ] PDF を添付して「要約して」 → Agent が PDF 内容を要約
  - [ ] 画像 (PNG) を添付して「何が写ってる?」 → Agent が画像内容を説明
  - [ ] CSV を添付して「お客様アプリに登録して」 → `kintone-add-records` 成功
  - [ ] **複数同時**: 画像 + PDF を 1 メッセージで添付 → 両方を踏まえて応答
  - [ ] **エラー**: 11 個目 / 11 MB / `.docx` → 添付前にエラーチップ
  - [ ] 添付チップの ✕ で取消できる
  - [ ] 送信完了 → attachedFiles クリア + UserMessage に添付ラベル残る
- [ ] **12-2** 既存シナリオ (テキストのみ / artifact 生成 / kintone 操作) が壊れていない

## 13. テスト / ビルド全体パス

- [ ] **13-1** `pnpm -C packages/plugin test` 全件 pass (新規 +20 件程度の見込み)
- [ ] **13-2** `pnpm -C packages/plugin build` 成功 + bundle size 増分が **+15 KB (gzipped) 以内**
- [ ] **13-3** `pnpm -C packages/kintone-mcp test` 既存全件 pass
- [ ] **13-4** `pnpm plugin:e2e -- artifact-foundation` 既存 E2E 緑

## 完了条件

- requirements.md の受入条件すべて ✅
- 12-1 のシナリオすべて ✅
- 既存テスト割らない ✅

---

## ハンドオフ移植チェックリスト (Refactor フェーズで確認)

`reference/attachments.jsx` から本番コードへの移植時に、以下の値を 1 対 1 で保つこと。

- [ ] チップサイズ: `padding: 6px 6px 6px 9px` / `border-radius: 8px` / `max-width: 220px`
- [ ] チップ icon tile: 18×18 / `border-radius: 5px`
- [ ] チップ削除ボタン: 18×18 / `border-radius: 4px`
- [ ] filename: 11.5px / weight 500 / ellipsis
- [ ] subline: 9.5px / `c.muted`
- [ ] reading spinner: 11×11 / `border: 1.5px solid c.cardBorder` / `border-top-color: accent` / `0.9s linear infinite`
- [ ] error 三角警告: bg `#fff6e8` / icon `c.warn`
- [ ] Composer カード: `border-radius: 14px` / `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${accent}1a inset`
- [ ] Composer 余白: 添付あり `padding: 6px 8px 8px 14px` / なし `padding: 8px 8px 8px 14px`
- [ ] Chip 行 padding: `padding: 8px 10px 0`
- [ ] UserMessage 添付ラベル: `padding: 3px 8px 3px 6px` / `border-radius: 6px` / `font-size: 10.5px`
- [ ] アニメ keyframe 名: `attach-spin`
