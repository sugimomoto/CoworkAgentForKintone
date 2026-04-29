# Artifact 生成基盤 (Step 1: Foundation) — 設計

> **更新履歴 (実装結果反映)**:
> - 2026-04-29: Step 1 + 拡張 kind (mermaid/svg/html/csv) を実装。Custom Tool 配線・iframe sandbox・kintone 上 E2E まで完了。
> - 2026-04-29: 初期実装で見つかった以下の課題を反映してリファクタ:
>   - Custom Tool 定義 `type` を `'custom_tool'` → **`'custom'`** に修正 (Anthropic API 仕様)
>   - `user.custom_tool_result` の field 名を `tool_use_id` → **`custom_tool_use_id`** に修正
>   - `user.custom_tool_result` の `content` を string → **content block 配列** に修正
>   - `agent.custom_tool_use` には独立した `tool_use_id` フィールドは無く、`event.id` がそのまま custom_tool_use_id
>   - Custom Tool 応答処理を `useEventPoller` から **`useCustomToolResponder`** に分離
>   - `pendingCustomToolUseIds` を component ref から **chatStore に昇格**
>   - `isAgentRunning` (boolean) を補完する **`useAgentPhase()`** を追加 (`'idle' | 'running' | 'awaiting-confirm'`)
>   - Recharts の transitive deps (lodash 等) を `?bundle-deps` で同梱
>   - `?coworkDebug=1` クエリで debug ログ有効化、`?coworkE2e=1` で E2E テスト API 露出

## 1. 全体像

```
┌── Anthropic Managed Agents ─────────────────────────────────┐
│  Default Agent v7                                            │
│   tools: [agent_toolset_20260401, mcp_toolset(kintone),      │
│           ★ custom_tool: create_artifact]                    │
│   system: 「成果物は create_artifact で返す」を明記           │
└──────────┬──────────────────────────────────────────────────┘
           │ events stream (poll)
           │   agent.custom_tool_use { name:'create_artifact', input }
           ▼
┌── Plugin (kintone iframe) ──────────────────────────────────┐
│  useEventPoller                                              │
│   └─▶ eventInterpreter                                       │
│        └─▶ { kind:'add', message: ArtifactRefMessage }       │
│            { kind:'upsert-artifact', artifact }              │
│        └─▶ postCustomToolResult(sessionId, tool_use_id, ok)  │
│                                                              │
│  chatStore                                                   │
│   ├─ messages: ChatMessage[]   (ArtifactRefMessage を含む)   │
│   └─ artifacts: Map<id, Artifact>          ★ NEW             │
│                                                              │
│  ChatPanel                                                   │
│   ├─ MessageList → ArtifactRefTile (📄 タイル) [開く]        │
│   └─ ArtifactPane (右側 / オーバーレイ) ★ NEW                │
│        ├─ Header (title / kind / セレクタ / ×)               │
│        ├─ Body (kind 別レンダラ)                             │
│        │   ├─ markdown  → markdown-to-jsx                    │
│        │   ├─ code      → <pre><code> + 言語ラベル           │
│        │   ├─ json      → 整形 <pre>                         │
│        │   └─ react     → ReactArtifactFrame (sandbox iframe)│
│        └─ Footer (📋 コピー / ⬇ ダウンロード)                │
└──────────────────────────────────────────────────────────────┘
```

## 2. データモデル

### 2.1 `Artifact`

新規ファイル [packages/plugin/src/core/artifacts/types.ts](../../packages/plugin/src/core/artifacts/types.ts):

```ts
export type ArtifactKind =
  | 'markdown'
  | 'code'
  | 'json'
  | 'react'
  // 以下は Step 2+ で対応。受け取ったら placeholder 表示。
  | 'mermaid' | 'svg' | 'html' | 'kintone-customize-js' | 'csv';

export interface Artifact {
  id: string;            // 安定識別子 (Agent が指定)
  kind: ArtifactKind;
  title: string;
  language?: string;     // kind=code 時のヒント (任意)
  content: string;       // 本文
  summary?: string;      // 1 行要約 (任意)
  createdAt: number;     // 初回作成 epoch ms
  updatedAt: number;     // 最終更新 epoch ms
  version: number;       // 同 id で update されるごとに +1
}
```

### 2.2 `ArtifactRefMessage` (新 ChatMessage 種別)

