# 設計: リファクタリング Phase 2 — レイヤー是正 + 信頼性改善

## 概要

requirements.md の AC-1〜4 を満たす実装設計。4 つの独立した変更 (A〜D) を 3 PR に分けて実施する。A・B は挙動を変えない構造変更、C は意図的な挙動変更 (リトライ上限導入)、D は判定ロジックの集約。

## 依存の向きの原則 (本フェーズで確立するルール)

```
desktop/ (React UI, hooks)  →  store/  →  core/ (純粋ロジック, 型)
```

- core は React / DOM / desktop / store に依存しない
- store は core の型のみ import する
- このルールを `eslint-plugin-import` の `import/no-restricted-paths` で機械的に強制する (zones: core から desktop・store への import を禁止)

## A. チャット型定義の core 移動

### 現状

- `core/managed-agents/eventInterpreter.ts:19` → `desktop/components/MessageList` から `ChatMessage` / `ToolMessage` を import
- `core/skills/chatPanelSkillsSync.ts:14` → `desktop/settings/SkillAddModal` から `CustomSkillInput` を import

### 設計

1. **`core/chat/types.ts` (新設)** — `MessageList.tsx` で定義されているメッセージ系の型 (`ChatMessage` / `ToolMessage` / artifact 参照系メッセージ / kind の union 等) を移動。`MessageList.tsx` は `export type { ChatMessage, ToolMessage } from '../../core/chat/types'` で**再エクスポートを残す** (既存 import 箇所を壊さない移行措置。Phase 3 完了時に再エクスポートを削除して import を一斉更新)
2. **`core/skills/types.ts` (新設)** — `CustomSkillInput` / `SkillFileEntry` を `SkillAddModal.tsx` から移動。同様に再エクスポートを残す
3. `eventInterpreter.ts` / `chatPanelSkillsSync.ts` の import を core 参照に変更

確定事項: **型の「移動 + 再エクスポート」方式**を採る。import 箇所の一斉書き換えを伴う big-bang より、PR が小さく review しやすい。再エクスポート削除は Phase 3 の各分割 PR に同乗させる。

## B. ブートストラップの純関数化 (initializeSession)

### 現状

`desktop/hooks/useSession.ts:62-195` が effect 内で直接オーケストレーション:
resolveBuiltInAgents → listCustomAgents → resolveBootstrapEnvironment → fetchCurrentUserGroups / fetchCurrentUserOrganizations / resolveIsAdmin → filterAgentsByAccess → 初期 Agent 選択 (localStorage)。

### 設計

**`core/bootstrap/initializeSession.ts` (新設)**:

```typescript
export interface InitializeSessionInput {
  pluginId: string;
  /** localStorage から読んだ前回選択 Agent (UI 層で読み取って渡す) */
  preferredAgentId?: string | null;
}

export interface InitializeSessionResult {
  agents: AgentRecord[];          // ACL フィルタ適用済み
  initialAgentId: string;
  environmentId: string;
  isAdmin: boolean;
  bundledSkillIds: string[];      // 解決失敗時は [] (warn 済み)
}

export async function initializeSession(
  input: InitializeSessionInput,
  opts?: { signal?: AbortSignal },
): Promise<InitializeSessionResult>
```

確定事項:

- **localStorage の読み書きは hook 側に残す** (core を Web Storage 非依存に保つ)。core は `preferredAgentId` を入力として受け、候補にない場合のフォールバック選択ロジックだけを持つ
- **キャンセルは AbortSignal で表現**。`useSession` 側の `cancelled` フラグ方式を置き換え、各 await の後で `signal.aborted` をチェックして `DOMException('AbortError')` を throw。hook は AbortError を握りつぶす
- `useSession.ts` は「AbortController 管理 + initializeSession 呼び出し + store への setState 反映 + AbortError 処理」のみ (目標 100 行未満)
- 戻り値→store 反映のマッピングは hook 内に置く (store の形に core を縛らない)

### テスト

`initializeSession.test.ts` — resolve 系を vi.mock した純 async テスト (renderHook 不要):
正常系 / built-in 解決失敗 / ACL で全滅した場合のフォールバック / preferredAgentId が候補にない場合 / signal abort で AbortError。

## C. カスタムツール応答のリトライ戦略

### 現状

