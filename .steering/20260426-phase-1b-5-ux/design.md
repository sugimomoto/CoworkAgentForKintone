# Phase 1b-5 — UX 強化 設計 (1st バッチ)

requirements.md のうち、まず以下の **5 項目** を対象とする:

| ID | 内容 |
|---|---|
| F1-1 | tool_use を「ツール実行カード」として表示 |
| F1-2 | tool_use → tool_result を同一カードに集約 |
| F1-3 | 失敗 tool_call は赤系 + エラー本文折り畳み |
| F2-1 | 破壊的ツールを `permission_policy: always_ask` に切替 |
| F2-2 | 確認イベント受信 → 承認 / 却下ボタン UI |

スピナー (F1-4)、引数編集 (F2-3)、エラー UX (F3-*)、Composer (F4-*)、セッション操作 (F5-*) は **本バッチ対象外** (別 design 回しで対応)。

---

## 1. 全体フロー

```
   ┌────────────────────────────────────────────────────────────┐
   │ Session events (Anthropic API)                             │
   │   user.message → agent.thinking → agent.tool_use →         │
   │   [agent.tool_confirmation_required] → user.tool_confirmation │
   │   → agent.tool_result → agent.message → session.status_idle │
   └─────────────────┬──────────────────────────────────────────┘
                     │ fetchAllEventsSince (poll)
                     ▼
              eventInterpreter
                     │ ChatMessage[] (含む新 'tool' kind)
                     ▼
                chatStore.mergeMessage / updateTool
                     │
                     ▼
                 MessageList
                     │ kind 別 dispatch
                     ▼
              ToolCardMessage (新コンポーネント)
                     │ 状態: running / success / error / pending-confirmation
                     │
                     ▼ (pending-confirmation のみ)
              [承認] [却下] ボタン → postToolConfirmation()
```

---

## 2. データモデル変更

### 2.1 `ChatMessage` の拡張

[components/MessageList.tsx](packages/plugin/src/desktop/components/MessageList.tsx) の union に **`tool` kind** を追加:

```ts
export type ChatMessage =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'agent'; text: string }
  | { id: string; kind: 'thinking' }
  | {
      id: string;          // tool_use_id をそのまま使う
      kind: 'tool';
      name: string;        // 例: 'kintone-update-record'
      input: unknown;      // tool_use.input をそのまま保持
      status: 'running' | 'success' | 'error' | 'pending-confirmation';
      result?: unknown;    // tool_result.content (success / error 時)
      errorText?: string;  // is_error=true の content から抽出
    };
```

**id を `tool_use_id` にする理由**: `agent.tool_result.tool_use_id` で同一カードを更新する際、id ベースの突合が一番シンプル。`agent.tool_use.id` がそのまま `tool_use_id` として使われる前提。

### 2.2 store の拡張

新メソッドを追加 ([store/chatStore.ts](packages/plugin/src/store/chatStore.ts)):

```ts
/** 既存 tool message のステータス・result を更新する。見つからなければ no-op */
updateTool: (toolUseId: string, patch: Partial<ToolMessage>) => void;
```

`mergeMessage` は新規追加用、`updateTool` は既存カード更新用、と役割を分離する (mergeMessage を使い回しすると tool_use_id と message id の混在で意図せず重複する恐れ)。

### 2.3 `eventInterpreter` の拡張

`eventToMessage` の戻り値型を拡張し、**「新規追加」と「既存更新」を表現できる discriminated union** にする:

```ts
type InterpretedEvent =
  | { kind: 'add'; message: ChatMessage }
  | { kind: 'update-tool'; toolUseId: string; patch: Partial<ToolMessage> }
  | null;

export function interpretEvent(event: SessionEvent): InterpretedEvent {
  switch (event.type) {
    case 'agent.tool_use':
      return {
        kind: 'add',
        message: {
          id: event.id,           // ※ tool_use_id として後続で参照される
          kind: 'tool',
          name: event.name,
          input: event.input,
          status: 'running',
        },
      };
    case 'agent.tool_result': {
      const isError = (event as any).is_error === true;
      return {
        kind: 'update-tool',
        toolUseId: (event as any).tool_use_id,
        patch: {
          status: isError ? 'error' : 'success',
          result: (event as any).content,
          errorText: isError ? extractText((event as any).content) : undefined,
        },
      };
    }
    case 'agent.tool_confirmation_required':  // ← 仕様確認が必要 (下記注記)
      return {
        kind: 'update-tool',
        toolUseId: (event as any).tool_use_id,
        patch: { status: 'pending-confirmation' },
      };
    // 既存ケース (user.message / agent.message / agent.thinking) は kind:'add' に詰め直す
    ...
  }
}
```

既存の `eventToMessage` は廃止して `interpretEvent` に置き換え。`useEventPoller` 側で union を分岐:

```ts
const r = interpretEvent(e);
if (!r) continue;
if (r.kind === 'add') mergeMessage(r.message);
else updateTool(r.toolUseId, r.patch);
```

