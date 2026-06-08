# 設計: 進行インジケータ + 応答遅延バナー廃止 (Issue #53)

## 概要

requirements.md の AC-1〜9 を満たす実装設計を確定する。3 つの変更を 1 PR で完了させる:

- **A.** 応答遅延バナーと `useElapsedSeconds(isAgentRunning)` のターン全体測定の削除
- **B.** `<ProgressIndicator />` を新規追加 (MessageList の右下にフロート) + chatStore に進行 metadata を追加
- **C.** メッセージリスト内の `agent.thinking` 由来表示を `<ThinkingStatic />` (アニメなし) に置換

## アーキテクチャ図

### データフロー

```
Anthropic API
    ↓ (event poll)
useEventPoller
    ↓ setLastEvent(at, kind, toolName?)    ← NEW
chatStore
    ↓
ProgressIndicator (subscribes to phase, lastEventAt, lastEventKind, lastToolName)
    ↓ 1s tick (内部 hook)
表示: 🟢 (アニメ) <label> · <elapsed>s
```

### DOM レイアウト (ChatPanel 内)

```
<div column flex>
  <MessageList>
    <div relative flex flex-col flex-1>             ← NEW wrapper (relative)
      <div overflow-y-auto>...messages...</div>     ← 既存スクロール領域
      <ProgressIndicator class="absolute bottom-[10px] left-[10px] z-10" />  ← NEW
    </div>
  </MessageList>
  <ConversationUtilityBar />
  <Composer />
</div>
```

ProgressIndicator は MessageList の **スクロール領域の上に絶対配置** され、スクロールしない / Composer に重ならない。

## 検討項目の確定

### Q1: 進行インジケータの component 構造

**確定: 単独 component `<ProgressIndicator />` を新規作成**

- 配置場所: [`packages/plugin/src/desktop/components/ProgressIndicator.tsx`](packages/plugin/src/desktop/components/ProgressIndicator.tsx)
- props: なし (chatStore に自前で subscribe)
- 表示判定: `useAgentPhase() === 'running'` のときのみ render
- DOM 配置: MessageList 内の relative wrapper の中に absolute positioned

理由:
- Composer に prop 追加すると Composer の責務が膨らむ (送信 + 中断 + 進行表示)
- MessageList overlay 案 (= ProgressIndicator を MessageList が直接 render) を採用 — 親 ChatPanel の階層を増やさない

### Q2: `lastEventAt` / `lastEventKind` / `lastToolName` の保持場所

**確定: chatStore に置く**

新規 state:
```ts
// store/chatStore.ts に追加
lastEventAt: number | null;          // Date.now() at last event receive
lastEventKind: ProgressEventKind | null;  // 'thinking' | 'tool_use' | 'tool_result' | 'custom_tool_use' | 'message' | null
lastToolName: string | null;         // tool_use のときだけ tool 名を保持
setLastEvent(at: number, kind: ProgressEventKind, toolName?: string | null): void;
clearLastEvent(): void;              // ターン終了時 (setAgentRunning(false)) と同時に呼ぶ
```

ProgressEventKind は新規 type (eventInterpreter かどこかに export):
```ts
export type ProgressEventKind = 'thinking' | 'tool_use' | 'tool_result' | 'custom_tool_use' | 'message';
```

ChatPanel は `lastEventAt` 等を subscribe しない (= ChatPanel の re-render は誘発しない)。ProgressIndicator のみが subscribe する。`phase === 'running'` のときのみマウントされるため影響範囲は最小。

代替案 (useEventPoller の ref 保持) を採らない理由: ref は React の reactive system に乗らないので、ProgressIndicator が更新を検知するために別途 forceUpdate が必要になり複雑化する。

### Q3: 経過秒の更新

**確定: `useElapsedSinceEvent(lastEventAt: number | null): number` 新規 hook を作る**

`useElapsedSeconds(active: boolean)` と類似のパターン:
```ts
// hooks/useElapsedSinceEvent.ts
export function useElapsedSinceEvent(lastEventAt: number | null): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (lastEventAt === null) {
      setSecs((s) => (s === 0 ? s : 0));
      return;
    }
    const tick = (): void => setSecs(Math.floor((Date.now() - lastEventAt) / 1000));
    tick();  // 即時 0 を入れる
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastEventAt]);
  return secs;
}
```

ProgressIndicator 内で `const elapsed = useElapsedSinceEvent(lastEventAt);` で取得。

`useElapsedSeconds` は ToolCard 側で引き続き使うので削除しない。

