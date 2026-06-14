# タスクリスト: Deployments (cron 定期実行) — #81

## T1. API 層
- [x] T1.1 `core/managed-agents/types.ts` に `CronSchedule` / `Deployment` / `DeploymentInitialEvent` / `DeploymentRun` / `DeploymentRunError` 追加
- [x] T1.2 `core/managed-agents/resources.ts` に params 型 + `listDeployments`/`createDeployment`/`retrieveDeployment`/`updateDeployment`/`runDeployment`/`pauseDeployment`/`unpauseDeployment`/`archiveDeployment`/`listDeploymentRuns`/`retrieveDeploymentRun`
- [x] T1.3 `resources.test.ts`（or 新規）に各エンドポイントの URL/method/body/`has_error` クエリ assert

## T2. ロジック層（core/deployments/）
- [x] T2.1 `core/deployments/schedule.ts` — ハンドオフ cron ヘルパー移植（buildCron/cronHuman/nextRuns/dstRisk/fmtRun/relDay/TIMEZONES/ScheduleValue）
- [x] T2.2 `core/deployments/view.ts` — `DeploymentView` + `deploymentToView` + `draftToCreateParams`/`draftToUpdateParams` + `RUN_ERROR_MAP`（agent-archived 追加）+ `visibleDeployments`
- [x] T2.3 `schedule.test.ts` / `view.test.ts`
- [x] T2.4 `test/fixtures.ts` に `makeDeployment` / `makeDeploymentRun`

## T3. UI コンポーネント
- [x] T3.1 `deployment-detail/SchedulePicker.tsx` 移植（クラスを意味クラスへ置換）
- [x] T3.2 `deployment-detail/types.ts` / `buildDraft.ts`（mode / draft 初期値）
- [x] T3.3 `deployment-detail/DeploymentDetailModal.tsx`（作成・編集、3段、agent 選択 / 初回メッセージ / SchedulePicker / フッタ次回実行）
- [x] T3.4 `DeploymentsListPane.tsx` + 行（StatusBadge/AgentMini/スケジュール/次回/直近 run+owner/アクション/空状態/ユースケース3例）
- [x] T3.5 `DeploymentRunHistory.tsx`（breadcrumb サブビュー / サマリ / 失敗のみ pill / run 行 / セッションリンク）
- [x] T3.6 手動実行トースト + アーカイブ確認（ConfirmDialog 流用）

## T4. Settings 配線 + ロール出し分け
- [x] T4.1 `SettingsNav.tsx`: `SettingsSection` に `deployments`、`NAV_ITEMS` + `clock` アイコン、role で項目フィルタ
- [x] T4.2 `SettingsView.tsx`: `deployments` 分岐 + role 別初期 section + ヘッダサブテキスト
- [x] T4.3 `ChatPanel.tsx`: Settings 入口の admin ガード撤廃（162/297/340/397）
- [x] T4.4 `SettingsViewBound.tsx`: deployments local state + fetch + modal + run/pause/unpause/archive + `resolveBootstrapEnvironment` + `visibleDeployments`

## T5. UI テスト
- [x] T5.1 `DeploymentsListPane.test.tsx`（空 / 行 / admin 所有者列・scope pill / 非 admin 自分のみ）
- [x] T5.2 `DeploymentDetailModal.test.tsx`（プリセット→cron→プレビュー / custom 無効で保存 disable）
- [x] T5.3 `SettingsNav` の role 別項目数 / アーカイブ確認 / トースト

## T6. 検証・仕上げ
- [x] T6.1 `pnpm lint` / `pnpm typecheck` / `pnpm -r run test` green
- [x] T6.2 `pnpm --filter @cowork-agent/plugin run build` green
- [x] T6.3 動作確認チェックリスト作成（特に Settings 入口の非 admin 開放）
- [x] T6.4 commit → PR（closes #81 は MVP 完了時）→ CI green