[packages/plugin/src/desktop/components/MessageList.tsx](../../packages/plugin/src/desktop/components/MessageList.tsx) の `ChatMessage` union に追加:

```ts
export interface ArtifactRefMessage {
  id: string;            // tool_use イベントの id
  kind: 'artifact-ref';
  artifactId: string;    // Artifact.id (chatStore.artifacts のキー)
  title: string;         // 表示用 (artifact 削除されたとき向けのフォールバック)
  artifactKind: ArtifactKind;
}
```

会話ストリームには本文を埋め込まず、ID 参照だけ持たせる (artifact 本体は `chatStore.artifacts` から取得)。

### 2.3 chatStore 拡張

`ChatState` に追加:

```ts
artifacts: Map<string, Artifact>;
upsertArtifact(input: {
  id: string; kind: ArtifactKind; title: string;
  language?: string; content: string; summary?: string;
}): Artifact;       // 新規/更新後の Artifact を返す
removeArtifact(id: string): void;
clearArtifacts(): void;

// UI 用
activeArtifactId: string | null;
setActiveArtifact(id: string | null): void;
```

- `Map` を直接 `set` で渡しても Zustand は等値判定で再レンダしないので、**毎回新しい `Map` を作って差し替え**る (`new Map(prev).set(...)`)
- `startNewConversation` / `reset` で `clearArtifacts()` + `setActiveArtifact(null)` を併発
- session 切替時 (HistoryView から既存 session を開いたとき) も同様にクリア → events replay で再構築

## 3. Custom Tool 配線

### 3.1 Agent 側 (`resolveAgent.ts`)

```ts
const CREATE_ARTIFACT_TOOL = {
  type: 'custom_tool',
  name: 'create_artifact',
  description:
    '再利用可能な成果物を作成・更新する。コード / 図 / レポート / データなど、' +
    'ユーザーが参照・複製・適用したい内容を返すときに使う。' +
    '同じ id を渡すと既存 artifact の更新になる。',
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '安定識別子。同じ id で再呼び出しすると更新扱い' },
      kind: {
        type: 'string',
        enum: ['markdown', 'code', 'json', 'react'],
        description: 'markdown=レポート / code=コード片 / json=データ / react=React コンポーネント',
      },
      title: { type: 'string' },
      language: { type: 'string', description: 'kind=code 時の言語ヒント (例: javascript, python, sql)' },
      content: { type: 'string', description: '本体テキスト' },
      summary: { type: 'string', description: '1 行の要約 (任意)' },
    },
    required: ['id', 'kind', 'title', 'content'],
  },
  // permission_policy 省略 → デフォルト always_allow (UI 承認なしで即実行)
} as const;
```

`buildAgentTools` に追加。MCP の有無に依らず常に含める。

### 3.2 system プロンプト追記

`DEFAULT_AGENT_SYSTEM_PROMPT` に以下のブロックを追加し、`DEFAULT_AGENT_PROMPT_VERSION` を `'v6'` → `'v7'` に bump:

```
【成果物 (Artifact)】
  - レポート / コード / データ / グラフなど、ユーザーが「再利用・コピー・保存したい」内容を返すときは、
    本文を会話に直接書かず、create_artifact ツールで作成してください。
  - id は内容を表す英小文字+ハイフン (例: 'sales-report-2026Q1')。同じ artifact を更新したいときは
    同じ id を渡してください (= バージョンアップ)。新しい artifact にしたいときは別 id にしてください。
  - kind の選び方:
      * markdown: 説明的な文書、レポート、議事録
      * code: コード片 (language で言語を指定)
      * json: 構造化データ
      * react: グラフ・チャート・対話 UI を React コンポーネントで表現したいとき
  - kind=react の制約 (iframe sandbox 内で実行されます):
      * default export として **関数コンポーネント**を `export default function App() { ... }` の形で書く
      * 利用可能なグローバル: React (createElement / useState / useEffect 等), Recharts (チャート用)
      * 外部モジュールの import は **書かない** (esm.sh から事前ロード済みのものだけ使える)
      * Tailwind は使えません。inline style / 標準 CSS で書いてください。
      * 親 DOM / kintone API には触れません (sandbox により完全に分離されています)
  - 会話側には「artifact を作りました」とだけ伝え、本文は ペインに出ます。
```