### Q4: アニメ要素のデザイン

**確定: 既存 `ThinkingDots` の dot 3 点アニメを再利用**

- ProgressIndicator の左端に dot アニメを配置 (現在の `ThinkingDots` と同じ CSS パターン)
- 既存 `ThinkingDots` 実装を 2 つに分ける (Q6 で確定):
  - `ThinkingDots` (アニメあり) — ProgressIndicator が使う
  - `ThinkingStatic` (アニメなし) — MessageList の thinking message が使う

マスコット / 別 SVG は採用しない (= スコープを最小に保つ)。色は accent (`var(--cw-accent)` = `#0d9488`) の dot。

### Q5: ツール名表示

**確定: 生の tool 名をそのまま表示**

例: 「ツール実行中: `kintone-get-records`」

- 辞書マッピングは作らない (= 別 issue 化候補。ユーザー向け文言は将来 V2 で検討)
- 長すぎる名前は CSS の `text-overflow: ellipsis` で省略
- `agent.tool_use` は MCP 系 (`kintone-get-apps` 等) と組み込み系 (`bash` / `read` / `write`) があるが、どちらも tool 名は短いので問題ない

### Q6: 静的「考え中…」の見た目

**確定: 新 component `<ThinkingStatic />` を作成。`ThinkingDots` (アニメあり) は残す**

- `<ThinkingStatic />`: `考え中…` のテキストのみを薄い muted 色で表示。アバター位置などは現 `ThinkingDots` と同レイアウト
- 配置: [`packages/plugin/src/desktop/components/MessageItem/ThinkingStatic.tsx`](packages/plugin/src/desktop/components/MessageItem/ThinkingStatic.tsx)
- `MessageList.tsx:163` の `<ThinkingDots />` を `<ThinkingStatic />` に置換
- `ThinkingDots` 自体は変更せず保持 (ProgressIndicator から再利用)

理由: `animated` prop を ThinkingDots に追加するより、見た目が異なる component を 2 つ持つ方が読みやすい。共通 CSS パターンは tailwind class でカバーできる。

### Q7: 90 秒超のテキスト緩和

**確定: 入れない**

- 60 秒以上の無音は **正常** (実セッションで 61s gap を観測済み)
- 90s で文言を変えると「あれ、おかしくなった?」と逆効果
- ずっと「思考中…」のままで OK

## コンポーネント仕様

### `<ProgressIndicator />`

```tsx
// packages/plugin/src/desktop/components/ProgressIndicator.tsx
import { useChatStore } from '../../store/chatStore';
import { useAgentPhase } from '../hooks/useAgentPhase';
import { useElapsedSinceEvent } from '../hooks/useElapsedSinceEvent';
import { ThinkingDots } from './MessageItem/ThinkingDots';
import { progressLabelOf } from '../../core/managed-agents/progressLabel';

export function ProgressIndicator(): JSX.Element | null {
  const phase = useAgentPhase();
  const lastEventAt = useChatStore((s) => s.lastEventAt);
  const lastEventKind = useChatStore((s) => s.lastEventKind);
  const lastToolName = useChatStore((s) => s.lastToolName);
  const elapsed = useElapsedSinceEvent(lastEventAt);

  if (phase !== 'running') return null;

  const label = progressLabelOf(lastEventKind, lastToolName);

  return (
    <div
      data-testid="progress-indicator"
      role="status"
      aria-live="polite"
      className="
        absolute bottom-[10px] left-[10px] z-10
        flex items-center gap-[6px]
        rounded-full border border-card-border bg-card/95 backdrop-blur
        px-[10px] py-[6px]
        text-[11px] text-muted
        shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        animate-[fade-in_150ms_ease-out]
        max-w-[280px]
      "
    >
      <ThinkingDots />
      <span className="truncate">{label}</span>
      <span className="text-subtle tabular-nums">·&nbsp;{elapsed}s</span>
    </div>
  );
}
```

### `<ThinkingStatic />`

```tsx
// packages/plugin/src/desktop/components/MessageItem/ThinkingStatic.tsx
import { AgentAvatar } from './AgentAvatar';

export function ThinkingStatic(): JSX.Element {
  return (
    <div className="flex items-start gap-[8px]">
      <AgentAvatar />
      <div className="pt-[2px] text-[12px] text-muted">考え中…</div>
    </div>
  );
}
```

### `progressLabelOf` (純関数)

