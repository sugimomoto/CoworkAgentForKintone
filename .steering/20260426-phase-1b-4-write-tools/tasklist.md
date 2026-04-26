# Phase 1b-4 — kintone 書き込みツール追加 タスクリスト

## 完了済み

- [x] Worker `src/tools/add-record.ts` (POST /k/v1/record.json)
- [x] Worker `src/tools/add-records.ts` (POST /k/v1/records.json, 最大 100 件)
- [x] Worker `src/tools/update-record.ts` (PUT /k/v1/record.json, id or updateKey, 楽観ロック対応)
- [x] Worker `src/tools/update-records.ts` (PUT /k/v1/records.json, 最大 100 件)
- [x] Worker `src/tools/delete-records.ts` (DELETE /k/v1/records.json, 最大 100 件, revisions 対応)
- [x] Worker `src/tools/add-record-comment.ts` (POST /k/v1/record/comment.json, mentions 対応)
- [x] Worker `src/tools/index.ts` で 6 ツールを登録 (合計 10 ツール)
- [x] Worker `tests/tools/write-tools.test.ts` 追加 (19 件)
- [x] Worker `tests/mcp.test.ts` の tools/list 期待値を 10 件に更新
- [x] Plugin `core/bootstrap/resolveAgent.ts` の system プロンプトを更新
  - 参照系 / 追加更新系 / 削除系 をセクション分け
  - 破壊的操作前に確認するガードレール追加
  - kintone-get-form-fields で型確認するよう促す指示追加
- [x] Worker deploy (`wrangler deploy`)
- [x] Plugin build (auto-deploy 経由で kintone にも反映済)
- [x] 全 typecheck / 全 tests green (Worker 79 + Plugin 267 = 346)

## 残: 手動動作確認 (admin 環境で)

- [ ] チャットから「テスト用レコードを 1 件追加して」→ kintone に反映確認
- [ ] チャットから「ID 〇〇 のレコードを更新して」→ 反映確認
- [ ] チャットから「レコード 〇〇ID にコメントを追加して」→ 反映確認
- [ ] チャットから「レコード 〇〇ID を削除して」→ 確認応答 → 実行 → 反映確認

## 残: Phase 1c で扱う

- HITL 承認カード (破壊的操作前の UI 確認)
- ファイルアップロード (`/k/v1/file.json`)
- アプリ管理系 (preview API)
- プロセス管理 (`/k/v1/record/status.json`)