`desktop/hooks/useCustomToolResponder.ts` — POST 失敗 or echo back 待ちの間、`RETRY_INTERVAL_MS = 3000` 固定の setTimeout で無限再試行 (`useCustomToolResponder.ts:21,63-67`)。echo back がロストすると永久にリトライする。

### 設計

1. **`core/utils/retryWithBackoff.ts` (新設)**:
   ```typescript
   export interface RetryOptions {
     maxAttempts: number;      // default 5
     initialDelayMs: number;   // default 1000
     maxDelayMs: number;       // default 10000
     signal?: AbortSignal;
   }
   export async function retryWithBackoff<T>(fn: () => Promise<T>, opts?: Partial<RetryOptions>): Promise<T>
   ```
   倍々バックオフ (1s → 2s → 4s → 8s → 10s cap)。`signal` abort で即座に中断。
2. **useCustomToolResponder の再設計** — 2 種類の「待ち」を区別する:
   - **POST 失敗のリトライ**: `retryWithBackoff` で最大 5 回。超過したら該当 toolUseId を `removePendingCustomToolUse` し、`addMessage` でエラーメッセージ (`kind: 'error'` 相当の既存表現) を表示
   - **echo back 待ち**: POST 成功後のエントリは再 POST しない (現状は 3 秒ごとに再 POST し続ける)。POST 成功時刻を ref に記録し、**echo back タイムアウト (60s)** を超えたら同様に pending から除去 + エラー表示。inflightRef による二重送信防止は維持

確定事項: pending からの除去は「諦め」を意味するため、必ずユーザー可視のエラーメッセージとセットにする (silent drop しない)。

## D. セッション終了判定の単一ソース化

### 現状

`useEventPoller.ts` 内 3 箇所が独立に終了フラグを設定:
(a) `retrieveSession` の `archived_at !== null || status === 'terminated'`、(b) `session.status_terminated` イベント、(c) `isTerminalEvent()`。

### 設計

**`core/managed-agents/sessionLifecycle.ts` (新設)**:

```typescript
export type TerminationSignal =
  | { kind: 'session-state'; session: Pick<SessionRecord, 'status' | 'archived_at'> }
  | { kind: 'event'; event: SessionEvent };

export function isTerminated(signal: TerminationSignal): boolean
```

(a)(b)(c) の判定条件を全てこの関数に集約し、`useEventPoller` は受け取った signal を渡して結果で `setSessionTerminated(true)` を呼ぶだけにする。判定パターンごとのユニットテストを `sessionLifecycle.test.ts` に置く。

## 変更ファイル一覧

| ファイル | 変更 | PR |
|---|---|---|
| `core/chat/types.ts` (新) | メッセージ型定義 | PR-1 |
| `core/skills/types.ts` (新) | CustomSkillInput 系 | PR-1 |
| `desktop/components/MessageList.tsx` / `desktop/settings/SkillAddModal.tsx` | 型定義を削除し core から再エクスポート | PR-1 |
| `core/managed-agents/eventInterpreter.ts` / `core/skills/chatPanelSkillsSync.ts` | import 先変更 | PR-1 |
| `eslint.config.js` | `import/no-restricted-paths` zone 追加 | PR-1 |
| `core/bootstrap/initializeSession.ts` (新) + test | ブートストラップ純関数 | PR-2 |
| `desktop/hooks/useSession.ts` | 薄いラッパー化 (<100 行) | PR-2 |
| `core/utils/retryWithBackoff.ts` (新) + test | バックオフユーティリティ | PR-3 |
| `desktop/hooks/useCustomToolResponder.ts` | リトライ上限 + echo back タイムアウト | PR-3 |
| `core/managed-agents/sessionLifecycle.ts` (新) + test | 終了判定の集約 | PR-3 |
| `desktop/hooks/useEventPoller.ts` | 終了判定をヘルパー呼び出しに置換 | PR-3 |

## 影響範囲

- PR-1 / PR-2: ユーザー可視の挙動変更なし (純粋な構造変更)
- PR-3: リトライ上限到達時に新しいエラーメッセージが表示される (新規挙動)。正常系は不変
- Worker / kintone-mcp: 変更なし

## PR 分割

1. **PR-1**: A (型移動) + ESLint ルール — 機械的・低リスク
2. **PR-2**: B (initializeSession 抽出) — 挙動同一性を既存テスト + 手動確認で担保
3. **PR-3**: C + D (信頼性改善) — 唯一の挙動変更を含む PR として独立レビュー
