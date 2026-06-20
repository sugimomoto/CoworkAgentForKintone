# タスクリスト: 通知拡張 (Slack / Teams Webhook) — #13 【Agent 紐付け版】

確定: 設計A + **Agent ごとに Webhook 紐付け** / built-in+custom 両方 / 1 Agent=1 Webhook /
Q1=Vault static_bearer + 通知専用 MCP（ステートレス維持）/ 登録=admin / platform は URL ホスト自動判定 /
notifyKey（built-in=purpose, custom=uuid）で notify URL を確定。

## T1. Worker: ペイロード整形（純関数・先行）
- [ ] T1.1 `kintone-mcp/src/notify/detectPlatform.ts` — URL ホスト → `'slack' | 'teams' | 'unknown'`
- [ ] T1.2 `kintone-mcp/src/notify/format.ts` — `buildSlackPayload` / `buildTeamsPayload`（最小 Adaptive Card）
- [ ] T1.3 `detectPlatform.test.ts` / `format.test.ts`

## T2. Worker: send_notification + /notify エンドポイント
- [ ] T2.1 `src/tools/send-notification.ts` — Zod 入力 (title/text/fields?/link?)、注入 Bearer(=URL) を受け取り
      detect→format→`fetch` POST、2xx 成功/他失敗、未設定(Bearer 無)は「通知先未設定」を toolResult
- [ ] T2.2 URL/トークンを**レスポンス・ログに出さない**（`sanitizeError`、host のみ）。AC-6
- [ ] T2.3 `/notify/<domain>/<notifyKey>` MCP エンドポイント（Bearer 抽出→send_notification の単一 toolset）+
      `index.ts` ルーティング + path pattern 追加
- [ ] T2.4 `send-notification.test.ts`（成功/4xx/未設定/URL マスク）+ WORKER_BUNDLE_VERSION バンプ

## T3. Plugin: Vault static_bearer + 通知 Vault + notifyKey
- [ ] T3.1 `credentials-upsert.ts`（Worker）に `auth.type: "static_bearer"`（mcp_server_url + bearer）対応
- [ ] T3.2 Plugin: `resolveNotifyVault`（metadata `purpose=notify` + `kintoneDomain` で find-or-create、テナント1個）
- [ ] T3.3 Plugin: notifyKey 規約 — built-in=`purpose` / custom=作成時 `metadata.notifyKey` に uuid
      （既存 custom は初回設定時に付与）
- [ ] T3.4 Plugin: Webhook 設定 = 通知 Vault に static_bearer upsert（該当 notifyKey の `/notify/<domain>/<notifyKey>`）/
      解除 = archive。登録状態取得は**マスクのみ**（生 URL 非返却）。AC-4

## T4. Plugin: 全 Agent に notify MCP / tool を常設 + vault 配線
- [ ] T4.1 `buildMcpServers(workerUrl, domain, notifyKey)` に `/notify/<domain>/<notifyKey>` を2本目で追加
      （built-in=resolveBuiltInAgents、custom=agentDetailApi 作成経路の両方）
- [ ] T4.2 各 Agent の toolset に send_notification（notify mcp_toolset）を常設
- [ ] T4.3 #86 `toolsVersion` シグネチャに notify を反映（built-in 一度 reconcile / 以降 webhook 変更で再 reconcile 不要）
- [ ] T4.4 セッション/定期実行作成に `vault_ids: [userVault, notifyVault]` を配線（resolveSession / DeploymentsPaneBound）
- [ ] T4.5 system prompt に「通知依頼時は send_notification（未設定なら未設定が返る）」を1行

## T5. Plugin: 設定 UI（Agent ごと, admin）
- [ ] T5.1 `AgentDetailModal`（custom 編集）に「通知先 Webhook URL」フィールド（`PasswordInput`）+ 保存/マスク
- [ ] T5.2 **built-in Agent の設定経路**（D-open D1: AgentDetailModal を built-in でも開く / AgentsListPane 行に設定 等、実装時確定）
- [ ] T5.3 保存→ T3.4 の upsert、表示はマスクのみ

## T6. テスト・検証・docs
- [ ] T6.1 Worker/Plugin 単体（整形・ツール・credential body・resolveNotifyVault・buildMcpServers に notify・UI マスク）
- [ ] T6.2 `pnpm lint` / `typecheck` / `-r test` / build green
- [ ] T6.3 docs: functional-design.md（通知 MCP / static_bearer / 通知 Vault / notifyKey）+ product-requirements 機能追加
- [ ] T6.4 動作確認チェックリスト（Agent に webhook 設定 → 依頼 → Slack/Teams 着信 / URL 非露出 / 未設定 Agent は無害）

## T7. 仕上げ
- [ ] T7.1 commit → PR（closes #13）→ docs-sync フック対応 → CI green → merge

## 段階実装の推奨順
T1→T2（Worker 完結・テスト）→ T3（Vault/credential）→ T4（連携・配線）→ T5（UI）→ T6/T7。
各節目で verify。規模が大きいので **PR を Worker 先行 / Plugin 後追い**の2本に分割する案も検討。
