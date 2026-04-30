# Phase A タスクリスト

- [x] steering ドキュメント作成 (requirements / design / tasklist)
- [ ] `kintone.ts` に `KintoneApiError` を追加し `kintoneRequest` をリファクタ
- [ ] `tools/get-record.ts` を実装
- [ ] `tools/get-record-comments.ts` を実装
- [ ] `tools/bulk-request.ts` を実装
- [ ] `tools/index.ts` に新 3 ツールを登録
- [ ] tests: `kintone.test.ts` を `KintoneApiError` 対応に更新
- [ ] tests: `kintone-tools.test.ts` に `get-record` / `get-record-comments` ケースを追加
- [ ] tests: `bulk-request.test.ts` (新規) を追加
- [ ] `pnpm -C packages/kintone-mcp test` / `lint` / `typecheck` 緑化