```ts
// packages/plugin/src/core/managed-agents/progressLabel.ts
import type { ProgressEventKind } from './progressEvent';

export function progressLabelOf(
  kind: ProgressEventKind | null,
  toolName: string | null,
): string {
  switch (kind) {
    case 'thinking':
    case null:
      return '思考中…';
    case 'tool_use':
      return toolName ? `ツール実行中: ${toolName}` : 'ツール実行中…';
    case 'tool_result':
      return '結果を読んでいます…';
    case 'custom_tool_use':
      return 'アーティファクト処理中';
    case 'message':
      return '応答を組み立てています…';
  }
}
```

### chatStore 変更点 (差分のみ)

```ts
// store/chatStore.ts
+ import type { ProgressEventKind } from '../core/managed-agents/progressEvent';

  interface ChatStore {
    // ...existing fields...
+   lastEventAt: number | null;
+   lastEventKind: ProgressEventKind | null;
+   lastToolName: string | null;
+   setLastEvent: (at: number, kind: ProgressEventKind, toolName?: string | null) => void;
+   clearLastEvent: () => void;
  }

  const useChatStore = create<ChatStore>((set) => ({
    // ...existing initial state...
+   lastEventAt: null,
+   lastEventKind: null,
+   lastToolName: null,
+   setLastEvent: (at, kind, toolName) =>
+     set({ lastEventAt: at, lastEventKind: kind, lastToolName: toolName ?? null }),
+   clearLastEvent: () =>
+     set({ lastEventAt: null, lastEventKind: null, lastToolName: null }),

    setAgentRunning: (running) =>
      set((s) => {
        // ターン終了時に lastEvent もクリア (= ProgressIndicator が確実に消える)
        if (!running) {
          return { ...s, isAgentRunning: false, lastEventAt: null, lastEventKind: null, lastToolName: null };
        }
        return { ...s, isAgentRunning: true };
      }),
  }));
```

### useEventPoller 変更点 (差分のみ)

```ts
// desktop/hooks/useEventPoller.ts
+ import { mapEventToProgressKind } from '../../core/managed-agents/progressEvent';

  const setLastEvent = useChatStore((s) => s.setLastEvent);

  // poll() の中、event ループ内:
  for (const e of events) {
    const effects = interpretEvent(e);
    for (const r of effects) { /* ...既存... */ }
+   const progress = mapEventToProgressKind(e);
+   if (progress) {
+     setLastEvent(Date.now(), progress.kind, progress.toolName ?? null);
+   }
    // ...既存の status_running / terminal 判定...
  }
```

`mapEventToProgressKind` (純関数):
```ts
// core/managed-agents/progressEvent.ts
export type ProgressEventKind = 'thinking' | 'tool_use' | 'tool_result' | 'custom_tool_use' | 'message';

export function mapEventToProgressKind(
  e: SessionEvent,
): { kind: ProgressEventKind; toolName?: string } | null {
  switch (e.type) {
    case 'agent.thinking': return { kind: 'thinking' };
    case 'agent.tool_use':
    case 'agent.mcp_tool_use':
      return { kind: 'tool_use', toolName: (e as { name?: string }).name };
    case 'agent.tool_result':
    case 'agent.mcp_tool_result':
      return { kind: 'tool_result' };
    case 'agent.custom_tool_use':
      return { kind: 'custom_tool_use' };
    case 'agent.message':
      return { kind: 'message' };
    default:
      return null;
  }
}
```

### MessageList 変更点

```tsx
// desktop/components/MessageList.tsx
+ import { ProgressIndicator } from './ProgressIndicator';
- import { ThinkingDots } from './MessageItem/ThinkingDots';
+ import { ThinkingStatic } from './MessageItem/ThinkingStatic';

  return (
-   <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-[16px] py-[18px]">
+   <div className="relative flex flex-1 flex-col">          {/* NEW: relative wrapper */}
+     <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-[16px] py-[18px]">
        {messages.map(...)}
        {showCompletedDivider && ...}
+     </div>
+     <ProgressIndicator />                                   {/* NEW: bottom-left float */}
    </div>
  );

  // renderMessage 内:
  case 'thinking':
-   return <ThinkingDots />;
+   return <ThinkingStatic />;
```

### ChatPanel 変更点

```tsx
// desktop/ChatPanel.tsx
- import { useElapsedSeconds } from './hooks/useElapsedSeconds';
  // ...
- const elapsedSeconds = useElapsedSeconds(isAgentRunning);
- const SLOW_THRESHOLD_S = 30;
- const isSlow = isAgentRunning && elapsedSeconds >= SLOW_THRESHOLD_S;

  // ...

- {/* 応答遅延バナー */}
- {isSlow && (
-   <Banner testId="slow-response" actionLabel="中断" onAction={handleCancel}>
-     応答に時間がかかっています ({elapsedSeconds}秒経過)。...
-   </Banner>
- )}
```

