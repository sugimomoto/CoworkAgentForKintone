# Phase 1b-5 — UX 強化 タスクリスト (1st バッチ)

対象: F1-1 / F1-2 / F1-3 / F2-1 / F2-2

各タスクは **独立してコミット可能な粒度**。番号は依存順、`[ ]` は未着手 / `[~]` 進行中 / `[x]` 完了。

---

## 0. 仕様確認 (実機検証)

### T0-1. tool_confirmation 系イベントの実際の挙動を確認 `[x]`
ローカルの ClaudeManagedAgents skill references で確定済 (実機 spike 不要):

- 通知: `session.status_idle` の `stop_reason.type === 'tool_confirmation_required'`、`stop_reason.event_ids[]` に pending な `tool_use_id`
- 応答: `POST /v1/sessions/{id}/events` で `{ type: 'user.tool_confirmation', tool_use_id, result: 'allow'|'deny', deny_message? }`

design.md §2.3 / §4.2 / §7 に反映済。

---

## 1. データモデル + 型定義 (純粋ロジック層)

### T1-1. `ChatMessage` に `tool` kind を追加 `[ ]`
- ファイル: `packages/plugin/src/desktop/components/MessageList.tsx`
- union に `tool` variant 追加 (status / name / input / result / errorText)
- 既存テストが通ること (型エラーが MessageList.test.tsx などに波及しないか確認)

### T1-2. `SessionEvent` に tool_confirmation 系を追加 `[ ]`
- ファイル: `packages/plugin/src/core/managed-agents/types.ts`
- T0-1 で確定した正式な event type と payload で型を追加

### T1-3. `chatStore` に `updateTool` メソッド追加 `[ ]`
- ファイル: `packages/plugin/src/store/chatStore.ts`
- `updateTool(toolUseId, patch)`: 該当 message の `kind === 'tool'` を確認、見つからなければ no-op
- `chatStore.test.ts` に 3 ケース追加 (existing tool 更新 / 該当なし no-op / kind 違い no-op)

---

## 2. eventInterpreter 拡張

### T2-1. `interpretEvent` 関数を新設 `[ ]`
- ファイル: `packages/plugin/src/core/managed-agents/eventInterpreter.ts`
- 戻り値型: `{ kind: 'add'; message } | { kind: 'update-tool'; toolUseId; patch } | null`
- 既存 `eventToMessage` は **互換のため残す** (内部で `interpretEvent` を呼んで `add` のみ返す薄い wrapper) — 移行が完了したら削除
- 新規 case: `agent.tool_use` (add) / `agent.tool_result` (update-tool) / tool_confirmation 系 (update-tool, status='pending-confirmation')

### T2-2. `eventInterpreter.test.ts` 拡充 `[ ]`
- tool_use → add, kind='tool', status='running', input が保持される
- tool_result (is_error=false) → update-tool, status='success', result 保持
- tool_result (is_error=true) → update-tool, status='error', errorText 抽出
- tool_confirmation_required → update-tool, status='pending-confirmation'
- 未知の event は null

---

## 3. ポーラ統合

### T3-1. `useEventPoller` を `interpretEvent` ベースに切替 `[ ]`
- ファイル: `packages/plugin/src/desktop/hooks/useEventPoller.ts`
- `eventToMessage` 呼出を `interpretEvent` に置き換え、union を分岐 (add → mergeMessage / update-tool → updateTool)
- thinking 除去のロジック (`sawAgentMessage || sawTerminal`) は維持
- 既存 `ChatPanel.test.tsx` が green のまま通ること

### T3-2. 互換 `eventToMessage` を削除 `[ ]`
- T3-1 完了後、参照元が無いことを grep で確認してから削除
- テストも追従

---

## 4. ToolCardMessage コンポーネント

### T4-1. `ToolCardMessage.tsx` 新規作成 `[ ]`
- ファイル: `packages/plugin/src/desktop/components/MessageItem/ToolCardMessage.tsx`
- 4 状態 (running / success / error / pending-confirmation) で 4 つの視覚を分ける
- `summarize(name, input)` を内部関数として実装 (kintone 既知ツール 6+4 種 + フォールバック)
- 折り畳み詳細 (`<details>`) で input / result / errorText を表示
- 承認 / 却下ボタンは `onApprove(toolUseId)` / `onReject(toolUseId)` を props で受ける (status='pending-confirmation' のみ)