> **確定済み (T0-1 完了)**: 承認待ちは独立 event ではなく、**`session.status_idle` の `stop_reason.type === 'tool_confirmation_required'`** で通知される。`stop_reason.event_ids` に pending な `tool_use_id` 群が入る。`interpretEvent` は `session.status_idle` をハンドルして該当 tool message を `pending-confirmation` に遷移させる。

---

## 3. UI コンポーネント

### 3.1 新規: `ToolCardMessage`

配置: [components/MessageItem/ToolCardMessage.tsx](packages/plugin/src/desktop/components/MessageItem/ToolCardMessage.tsx)

**4 状態の見せ方**:

| status | 視覚 | 主要要素 |
|---|---|---|
| `running` | 灰枠 + 回転スピナー | ツール名 + 引数サマリ + "実行中…" |
| `success` | 緑枠 (薄め) + チェックアイコン | ツール名 + 結果サマリ (件数 / id) — 詳細は折り畳み |
| `error` | 赤枠 + 警告アイコン | ツール名 + エラーメッセージ (短縮) — 全文は折り畳み |
| `pending-confirmation` | オレンジ枠 + 警告アイコン | ツール名 + 引数全体 + **[承認] [却下]** ボタン |

**引数サマリ生成** (`buildArgsSummary(name, input)`):

- `kintone-add-record`: `app=42, fields=[title, status]` (キー一覧)
- `kintone-update-record`: `app=42, id=123` (id か updateKey の値)
- `kintone-delete-records`: `app=42, ids=[123, 124, 125] (3件)`
- `kintone-add-record-comment`: `record=123, text="..."` (text 先頭 30 文字)
- 既知ツール以外は `JSON.stringify(input).slice(0, 80) + '…'` でフォールバック

サマリ生成は `ToolCardMessage.tsx` 内に `function summarize(name, input)` として閉じる (1 つのファイルに収める)。

### 3.2 折り畳み詳細

`<details>` を使う (依存追加なし):

```tsx
<details className="...">
  <summary className="cursor-pointer">詳細</summary>
  <pre className="text-[11px] ...">{JSON.stringify(input, null, 2)}</pre>
  {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
  {errorText && <div className="text-red-700">{errorText}</div>}
</details>
```

### 3.3 `MessageList.renderMessage` 拡張

`case 'tool'` を追加して `ToolCardMessage` を返すだけ。

---

## 4. HITL 承認フロー

### 4.1 Agent 側: `permission_policy` の切替

[resolveAgent.ts](packages/plugin/src/core/bootstrap/resolveAgent.ts) の `KINTONE_TOOL_NAMES` に **書き込み判定**を加える:

```ts
const DESTRUCTIVE_TOOL_NAMES = new Set([
  'kintone-delete-records',
]);
// ※ update / add / comment はやり直しが効くので always_allow のまま。
//   delete だけは復元不能なのでユーザに確認させる。
```

`buildAgentTools` で per-tool config を組む際、`DESTRUCTIVE_TOOL_NAMES` に含まれるものは `permission_policy: { type: 'always_ask' }` にする:

```ts
configs: KINTONE_TOOL_NAMES.map((name) => ({
  name,
  enabled: true,
  permission_policy: {
    type: DESTRUCTIVE_TOOL_NAMES.has(name) ? 'always_ask' : 'always_allow',
  } as const,
})),
```

`DEFAULT_AGENT_PROMPT_VERSION` を **`v5`** に bump (`always_ask` 切替で旧 Agent と挙動が変わるため新規再作成)。

[fixtures.ts](packages/plugin/src/test/fixtures.ts) と [resolveAgent.test.ts](packages/plugin/src/core/bootstrap/resolveAgent.test.ts) の expectations を v5 に追従。新規テストとして "destructive tools should have always_ask policy" を 1 本追加。

### 4.2 確認 API

Anthropic Managed Agents API では、確認応答は session events への POST で行う想定:

```
POST /v1/sessions/{id}/events
{
  "events": [
    { "type": "user.tool_confirmation",
      "tool_use_id": "...",
      "decision": "approve" | "reject",
      "reason"?: "..."  // 却下時に Agent に伝えたい理由
    }
  ]
}
```

> **確定済み (T0-1 完了)**: 正しい payload は以下:
> ```ts
> { type: 'user.tool_confirmation', tool_use_id: '...', result: 'allow' | 'deny', deny_message?: string }
> ```
> `postToolConfirmation(sessionId, toolUseId, result, denyMessage?)` を [events.ts](packages/plugin/src/core/managed-agents/events.ts) に追加。`postUserMessage` と同じパターンで `POST /v1/sessions/{id}/events`。

### 4.3 UI ボタンの動作

`ToolCardMessage` の `status === 'pending-confirmation'` で表示する:

- **[承認]**: ボタン disable → `postToolConfirmation(sid, id, 'approve')` → 楽観的に `updateTool(id, { status: 'running' })`
- **[却下]**: 同上で `'reject'` → `updateTool(id, { status: 'error', errorText: '却下されました' })`

API 失敗時は status を `pending-confirmation` に戻して再試行可能にする (簡易リトライ)。

---

## 5. テスト方針

### 5.1 単体テスト

