# Phase B-2: kintone ファイル up/download — 要求

GitHub Issue: #23

## 背景
- kintone レコードの添付ファイルフィールド (FILE) と Agent をつなぐ。
- ユースケース: 「PDF を読んで要約 → 別レコードに添付」「画像を添付に追加」「添付 PDF を取り出して内容抽出」。
- MCP は Cloudflare Workers 実行 (ファイルシステム無し) なので、ファイル経路は **base64 inline** に統一する。

## 追加するツール

### 1. `kintone-upload-file`
- API: `POST /k/v1/file.json` (multipart/form-data, field `file`)
- 入力: `{ filename: string, content: string (base64), contentType?: string }`
- 出力: `{ fileKey: string }`
- 制約:
  - 入力 base64 デコード後 10 MB 以下 (それ以上は client side で例外)
  - `kintone-add-record` / `kintone-update-record` の添付フィールド値として `[{ fileKey }]` を渡す利用前提

### 2. `kintone-download-file`
- API: `GET /k/v1/file.json?fileKey=...`
- 入力: `{ fileKey: string }`
- 出力: `{ content: string (base64), contentType: string | null, size: number }`
- 制約: 10 MB 超は client side で例外 (Anthropic tool result payload 上限への配慮)

## Worker 側設計上の論点

### multipart 構築
- Cloudflare Workers の標準 `FormData` + `Blob` で構築可能 (boundary は fetch が自動付与)。
- `kintone.ts` の既存 `kintoneRequest` は JSON 専用なので、multipart / binary 用のヘルパを追加する。

### 認証
- 既存と同じく OAuth Bearer 透過。ファイル系 API でも `Authorization: Bearer <token>` で OK。

### サイズ判定
- base64 デコード後のバイト長で判定 (input)。
- ダウンロードは `Content-Length` ヘッダ or 受信後の ArrayBuffer サイズで判定 (output)。

## 受入条件

- [ ] `kintone-upload-file` が `{filename, content(base64)}` から fileKey を取得 (multipart リクエストの URL / Content-Type / body をテストで検証)
- [ ] `kintone-download-file` が fileKey から `{content(base64), contentType, size}` を返す
- [ ] 10 MB 超の input/output は分かりやすいエラー (`max 10MB` 等)
- [ ] 既存 13 ツール + 新 2 ツール = **15 ツール** で unit test green
- [ ] `tools/list` の Smoke test (`mcp.test.ts`) を 15 ツール期待値に更新
