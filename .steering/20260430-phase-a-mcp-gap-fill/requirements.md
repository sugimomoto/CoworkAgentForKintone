# Phase A: kintone MCP 基本ギャップ埋め — 要求

GitHub Issue: #21

## 背景
現状の kintone MCP は 10 ツールでスタートしたが、運用上「あるべき基本機能が無い」状態。
- 単一レコード取得が `kintone-get-records` の擬似クエリ流用
- コメントは write のみで read 無し
- 複数操作のアトミック性が無く、整合性破れリスク

## 追加するツール

### 1. `kintone-get-record`
- API: `GET /k/v1/record.json`
- 入力: `app`, `id`
- 出力: 単一 `record` オブジェクト

### 2. `kintone-get-record-comments`
- API: `GET /k/v1/record/comments.json`
- 入力: `app`, `record`, `order?` (`asc`|`desc`), `offset?`, `limit?` (1-10, default 10)
- 出力: `comments[]` (id / text / createdAt / creator / mentions), `older`, `newer`

### 3. `kintone-bulk-request`
- API: `POST /k/v1/bulkRequest.json`
- 入力: `requests: [{method, api, payload}, ...]` (1〜20)
- 出力: `results: [...]` (各 request のレスポンス配列)
- 1 件失敗で全 rollback (kintone 仕様)

## 横断改善

### `KintoneApiError`
- kintone REST から返る `code` (例: `GAIA_IL01`, `CB_VA01`) と `message`, `id` を保持
- HTTP status を保持
- `retryable` フラグ (5xx と一部の 429 系で `true`)
- 既存ツール挙動互換: `Error` のサブクラスなので `instanceof Error` で従来通り扱える
- `message` 文字列に `kintone HTTP_STATUS [code]: message` を含めることで既存 test (`/404.*app not found/`) も通す

## 受入条件

- [ ] `kintone-get-record` が単一 record を返し、404 で適切な `KintoneApiError`
- [ ] `kintone-get-record-comments` が `comments[]` を返し、`order` / `limit` / `offset` 指定可
- [ ] `kintone-bulk-request` が最大 20 件まで複数操作を 1 リクエスト送信
- [ ] `kintone-bulk-request` で 21 件以上は client side で例外
- [ ] エラー時に `KintoneApiError` が throw され、`code` / `status` / `retryable` が付く
- [ ] 既存 10 ツール + 新 3 ツール = 13 ツールで全 unit test green