`useElapsedSeconds` import は ToolCard も使っているので削除しない (= 別 file の import は残る)。

### CSS / Tailwind

`animate-[fade-in_150ms_ease-out]` のための keyframe を [`packages/plugin/src/styles/global.css`](packages/plugin/src/styles/global.css) に追加 (もしくは tailwind config で対応):

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

## テスト計画

### 削除

- `desktop/ChatPanel.test.tsx` の `slow-response` バナーケース (該当する記述があれば)
- `desktop/components/MessageItem/ThinkingDots.test.tsx` で「メッセージリストでアニメすること」を期待しているケース (あれば差し替え)

### 新規追加

| ファイル | テスト内容 |
|---|---|
| `core/managed-agents/progressLabel.test.ts` | `progressLabelOf` の各 kind / toolName 組合せ |
| `core/managed-agents/progressEvent.test.ts` | `mapEventToProgressKind` が `agent.thinking` / `*tool_use` / `*tool_result` / `agent.message` を正しく分類、未対応 event は null |
| `desktop/components/ProgressIndicator.test.tsx` | phase 別表示 / label 切替 / elapsed 表示 |
| `desktop/components/MessageItem/ThinkingStatic.test.tsx` | スナップショット (アニメ無しで「考え中…」と表示) |
| `desktop/hooks/useElapsedSinceEvent.test.ts` | lastEventAt 変更で 0 にリセット / null で 0 |
| `store/chatStore.test.ts` | `setLastEvent` / `clearLastEvent` / `setAgentRunning(false)` 連動 |

### 既存修正

- `chatStore.test.ts` の `setAgentRunning(false)` が lastEvent もクリアするケース追加

### 結合検証

- 実セッション (sesn_01DBCngSEghmYJYbh74vooYY) を再生して 61s gap でもインジケータが消えない / 警告が出ないことを目視確認 (= verify skill or playwright)

## エッジケース

| ケース | 期待挙動 |
|---|---|
| 並列 tool_use (今回観測: `get-form-fields` + `get-records` 同時) | 後勝ち (= 最後に届いた tool 名を表示)。`mapEventToProgressKind` を call 順に処理するので自然に最後の tool 名が残る |
| ツール名が長い | `truncate` + `max-w-[280px]` で ellipsis |
| `phase === 'awaiting-confirm'` (承認待ち) | インジケータ非表示 (= 承認カード自体が明確な指示) |
| ページ再読み込み中 | chatStore は初期化されるので `lastEventAt: null`。`phase === 'idle'` で非表示 |
| ネットワーク不通 | 既存 backoff で対応。インジケータは最後の event 種別を出し続け、経過秒は増え続ける (= 「思考中…・125s」のように見える) |
| Session terminated | `setAgentRunning(false)` で連動して `lastEvent` クリア → 自然に消える |
| 中断 (handleCancel) | `setAgentRunning(false)` 同上 |

## マイグレーションと互換性

- 既存 chatStore の他 field との互換性: 影響なし (追加のみ)
- localStorage 永続化対象 (もしあれば): `lastEventAt` 等は **永続化しない** (= ターン内のみ意味あり)
- 既存テストへの影響: `chatStore.test.ts` の `setAgentRunning(false)` ケースに lastEvent クリア検証を追加 (1 行)

## オープン項目 (実装前にもう一度確認したいこと)

- なし (= tasklist.md に進める)

## リスクと対応

| リスク | 対応 |
|---|---|
| ProgressIndicator の z-index が右ペイン (Artifact / Settings) と衝突 | `z-10` は MessageList overlay 用。右ペインは ChatPanel の別 div ツリーなので衝突しない。実装後 verify |
| 並列 tool_use のとき最後の tool 名しか出ない違和感 | 後勝ち仕様を accept (= 細粒度は ToolCard 側で見える)。並列ツール対応は別 issue |
| 60s+ 経過時に「動いてるけどラベル変わらない」=「壊れてる?」と誤解 | dot アニメが動き続けることで「生きてる」を担保。実セッション動作で許容を確認 |
| `fade-in` keyframe を global.css に追加する変更 | 局所スコープなので CSS module 化または `<style jsx>` も検討。tailwind plugin で animate-fade-in を追加できれば最善 |