### 3.3 Plugin 側のイベント送受信

#### イベント受信 (`useEventPoller` → `eventInterpreter`)

`SessionEvent` の union に `agent.custom_tool_use` / `agent.custom_tool_result` を明示:

```ts
| { type: 'agent.custom_tool_use'; id: string; tool_use_id?: string;
    name: string; input: unknown; processed_at: string }
| { type: 'agent.custom_tool_result'; id: string; tool_use_id: string;
    content?: unknown; is_error?: boolean; processed_at: string }
```

`interpretEvent` を **戻り値の union 拡張** か **配列戻り**にする (1 イベントから複数の副作用を生む)。今回は配列戻りに変える方が将来も使い回せるが、波及範囲が大きい。**最小変更**として:

- `interpretEvent` の戻り値を **配列**に変更 (`InterpretedEvent[] | null` ではなく `InterpretedEvent[]`)
- `useEventPoller` 側でループするだけ

`agent.custom_tool_use` (name === 'create_artifact') を見たら:

```ts
return [
  { kind: 'upsert-artifact', input: e.input, toolUseId: e.tool_use_id ?? e.id },
  { kind: 'add', message: { id: e.id, kind: 'artifact-ref', artifactId, title, artifactKind } },
];
```

`upsert-artifact` は `useEventPoller` で `chatStore.upsertArtifact` を呼ぶ + `postCustomToolResult` を発火。

#### イベント送信 (`postCustomToolResult`)

[packages/plugin/src/core/managed-agents/events.ts](../../packages/plugin/src/core/managed-agents/events.ts) に追加:

```ts
export async function postCustomToolResult(
  sessionId: string,
  toolUseId: string,
  result: { ok: true; artifactId: string } | { ok: false; error: string },
): Promise<void> {
  await apiRequest('POST', `/v1/sessions/${sessionId}/events`, {
    events: [
      {
        type: 'user.custom_tool_result',
        tool_use_id: toolUseId,
        content: JSON.stringify(result),
        is_error: !result.ok,
      },
    ],
  });
}
```

content は string (JSON) で返す (Anthropic 仕様)。

#### 重要: ターン進行を止めない

`agent.custom_tool_use` を受けると Anthropic 側は `session.status_idle` (stop_reason.type='custom_tool_use') を出して**停止する**。**plugin が `user.custom_tool_result` を返さないとターンが続かない**。`useEventPoller` で必ず即座に POST する設計にする。

#### Replay 安全性

`fetchAllEventsSince` で過去イベントを再取得した際、`agent.custom_tool_result` (= 過去の応答記録) も流れてくる。replay 時は:

- `agent.custom_tool_use` を見たら **chatStore に upsert** + ArtifactRefMessage 追加
- ただし、events 内に対応する `user.custom_tool_result` が**既に存在**する場合は **POST しない** (重複送信回避)

判定はループ中で `Set<tool_use_id>` を作って事前収集する (poll の各ラウンドで O(N) 1 回スキャン)。

## 4. UI 設計

### 4.1 ArtifactPane の配置

[packages/plugin/src/desktop/ChatPanel.tsx](../../packages/plugin/src/desktop/ChatPanel.tsx) のレイアウトを 2 カラム化:

```tsx
<div className="chat-shell">
  <div className="chat-shell__chat">{/* 既存の MessageList + Composer */}</div>
  {activeArtifactId && (
    <div className="chat-shell__artifact">
      <ArtifactPane artifactId={activeArtifactId} />
    </div>
  )}
</div>
```

- パネル幅 ≥ 1024px: 横並び (`flex: 1` チャット / `width: 480px` Artifact)
- パネル幅 < 1024px: Artifact ペインをオーバーレイ (`position: absolute; inset: 0; background: white; z-index: 10`)
- `useMatchMedia('(min-width: 1024px)')` ベースで切替

### 4.2 ArtifactRefTile (会話ストリーム内タイル)

[packages/plugin/src/desktop/components/MessageItem/ArtifactRefMessage.tsx](../../packages/plugin/src/desktop/components/MessageItem/ArtifactRefMessage.tsx) を新設:

```
┌─────────────────────────────────┐
│ 📄 アーティファクト作成          │
│ 売上レポート 2026Q1   [開く]     │
│ kind: markdown                   │
└─────────────────────────────────┘
```

