# Phase B-2 設計

## 1. `kintone.ts` 拡張

### `kintoneUploadFile(creds, filename, bytes, contentType?)`
- multipart/form-data で `POST /k/v1/file.json`
- `FormData` + `Blob` で組立。boundary は fetch が自動。
- Content-Type は手動セットしない (FormData 利用時に fetch が自動セット)。
- 4xx/5xx は既存と同じ `KintoneApiError` を投げる。

### `kintoneDownloadFile(creds, fileKey)`
- `GET /k/v1/file.json?fileKey=...` を呼ぶ。
- 成功時は `{ bytes: Uint8Array, contentType: string | null, size: number }` を返す。
- 404 等は `KintoneApiError`。

これらは `kintoneRequest` とは別関数として export。

## 2. base64 ユーティリティ

Cloudflare Workers では `atob` / `btoa` が利用可能。Tool 側で:
- decode: `Uint8Array.from(atob(base64), c => c.charCodeAt(0))`
- encode: バイナリ → 一旦 binary string に → `btoa()`

サイズが大きい場合 `btoa` の引数長で問題にならないよう、チャンク変換ヘルパを別ファイル (`utils/base64.ts`) に置く。

## 3. `tools/upload-file.ts`

```ts
interface Args {
  filename: string;
  content: string;      // base64
  contentType?: string;
}
```

- base64 → Uint8Array → サイズ検証 (10 MB 上限)
- `kintoneUploadFile` 呼出 → `{ fileKey }` を返す

## 4. `tools/download-file.ts`

```ts
interface Args { fileKey: string; }
```

- `kintoneDownloadFile` 呼出
- size > 10 MB なら明示的に例外 (`KintoneApiError` ではなく純粋な Error)
- `Uint8Array → base64` で `{ content, contentType, size }` を返す

## 5. ツール登録

`src/tools/index.ts` の bulk セクションの隣に File セクションを追加:
- Read 6 / Write 6 / Bulk 1 / **File 2** = 15 ツール

## 6. テスト

- `tests/tools/file-tools.test.ts` (新規):
  - upload: FormData の multipart リクエストを fetch mock で受け取り、`Content-Type: multipart/form-data; boundary=...` を確認、body から `filename` / payload の存在を確認。
  - upload: 10 MB 超で client side 例外。
  - download: `GET /k/v1/file.json?fileKey=` を確認、レスポンスのバイナリが base64 で返ることを確認。
  - download: 10 MB 超 (`Content-Length`) で client side 例外。
- `tests/mcp.test.ts`: tools/list の期待値を 13 → 15 に更新。
