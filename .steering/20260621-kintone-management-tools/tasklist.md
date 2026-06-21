# タスクリスト: kintone 管理系ツール (Phase C) — #24

確定: 全 18 ツール一括 / admin 専用（built-in 全 variant から除外・custom Agent で選択）/
取得=preview? 切替・更新=preview 固定 / deploy で反映 / スコープ追加なし。

## T1. Worker: 共通基盤
- [x] `tools/utils/schemas.ts` に `previewSchema` 等を追加
- [x] `appConfigPath(segment, preview)` パスヘルパ（`/k/v1(/preview)?/app/<segment>`）

## T2. Worker: ツール 18 本（グループ別）
- [x] G1 customize/deploy: get-customize / update-customize / deploy-app / get-app-deploy-status
- [x] G2 form: get-views / update-views / get-form-layout / update-form-layout / add-form-fields / update-form-fields / delete-form-fields
- [x] G3 app/process: create-app / get-process-management / update-process-management
- [x] G4 acl/plugins: get-app-acl / update-app-acl / get-app-plugins / update-app-plugins
- [x] `tools/index.ts` に 18 登録（Management グループ）

## T3. Worker: テスト
- [x] `management-tools.test.ts`（各ツール path/method/body・preview 切替・KintoneApiError 伝播）
- [x] `mcp.test.ts` の tools/list 数を 17→35 に更新

## T4. Plugin: admin ゲート配線
- [x] `builtInAgents.ts`: `KINTONE_TOOL_NAMES` に 18 追加 / `MANAGEMENT_TOOL_NAMES` を実名 18 に置換・拡張
- [x] カスタマイザー spec の `mcpToolFilter` に `!MANAGEMENT_TOOL_NAMES.has(name)` を追加（業務は既存・デザイナーは readonly で対象外）
- [x] `DESTRUCTIVE_TOOL_NAMES` に `deploy-app` / `delete-form-fields`（影響大）を追加
- [x] `agentToolDefs.ts` は据え置き（legacy に管理系を出さない）

## T5. Plugin: テスト
- [x] 管理系が全 built-in variant に出ない / custom picker（KINTONE_TOOL_NAMES）には出る / DESTRUCTIVE 検証
- [x] tool 数 assert（KINTONE_TOOL_NAMES 12→30）更新

## T6. 検証・docs・PR
- [x] `pnpm -r test` / typecheck / lint green
- [x] docs: 機能一覧に管理系（F-22?）、functional-design に preview/live・admin ゲートを反映
- [x] PR（closes #24）

## 実装順
T1 → T2（G1→G4）→ T3 → T4 → T5 → T6。