クリックで `setActiveArtifact(artifactId)`。`MessageList` の switch に `'artifact-ref'` ケース追加。

### 4.3 ArtifactPane

[packages/plugin/src/desktop/components/ArtifactPane/](../../packages/plugin/src/desktop/components/ArtifactPane/) ディレクトリ新設:

```
ArtifactPane/
  index.tsx              ─ Header / Body / Footer の組み立て
  ArtifactHeader.tsx     ─ title, kind バッジ, セレクタ (複数 artifact 切替), × ボタン
  ArtifactFooter.tsx     ─ 📋 コピー, ⬇ ダウンロード
  renderers/
    MarkdownArtifact.tsx ─ markdown-to-jsx 流用
    CodeArtifact.tsx     ─ <pre><code> + 言語ラベル
    JsonArtifact.tsx     ─ JSON.stringify(parse, null, 2) で整形
    ReactArtifact.tsx    ─ iframe sandbox + srcdoc (詳細は §5)
    PlaceholderArtifact.tsx ─ 未対応 kind の raw 表示 + 注意書き
```

セレクタは複数 artifact がある場合に `<select>` ドロップダウンで切替 (タブ UI は将来検討)。

### 4.4 アクション

- **コピー**: `navigator.clipboard.writeText(artifact.content)`
- **ダウンロード**: `Blob` + `<a download>` で保存。拡張子マップ:
  | kind | 拡張子 | MIME |
  |---|---|---|
  | markdown | `.md` | `text/markdown` |
  | code | `.{ext}` (language から決定。fallback `.txt`) | `text/plain` |
  | json | `.json` | `application/json` |
  | react | `.jsx` | `text/plain` |
  | (他) | `.txt` | `text/plain` |
- ダウンロード関数は `core/artifacts/download.ts` に切り出して unit test 可能に

## 5. React Artifact のレンダリング

### 5.1 ReactArtifact コンポーネント

```tsx
function ReactArtifact({ artifact }: { artifact: Artifact }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="react-artifact">
      <ReactArtifactFrame
        code={artifact.content}
        onError={setError}
      />
      {error && <ErrorBanner text={error} />}
    </div>
  );
}
```

### 5.2 ReactArtifactFrame (sandbox iframe)

`<iframe sandbox="allow-scripts" srcdoc={...}>` を使う。`allow-same-origin` は付けない (= unique opaque origin)。

#### srcdoc テンプレート

```html
<!doctype html>
<html><head><meta charset="utf-8" />
<style>html,body,#root{margin:0;padding:0;height:100%;font-family:system-ui,sans-serif}</style>
</head>
<body>
<div id="root"></div>
<script type="module">
  const post = (type, payload) => parent.postMessage({ source: 'artifact', type, payload }, '*');
  try {
    post('boot', null);
    const [ReactNS, ReactDOMNS, RechartsNS, BabelNS] = await Promise.all([
      import('https://esm.sh/react@18.3.1'),
      import('https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1'),
      import('https://esm.sh/recharts@2.12.7?deps=react@18.3.1,react-dom@18.3.1'),
      import('https://esm.sh/@babel/standalone@7.25.6'),
    ]);
    const React = ReactNS.default || ReactNS;
    Object.assign(React, ReactNS); // useState etc.
    window.React = React;
    window.Recharts = RechartsNS;

    const userCode = __USER_CODE__;
    const transformed = BabelNS.transform(userCode, {
      presets: [['env', { modules: 'cjs' }], 'react'],
      filename: 'artifact.jsx',
    }).code;

    // CommonJS shim — `export default` を transformed が exports.default に書き換える
    const module = { exports: {} };
    const exports = module.exports;
    new Function('React', 'Recharts', 'module', 'exports', transformed)
      (React, RechartsNS, module, exports);
    const Component = (module.exports.default || module.exports);
    if (typeof Component !== 'function') throw new Error('default export must be a function component');

    ReactDOMNS.createRoot(document.getElementById('root'))
      .render(React.createElement(Component));
    post('rendered', null);
  } catch (err) {
    post('error', String(err && err.stack || err));
  }
  // 実行時エラーキャッチ
  window.addEventListener('error', (e) => post('error', String(e.error?.stack || e.message)));
  window.addEventListener('unhandledrejection', (e) => post('error', String(e.reason?.stack || e.reason)));
</script>
</body></html>
```

