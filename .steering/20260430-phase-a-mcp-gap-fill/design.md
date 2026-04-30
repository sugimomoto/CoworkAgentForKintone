# Phase A 設計

## 1. `KintoneApiError` (kintone.ts)

```ts
export class KintoneApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;       // kintone error code (例: "GAIA_IL01")
  readonly errorId: string | undefined;    // kintone error id (request 識別子)
  readonly errors: unknown;                // フィールド単位の詳細エラー (CV_VL01 等)
  readonly retryable: boolean;
  readonly responseText: string;
  constructor(status: number, body: string, parsed?: { code?: string; message?: string; id?: string; errors?: unknown });
}
```

- `kintoneRequest` 内で `!response.ok` のとき `JSON.parse` を試みて `KintoneApiError` を throw
- JSON でない場合は `code/message/id` 無しで構築
- `retryable` 判定: `status >= 500` || `status === 429` (kintone は ratelimit を返さないが将来用)
- `message` は `kintone <status> [<code>]: <parsed.message ?? rawText>` 形式 → 既存テスト通過

## 2. `kintone-get-record`

- input: `{ app: string, id: string }`
- 実装: `GET /k/v1/record.json?app=&id=` → `{ record }`
- output: `{ record: object }`

## 3. `kintone-get-record-comments`

- input: `{ app, record, order?: 'asc'|'desc', offset?: number, limit?: number }`
- 実装: `GET /k/v1/record/comments.json` (params に大文字小文字を kintone 仕様に合わせる)
- output: `{ comments: [...], older: boolean, newer: boolean }`

## 4. `kintone-bulk-request`

- input: `{ requests: [{ method: 'GET'|'POST'|'PUT'|'DELETE', api: string, payload: object }, ...] }`
- 1〜20 件で client side バリデーション
- 実装: `POST /k/v1/bulkRequest.json` body = `{ requests }`
- output: `{ results: [...] }` (kintone は失敗時 1 件目のエラーを返すが、ここは生レスポンスを通す)
- エラー時: bulk のロールバック動作は kintone の仕様。`KintoneApiError` が throw される。

## 5. ツール登録

`src/tools/index.ts` の `tools` 配列に追加。Read 系の末尾、Write 系の前に挿入する。

## 6. テスト追加

- `tests/tools/kintone-tools.test.ts` に `kintone-get-record` / `kintone-get-record-comments` テスト
- `tests/tools/write-tools.test.ts` か新ファイルに `kintone-bulk-request` テスト
- `tests/kintone.test.ts` の 404 ケースを `KintoneApiError` の status / code 検証に拡張
