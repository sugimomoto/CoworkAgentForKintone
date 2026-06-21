# タスクリスト: kintone プロセス管理レコード操作 — #22 Phase B-1

確定: 3 ツール（status 単一/一括 + assignees）/ スコープ追加なし / 業務 Agent のみ /
status 系 = always_ask・assignees = always_allow / エラーは KintoneApiError で surface。

## T1. Worker: スキーマ部品
- [x] `src/tools/utils/schemas.ts` に `actionSchema` / `assigneeCodeSchema` / `assigneesSchema` を追加

## T2. Worker: ツール 3 本
- [x] `src/tools/update-record-status.ts`（`PUT /k/v1/record/status.json`、`{app,id,action,assignee?,revision?}` → `{revision}`）
- [x] `src/tools/update-records-statuses.ts`（`PUT /k/v1/records/status.json`、最大 100、`{app,records[]}` → `{records[]}`）
- [x] `src/tools/update-record-assignees.ts`（`PUT /k/v1/record/assignees.json`、`{app,id,assignees[],revision?}` → `{revision}`）
- [x] `src/tools/index.ts` の `tools` 配列に 3 つ登録（Write グループ付近）

## T3. Worker: テスト
- [x] 各ツール: 正常系（path/body/出力）+ バリデーション（必須欠落 / 最大件数）+ KintoneApiError 伝播（400/409）

## T4. Plugin: 公開配線（業務 variant のみ）
- [x] `core/bootstrap/builtInAgents.ts`: `KINTONE_TOOL_NAMES` に 3 追加 / `DESTRUCTIVE_TOOL_NAMES` に status 系 2 追加 /
      業務 spec の `mcpToolFilter` で 3 ツールを通し、Customizer Opus/Sonnet は通さない
- [x] `core/bootstrap/agentToolDefs.ts`: custom 用 `KINTONE_TOOL_NAMES` / `DESTRUCTIVE_TOOL_NAMES` を同期
- [x] （toolsVersion は自動変化 → reconcile 追従。追加作業なし）

## T5. Plugin: テスト
- [x] 業務 built-in が 3 ツールを含む / status 系 always_ask・assignees always_allow / Customizer には出ない
- [x] 既存の tool 数 assert があれば更新

## T6. 検証・仕上げ
- [x] `pnpm -r test` / typecheck / lint green（Worker + Plugin）
- [x] PR 作成（#22 の 3 ツール分。#22 は read 系 get-process-management を残すため partial close か言及）
- [x] requirements/design/tasklist の最終チェック

## 実装順
T1 → T2 → T3（Worker 完結・テスト）→ T4 → T5（Plugin 配線・テスト）→ T6。
