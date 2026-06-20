# タスクリスト: 通知拡張 (Slack / Teams Webhook) — #13 【Agent 紐付け版】

確定: 設計A + **Agent ごとに Webhook 紐付け** / built-in+custom 両方 / 1 Agent=1 Webhook /
Q1=Vault static_bearer + 通知専用 MCP（ステートレス維持）/ 登録=admin / platform は URL ホスト自動判定 /
notifyKey（built-in=purpose, custom=uuid）で notify URL を確定。

## T1. Worker: ペイロード整形（純関数・先行）✅ PR #99 merged
- [x] T1.1 `kintone-mcp/src/notify/detectPlatform.ts` — URL ホスト → `'slack' | 'teams' | null`（Teams Workflows `logic.azure.com` 含む）
- [x] T1.2 `kintone-mcp/src/notify/format.ts` — `buildSlackPayload`（blocks）/ `buildTeamsPayload`（Adaptive Card）
- [x] T1.3 `detectPlatform.test.ts` / `format.test.ts`

## T2. Worker: send_notification + /notify エンドポイント ✅ PR #99 merged
- [x] T2.1 `src/notify/sendNotification.ts` — 入力 (title/text/fields?/link?)、注入 Bearer(=URL) を受け取り
      detect→format→`fetch` POST、2xx 成功/他失敗、未設定(Bearer 無)は「通知先未設定」を toolResult
- [x] T2.2 URL/トークンを**レスポンス・ログに出さない**（`sanitizeError`、status のみ）。AC-6
- [x] T2.3 `/notify/<domain>/<notifyKey>` MCP エンドポイント（Bearer 抽出→send_notification の単一 toolset）+
      `index.ts` ルーティング + `notifyPathPattern()` 追加
- [x] T2.4 `notify.test.ts`（成功/4xx/未設定/URL マスク）

## T3. Plugin: Vault static_bearer + 通知 Vault + notifyKey ✅
- [x] T3.1 `credentials-upsert.ts`（Worker）に `auth.type: "static_bearer"`（mcp_server_url + token）対応（+5 tests）
- [x] T3.2 Plugin: `resolveNotifyVault`（metadata `purpose=notify` + `kintoneDomain` で find-or-create、テナント1個）
- [x] T3.3 Plugin: notifyKey 規約 — built-in=`purpose`（`notifyKeyForBuiltIn`）/ custom=作成時 `metadata.notifyKey` に uuid
- [x] T3.4 Plugin: `registerNotifyWebhook` = 通知 Vault に static_bearer upsert（`/notify/<domain>/<notifyKey>`）/
      `unregisterNotifyWebhook` = archive。登録状態取得は**マスクのみ**（生 URL 非返却）。AC-4

## T4. Plugin: 全 Agent に notify MCP / tool を常設 + vault 配線 ✅
- [x] T4.1 `buildMcpServers(workerUrl, domain, notifyKey?)` に `/notify/<domain>/<notifyKey>` を2本目で追加
      （built-in=resolveBuiltInAgents、custom=agentDetailApi 作成経路の両方）
- [x] T4.2 各 Agent の toolset に `send_notification`（notify mcp_toolset）を常設
- [x] T4.3 #86 `toolsVersion` シグネチャに `notify` を反映 + reconcile で mcp_servers も追従（built-in 一度 reconcile / 以降不要）
- [x] T4.4 セッション/定期実行作成に `vault_ids: [userVault, notifyVault]` を配線（resolveSession / useSession / deployments/view / DeploymentsPaneBound）。
      `AgentRecord.notifyVaultId/notifyPlatform` を metadata から復元
- [ ] T4.5 system prompt 追記 — **見送り**（tool 名 + 「未設定」フォールバックで自己説明的。promptVersion を動かす副作用を回避）

## T5. Plugin: 設定 UI（Agent ごと, admin）✅
- [x] T5.1 `AgentDetailModal` に `NotifySection`（伏字パスワード入力・platform 自動判定・解除確認）+ working copy
- [x] T5.2 **built-in / custom 共通**: AgentDetailModal は built-in でも開くため同一セクションでカバー（独立ポップオーバーは不要に）。
      一覧行に `NotifyIndicator`（登録済の視覚キュー）
- [x] T5.3 保存→ `reconcileAgentWebhook`（register/unregister + metadata 更新、built-in は notifyKey を purpose 導出）。表示はマスクのみ

## T6. テスト・検証・docs
- [x] T6.1 Worker/Plugin 単体（整形・ツール・credential body static_bearer・resolveNotifyVault・notifyRegistration・reconcile・buildAgentTools/agentDetailApi notify）
- [x] T6.2 `pnpm lint` / `typecheck` / test / build green（plugin 1049 / worker 164）
- [x] T6.3 docs: functional-design.md（通知 MCP / static_bearer / 通知 Vault / notifyKey）+ product-requirements 機能追加
- [ ] T6.4 動作確認チェックリスト（実機: Agent に webhook 設定 → 依頼 → Slack/Teams 着信 / URL 非露出 / 未設定 Agent は無害）— **ユーザー実機確認**

## T7. 仕上げ
- [ ] T7.1 commit → PR（closes #13）→ docs-sync フック対応 → CI green → merge

## 段階実装の推奨順
T1→T2（Worker 完結・テスト）→ T3（Vault/credential）→ T4（連携・配線）→ T5（UI）→ T6/T7。
各節目で verify。規模が大きいので **PR を Worker 先行 / Plugin 後追い**の2本に分割する案も検討。