`__USER_CODE__` は `JSON.stringify(artifact.content)` で文字列リテラル化して埋め込む (HTML エスケープ不要)。

#### 親側

- `useEffect` で `addEventListener('message', ...)` を貼り、`source === 'artifact'` のものだけ拾う
- `type === 'error'` で `onError(payload)`、`'rendered'` で `onError(null)`
- iframe は **artifact ごとに新規生成** (key={artifact.id + version}) → version 更新で完全リロード

### 5.3 セキュリティと信頼境界

| 観点 | 対策 |
|---|---|
| 親 DOM への XSS | sandbox `allow-scripts` のみ (`allow-same-origin` 無し) → 親 DOM・cookie・localStorage に**触れない** |
| kintone API への不正アクセス | 同上 (origin が unique opaque) |
| 親への postMessage 偽装 | `source === 'artifact'` チェックで弾く。`event.origin === 'null'` も許容 (sandbox の origin が null) |
| 親 → iframe への info leak | postMessage は使わない (= 一方向) |
| ネットワーク濫用 | esm.sh / 任意 fetch は許可せざるを得ない (CSP が iframe sandbox に効かない)。Step 1 では受容、悪用シナリオは Step 4 で再検討 |

### 5.4 バンドルへの影響

- React/ReactDOM/Recharts/Babel は **iframe 内で esm.sh から取得** → 親バンドルに含めない
- 親バンドル増加: 新規ソース (Artifact 関連 .tsx ~10 ファイル + 約 600 行) で **概算 +5KB (gzipped)**
- 初回 React artifact 表示時に CDN ラウンドトリップ (esm.sh + Babel ~= 200KB の gzipped 取得) → **2 回目以降はブラウザキャッシュ**

## 6. 既存コードへの変更まとめ

| ファイル | 変更内容 |
|---|---|
| `core/managed-agents/types.ts` | `SessionEvent` に `agent.custom_tool_use` / `agent.custom_tool_result` を明示 |
| `core/managed-agents/events.ts` | `postCustomToolResult` を追加 |
| `core/managed-agents/eventInterpreter.ts` | 戻り値を `InterpretedEvent[]` に変更 + `agent.custom_tool_use` ハンドラ |
| `core/bootstrap/resolveAgent.ts` | `CREATE_ARTIFACT_TOOL` を tools に追加、`DEFAULT_AGENT_PROMPT_VERSION` を v7 へ、system プロンプト更新 |
| `core/artifacts/types.ts` | (新規) `Artifact`, `ArtifactKind` |
| `core/artifacts/download.ts` | (新規) ダウンロード処理 |
| `store/chatStore.ts` | `artifacts`, `activeArtifactId`, `upsertArtifact`, `removeArtifact`, `clearArtifacts`, `setActiveArtifact` を追加。`reset` / `startNewConversation` で artifacts 初期化 |
| `desktop/components/MessageList.tsx` | `ChatMessage` union に `ArtifactRefMessage` 追加、switch 拡張 |
| `desktop/components/MessageItem/ArtifactRefMessage.tsx` | (新規) タイル UI |
| `desktop/components/ArtifactPane/*` | (新規) ペイン本体 |
| `desktop/ChatPanel.tsx` | レイアウト 2 カラム化、`useMatchMedia` 切替 |
| `desktop/hooks/useEventPoller.ts` | `interpretEvent` の戻り型変更に追従 + custom_tool_use の二次効果 (upsert / postResult) を実装 |
| `styles/global.css` | `.chat-shell`, `.chat-shell__artifact`, アニメ等 |

## 7. テスト戦略

| レイヤ | テスト |
|---|---|
| `chatStore` | `upsertArtifact` (新規 / 更新 / version インクリメント), `clearArtifacts`, `setActiveArtifact` |
| `eventInterpreter` | `agent.custom_tool_use` → 配列戻り (upsert + add) を検証。既存ケースの戻り型移行も網羅 |
| `events` | `postCustomToolResult` の URL / body フォーマット |
| `useEventPoller` | replay 時に `user.custom_tool_result` が既存なら POST しないこと |
| `ArtifactPane` | 各 kind がそれぞれ正しいレンダラを呼ぶ。コピー / ダウンロードのコールバック起動 |
| `ReactArtifact` | iframe 生成 + postMessage error 受信 → エラー表示 (jsdom では実コードは走らないので mock) |
| `download.ts` | 拡張子マップ |
| `resolveAgent` | `tools` に `create_artifact` が含まれること、promptVersion='v7' |