### T4-2. `ToolCardMessage.test.tsx` `[ ]`
- 4 状態のレンダ確認 (data-attr / クラス名 / テキスト)
- summarize の主要パターン 6 種 (各 kintone tool)
- 折り畳み開閉
- 承認/却下クリック時のハンドラ呼び出し

### T4-3. `MessageList.renderMessage` に `tool` 分岐追加 `[ ]`
- `data-msg-kind="tool"` 属性 (E2E アサート用)
- `MessageList.test.tsx` に 1 ケース追加

---

## 5. HITL 確認 API

### T5-1. `postToolConfirmation` 関数を追加 `[ ]`
- ファイル: `packages/plugin/src/core/managed-agents/events.ts`
- T0-1 で確定した event type / payload で実装
- `events.test.ts` に呼び出し検証 (URL / method / body)

### T5-2. `ChatPanel` に承認/却下ハンドラを実装 `[ ]`
- `ToolCardMessage` の `onApprove` / `onReject` を `ChatPanel` から渡す
- ハンドラ内: `updateTool(id, { status: 'running' })` (楽観) → `postToolConfirmation` → 失敗時 `pending-confirmation` に戻す
- 却下時: `updateTool(id, { status: 'error', errorText: '却下されました' })` を即時反映 (Agent からの後続イベント待ちはしない)

---

## 6. Agent 側: permission_policy 切替

### T6-1. `DESTRUCTIVE_TOOL_NAMES` 導入 + per-tool policy `[ ]`
- ファイル: `packages/plugin/src/core/bootstrap/resolveAgent.ts`
- `kintone-delete-records` のみ `always_ask`、他は `always_allow`
- `DEFAULT_AGENT_PROMPT_VERSION` を `v5` に bump
- `resolveAgent.test.ts` に 1 ケース追加 ("destructive tool だけ always_ask" を assertion)
- `fixtures.ts` の `promptVersion` を `v5` に追従

### T6-2. プラグイン deploy + curl で v5 Agent の作成を確認 `[ ]`
- `pnpm run deploy` で v52 → v53 へ
- `GET /v1/agents` で promptVersion=v5 Agent が `kintone-delete-records: always_ask` で作成されていること確認

---

## 7. テスト整備 (統合・E2E)

### T7-1. `ChatPanel.test.tsx` に HITL シナリオを追加 `[ ]`
- 承認シナリオ: tool_confirmation_required → 承認ボタン → POST 検証 → tool_result(success) で緑
- 却下シナリオ: 却下ボタン → POST 検証 → tool カード error 状態
- fetch モックは既存パターン (vi.stubGlobal) に揃える

### T7-2. `e2e/hitl-approval.spec.ts` 新規作成 (Playwright + page.route mock) `[ ]`
- `auth.setup.ts` / `credential-bind.setup.ts` を **使わない** project 設定 (もしくは既存 project 内で `route` で全 Anthropic 通信を mock)
- 缶詰イベント sequence で承認 / 却下の 2 シナリオ (各 30 秒以内目標)
- DOM 上の data-attr (running / success / error / pending-confirmation) と承認ボタン実クリック → POST body 検証

### T7-3. `live-with-mcp.spec.ts` に tool カード存在アサート 1 行追加 `[ ]`
- read 系シナリオで `[data-msg-kind="tool"]` が 1 つ以上存在することを確認するだけ
- LLM 不安定の影響を最小化するため軽量

---

## 8. リリース

### T8-1. typecheck + 全 unit test green を確認 `[ ]`
- `pnpm -r typecheck` / `pnpm -r test` が通ること
- 既存 267 + 80 が割れていないこと、追加分が pass

### T8-2. レビュー (`/simplify`) `[ ]`
- 3 観点 (reuse / quality / efficiency) で並列レビュー → 該当箇所修正

### T8-3. 2 段コミット `[ ]`
- コミット 1: コア (T1〜T5) — UI + ロジック + API
- コミット 2: Agent + テスト (T6〜T7) — promptVersion v5 + HITL シナリオ
- (任意) コミット 3: refactor — `/simplify` 修正分

---

## 9. 受入条件チェック

requirements.md §F1 / §F2 の受入条件に対応:

- [ ] レコード追加・更新・削除のシナリオでツールと引数がカードで見える (F1-1, F1-2)
- [ ] ツール失敗時にエラー内容が画面で確認できる (F1-3)
- [ ] **削除を依頼すると承認ボタンが出る** (F2-1, F2-2)
- [ ] 却下を選ぶと Agent が中止する (F2-2)

T0 以外の全タスク完了 + 上記 4 項目チェック後、本バッチを close する。
