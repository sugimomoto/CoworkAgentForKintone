# プラグイン: 添付ファイルを kintone へ自動 upload — 設計

## 1. kintone へのファイル upload (browser 直 fetch)

`packages/plugin/src/core/kintone/fileUploadKintone.ts`:

```ts
export interface KintoneFileUploadResult { fileKey: string; }

export async function uploadFileToKintone(file: File): Promise<KintoneFileUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/k/v1/file.json', {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`kintone file upload ${response.status}: ${text}`);
  }
  return response.json();
}
```

- プラグインは kintone と同一オリジン (`<tenant>.cybozu.com`) で動くので相対 URL で OK
- `X-Requested-With` は kintone の CSRF 対策ヘッダ (kintone.api と同等)
- `credentials: 'include'` は同一オリジンでは厳密には不要だが明示

## 2. AttachedFile 型拡張

```ts
export interface AttachedFile {
  // ...existing...
  /** kintone に保存できた場合の fileKey (FILE フィールド値で使う) */
  kintoneFileKey?: string;
  /** kintone upload の進行状態 (UI / デバッグ用) */
  kintoneUpload?: 'uploading' | 'uploaded' | 'failed';
}
```

`status` は既存通り FileReader 完了状態で、`kintoneUpload` は別フィールドで並行管理。

## 3. useFileAttacher 修正

ファイル追加時、validateFile 通過後に **2 つの非同期処理を並行起動**:

1. 既存: FileReader で content (text or base64) を読む
2. 新規: `uploadFileToKintone` を呼んで fileKey を取得

両者は独立しているので Promise.all 不要。互いの完了を待たない。

## 4. messageContent 拡張

`buildUserMessageContent` の最後に、kintoneFileKey 付きファイルがあればメタ情報を
text block として追加:

```
【kintone に保存済の添付ファイル】
これらのファイルは kintone にアップロード済です。レコードの FILE フィールドに
添付したい場合、`kintone-add-record` / `kintone-update-record` の FILE フィールド値に
`[{"fileKey": "..."}]` の形で渡してください。

- 顧客一覧.md (fileKey: 20260430-abcdef)
- scan.pdf (fileKey: 20260430-ghijkl)
```

block 順序: 既存の content blocks → fileKey メタ block → user input text block。

## 5. システムプロンプト

`packages/plugin/src/core/agent/systemPrompt.ts` (or 該当ファイル) の「ファイル添付」
セクションに以下を追記:

> 添付ファイルが「kintone に保存済」とマークされている場合、ユーザーから「このファイル
> をレコードに添付して」と依頼されたら、`kintone-update-record` の対象 FILE フィールドに
> `[{"fileKey": "<提示された fileKey>"}]` を渡すことで添付できます。`kintone-upload-file`
> ツールを再度呼ぶ必要はありません。

`promptVersion` を v11 → **v12** に上げる (既存ルール踏襲)。

## 6. UI: AttachmentChip indicator

kintone に保存済のチップに小さい kintone 保存マーク (鎖アイコン or "k" バッジ) を表示。
失敗時は無印 (= 既存通り)。Optional な範囲。

## 7. テスト

### 新規: `core/kintone/fileUploadKintone.test.ts`
- 成功: POST `/k/v1/file.json` + multipart + X-Requested-With ヘッダ + credentials
- 4xx で例外

### 修正: `useFileAttacher.test.ts`
- kintone upload mock が呼ばれる
- 成功で `kintoneFileKey` がセットされる
- 失敗で `kintoneUpload === 'failed'`、content 読込は影響を受けない

### 修正: `messageContent.test.ts`
- fileKey ありの AttachedFile があれば fileKey block が追加される
- fileKey 無しなら既存通り (content block + user text のみ)
- ブロック順序の確認

### 修正: ChatPanel.test.tsx
- 既存テストは attached files を受けて送信するシナリオがあるかもしれないので
  `kintoneFileKey` フィールドを許容することを確認

## 8. エラー時の振舞い
- kintone upload 失敗 (例: 403, 5xx): silent に `kintoneUpload='failed'` を立て、UI に
  特に何も出さない (チップは ready のままで通常通り送信できる)。Agent には fileKey は
  渡らない。
- ネットワーク障害: 同上。

## 9. ロールバック容易性
- 機能 OFF 用フラグは置かない (シンプル化)。問題が出たら revert する。