| 対象 | テスト内容 |
|---|---|
| `eventInterpreter.test.ts` | tool_use → add (kind:'tool', running)、tool_result → update-tool (status: success/error)、tool_confirmation_required → update-tool (pending-confirmation) |
| `chatStore.test.ts` (新規 or 既存に追加) | `updateTool` で対象 message のみ更新、見つからないとき no-op |
| `ToolCardMessage.test.tsx` (新規) | 4 状態のレンダ、折り畳み開閉、承認/却下ボタンクリックでハンドラ呼び出し |
| `MessageList.test.tsx` | `tool` kind が `ToolCardMessage` に dispatch される |
| `resolveAgent.test.ts` | DESTRUCTIVE のみ `always_ask`、それ以外は `always_allow`、promptVersion = 'v5' |

### 5.2 統合テスト

`ChatPanel.test.tsx` に **シナリオ 1 本** 追加:
1. tool_use イベント → tool カード (running) が表示
2. tool_confirmation_required → 承認/却下ボタンが出る
3. 承認クリック → `postToolConfirmation` 呼び出しを確認
4. tool_result (success) → カードが緑 + 結果表示

### 5.3 統合テスト (jsdom / vitest) ← 主軸

`ChatPanel.test.tsx` に **HITL シナリオ 1 本** を追加 (jsdom):

1. `useEventPoller` が呼ぶ fetch をモックし、以下のイベント列を返す:
   `user.message → agent.thinking → agent.tool_use(delete-records) → agent.tool_confirmation_required → (待ち)`
2. 期待する状態: tool カードが `pending-confirmation` で承認/却下ボタン表示
3. 承認ボタンをクリック → `POST /v1/sessions/{id}/events` が `user.tool_confirmation` の `decision: 'approve'` で呼ばれる
4. 続いて mock が `agent.tool_result(success) → agent.message → session.status_idle` を返す
5. 期待する最終状態: tool カードが `success`、agent message 表示、thinking 消去

却下シナリオも 1 本: 上記 3 で却下を押し、`decision: 'reject'` POST と tool カードが `error: '却下されました'` 状態になることを確認。

### 5.4 E2E (Playwright + page.route mock)

新規 spec: `e2e/hitl-approval.spec.ts` (既存 live spec とは別建て)

- `auth.setup.ts` / `credential-bind.setup.ts` は **使わない** (Anthropic 通信を全 mock するため bind 不要)
- Playwright の `page.route('**/api.anthropic.com/v1/sessions/**', ...)` で:
  - `POST /events` (user.message) → 200 OK
  - `GET /events` → 缶詰の event 列を順次返す (内部カウンタで段階的に返す canned fixtures)
  - `POST /events` (user.tool_confirmation) → 200 OK + 後続 events を unlock
- 検証:
  - tool カードの 4 状態が DOM 上で **正しい data-attr / 視覚クラス** を持つ
  - 承認/却下ボタンの実クリックで `POST /events` の body に正しい `decision` が入る
  - 折り畳み (`<details>`) の開閉

ロジックは jsdom (5.3) でカバー済なので、Playwright spec は **DOM / UX レイヤの確認に絞る** (シナリオ 1〜2 本程度、実行時間 30 秒以内目標)。

ライブ Agent の `live-with-mcp.spec.ts` には `[data-msg-kind="tool"]` の存在を 1 アサーション足す (read 系で当たる範囲のみ。HITL は mock spec で見る)。

---

## 6. 影響範囲

| ファイル | 変更種別 |
|---|---|
| `core/managed-agents/types.ts` | tool_confirmation_required 等の event 型追加 |
| `core/managed-agents/eventInterpreter.ts` | 戻り値 union 化、tool 系 case 追加 |
| `core/managed-agents/events.ts` | `postToolConfirmation` 追加 |
| `core/bootstrap/resolveAgent.ts` | DESTRUCTIVE_TOOL_NAMES, always_ask, v5 bump |
| `desktop/hooks/useEventPoller.ts` | interpretEvent の union 分岐 |
| `desktop/components/MessageList.tsx` | `tool` kind dispatch |
| `desktop/components/MessageItem/ToolCardMessage.tsx` | **新規** |
| `store/chatStore.ts` | `updateTool` 追加 |
| `src/test/fixtures.ts` | promptVersion v5 |
| 各種 *.test.ts | 上記対応 + 新規ケース |

依存ライブラリ追加なし、ビルド設定変更なし。

---

## 7. 確定済み API 仕様 (T0-1 で確認済み)

ソース: `.claude/skills/ClaudeManagedAgents/references/{events.md, api/sessions/events/send.md}`

| # | 項目 | 確定値 |
|---|---|---|
| 1 | 承認待ち通知 | `session.status_idle` の `stop_reason.type === 'tool_confirmation_required'`、`stop_reason.event_ids[]` に pending な `tool_use_id` |
| 2 | 確認応答 event type | `user.tool_confirmation` |
| 3 | 確認応答 payload | `{ type, tool_use_id, result: 'allow' \| 'deny', deny_message? }` |
| 4 | 却下時の Agent 挙動 | `deny_message` を Agent に渡せる (任意)。Agent はそれを踏まえて次の行動を判断する |
