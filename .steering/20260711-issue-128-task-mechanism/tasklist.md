# tasklist.md — タスク機構（#128 / セッション内ゴール到達管理）

正本: requirements.md（概念B）/ design.md（`update_plan` custom tool = TodoWrite 正典準拠・activeForm・後方互換=遅延）/ design-handoff `docs/design-handoff/task-mechanism/`。

決定: A=単一 custom tool `update_plan`（全置換）/ B=承認は破壊的操作のみ（既存流用）/ C=全エージェント / D=任意（複雑度依存）/ 後方互換=既存 custom は次回保存まで待つ（自動 reconcile しない）。

---

## M1 — ツール + エージェント結線

- [ ] `core/bootstrap/agentToolDefs.ts`: `UPDATE_PLAN_TOOL_NAME` + `UPDATE_PLAN_TOOL`（schema: `todos[]{content, status:pending|in_progress|completed, activeForm}`）+ `parseUpdatePlanInput`（検証: todos 配列・status enum・content/activeForm 必須）。単体テスト。
- [ ] `core/managed-agents/buildAgentTools.ts` + `core/bootstrap/resolveAgent.ts`: tools 配列に `UPDATE_PLAN_TOOL` を追加（`CREATE_ARTIFACT_TOOL` と同じ場所）。→ 全 built-in + custom（新規）に公開。
- [ ] **toolsVersion / promptVersion を bump**。`reconcileBuiltInAgent` で既存 built-in に `updateAgent` で付与（非破壊・再作成不要）を確認。
- [ ] **custom（既存）は自動付与しない**。`applyAgentEdit` が `buildAgentTools` 経由で tools を再構築することを確認（＝次回保存で自然に付く）。
- [ ] システムプロンプト誘導（`builtInAgents.ts` / `resolveAgent.ts` 共通プロンプト）: 「多段依頼で update_plan、頭で追跡しない(State Externalization)、軽い依頼では使わない、activeForm 必須」を追記。

## M2 — イベント処理 + 状態

- [ ] `core/chat/types.ts`: `PlanTodo = { content:string; status:'pending'|'in_progress'|'completed'; activeForm:string }`。
- [ ] `store/slices/planSlice.ts`（新）+ `store/types.ts`: `plan: PlanTodo[] | null`、`setPlan(todos)`、`clearPlan()`。**selectSession（会話切替）でクリア**（#129 の session 切替リセット原則）。
- [ ] `core/managed-agents/eventInterpreter.ts`: `agent.custom_tool_use` に `name === 'update_plan'` 分岐 → `{ kind:'set-plan', plan }` effect を返す（不正入力は警告メッセージ）。`custom_tool_result = { success:true }` を既存経路で返す。
- [ ] interpreter の effect 型に `set-plan` を追加し、適用側（store 反映）で `setPlan` を呼ぶ。単体テスト。

## M3 — UI（PlanPanel 移植）

- [ ] `docs/design-handoff/task-mechanism/planTodos.ts` のヘルパー（`planSummary` / `todoLabel` / `shouldGroupCompleted`）を plugin 内（`core/chat/` 等・フレームワーク非依存）へ移植。単体テスト。
- [ ] `PlanPanel.tsx` を `desktop/components/PlanPanel.tsx` へ移植（handoff 参照実装ベース・`--cw-*` トークン）。5 状態・折りたたみ・完了たたみ込み。
- [ ] **`--cw-*` トークン確認/補完**: `--cw-panel` / `--cw-accent-soft` / `--cw-on-accent` / `--cw-subtle` 等が tailwind/CSS に存在するか確認、無ければ追加（既存 accent トークンに合わせる）。
- [ ] ChatPanel/MessageList のレイアウトに `<PlanPanel todos={plan} />` を**会話スクロールの外・Composer の上**に兄弟差込（`flex-none`）。`plan` 空/未定義で非表示。
- [ ] **stick-to-bottom（#133）と非干渉**を確認（PlanPanel はスクロールコンテナ外・追従を揺らさない）。emerald「応答完了」divider との同居確認。

## M4 — テスト / 検証

- [ ] 単体: `parseUpdatePlanInput`（正常/不正）、`eventInterpreter` の update_plan 分岐（set-plan / 不正→警告）、`planSlice`（set/clear/session 切替）、`PlanPanel`（5 状態描画・plan=null 非表示・完了たたみ込み）、planTodos ヘルパー。
- [ ] デグレ: 既存 custom tool（create_artifact / propose_agent）・MessageList・agent bootstrap/reconcile テストがグリーン。
- [ ] tsc / lint / vitest 全通過 / build OK。
- [ ] （任意）実機で「多段依頼 → plan 宣言 → 進捗更新 → 完了」を確認。自動デプロイで反映。

## 横断

- [ ] Issue #128 にコメントで**概念B定義を明確化**（cron/台帳は #81/#114 に委譲、本 Issue は「セッション内ゴール到達管理」）。
- [ ] **docs-sync 判定**: ユーザー向け機能追加のため、functional-design に「タスク/plan 可視化（update_plan / PlanPanel）」の節を追記するか判断（#40/#42 と同様の粒度）。
- [ ] 既存機能（会話 / ツール実行 / アーティファクト / 承認 / Deployments / MCP）にデグレなし。

## 完了条件（受け入れ条件の対応・requirements §4）

- エージェントが update_plan を宣言 → PlanPanel にサブタスクが状態付きで表示。
- 進行で `pending→in_progress→completed` が UI 反映（in_progress は activeForm 表示）。
- 破壊的操作の手前で既存承認カード（plan/step 承認は無し）。
- 会話リロード/再開で plan/進捗が復元（event 再構築）。
- 全テスト緑・デグレなし。