実機検証 (manual):
- 「Markdown でレポートを作って」「JSON で売上を整形して」「棒グラフを React で書いて」の 3 シナリオを kintone 上で動かす
- ページリロード → artifacts が復元される
- 同じ id で 2 回呼ばれた artifact が更新される

## 8. ロールアウト / リスク

- **promptVersion bump** で既存ユーザーの Default Agent は新規作成される (旧 Agent は archive されず残る)。既存セッションの会話は新 Agent には引き継がれない (これは既存の挙動)
- **interpretEvent の戻り型変更** は破壊的変更。型レベルで補足できるので難易度は低いが、既存テストの修正が広範囲に及ぶ (~10 箇所)
- **CDN 依存** (esm.sh) : kintone 環境のオフライン動作はサポート外。閉域 kintone (オンプレ) で運用する顧客が出た場合は、Step 4 で React/Babel を同梱する fallback 分岐を入れる
- **iframe ネスト深さ**: kintone (iframe?) > プラグイン > artifact iframe の三段ネストになる。kintone Cloud 環境では問題なし、要素の高さ計算で躓いたら ResponsiveContainer の代替を検討

## 9. 最終アーキテクチャ (リファクタ後)

```
events stream                        chatStore                     hooks/components
─────────────                       ──────────                    ─────────────────
agent.custom_tool_use ───┐
                         ├─►  useEventPoller
                         │     └─ upsertArtifact
                         │     └─ addPendingCustomToolUse(toolUseId, artifactId)
                         │                                ┌─►  pendingCustomToolUseIds: Map
                         │                                │
user.custom_tool_result ─┤                                ├─►  useCustomToolResponder
                         │                                │     └─ POST /events
                         │                                │     └─ retry on failure
                         │     └─ removePendingCustomToolUse(id)
                         │
session.status_running ──┴─►   isAgentRunning = true
session.status_idle             │
  end_turn / max_tokens / err ─►  isAgentRunning = false
  requires_action ─────────────►  維持 (responder が POST → 続きの running 待ち)

UI 側:
  useAgentPhase() = 'idle' | 'running' | 'awaiting-confirm'
    ├─ pending-confirmation tool          → 'awaiting-confirm'
    ├─ isAgentRunning                     → 'running'
    ├─ pendingCustomToolUseIds.size > 0   → 'running'
    ├─ pending-thinking メッセージあり    → 'running'
    └─ それ以外                            → 'idle' (応答完了 divider 表示)
```

### 責務の分離

| モジュール | 責務 |
|---|---|
| **chatStore** | messages / artifacts / pendingCustomToolUseIds / isAgentRunning などの一元管理 |
| **useEventPoller** | events stream のポーリング、観測した event を chatStore に反映 (POST はしない) |
| **useCustomToolResponder** | chatStore.pendingCustomToolUseIds を購読、Anthropic に POST + リトライ |
| **useAgentPhase** | 上記から UI 用の `phase` を導出 (各コンポーネントは phase だけ見る) |

### デバッグ機能 (URL クエリで有効化)

| クエリ | 効果 |
|---|---|
| `?coworkDebug=1` | `[CoworkAgent:*]` プレフィックス付きで `console.info` ログを出す |
| `?coworkE2e=1` | `window.__coworkAgent` に upsertArtifact 等のテスト API を露出 (Playwright 用) |

## 10. 段階分割 (Step 1 内)

1. **Day 1**: 型定義 + chatStore 拡張 + eventInterpreter 戻り型変更 + 既存テスト追従
2. **Day 1 後半**: events.ts に `postCustomToolResult` + useEventPoller 配線
3. **Day 2**: resolveAgent.ts (tool 定義 / promptVersion bump) + 実機で `agent.custom_tool_use` が来ることを確認
4. **Day 2 後半**: ArtifactRefTile + ArtifactPane の骨組み + markdown / code / json レンダラ
5. **Day 3**: ReactArtifact + iframe srcdoc + postMessage / error 表示
6. **Day 3 後半**: コピー / ダウンロード / ペインのレスポンシブ + 全体の手動シナリオテスト
