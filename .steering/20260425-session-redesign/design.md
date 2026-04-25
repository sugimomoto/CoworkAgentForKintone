# Session 取り扱い再設計 — 設計

要件: [requirements.md](./requirements.md)

## 1. 全体方針

### 1.1 Session ライフサイクルの再定義

Phase 1a:
```
ページロード → useSession で Agent/Env/Session を全部解決 → Session を最新採用 or 新規
              → 即 poller 起動 → 過去イベント全件 fetch → 表示
```

新方針:
```
ページロード → useSession で Agent/Env のみ解決 (early bootstrap)
              → sessionId は null のまま、poller は無効
ユーザー初送信 → ensureSession() で Session を新規作成
              → sessionId 設定 → poller 起動 → 送信
履歴復元 → 一覧から選択 → sessionId 切替 → poller 再起動 → 既存イベントを順次 replay
新規会話 → sessionId を null に戻す + messages クリア → 初送信時 (AC-4) に戻る
```

### 1.2 Session = "会話スレッド"

これまで「ユーザー単位 1 本」だった Session を「ユーザー × 会話単位」に変更する。
metadata でフィルタする条件は変えない (`source` + `kintoneDomain` + `kintoneUserCode`)
が、結果は **複数件** 返る前提で扱う。

---

## 2. 影響モジュールと変更点

### 2.1 `core/bootstrap/resolveSession.ts`

既存の `resolveUserSession(ctx, { forceNew })` は **削除**。
代わりに以下を提供:

```ts
// 新規 Session を作る (常に作成、再利用しない)
export async function createUserSession(ctx: SessionContext): Promise<Session>

// 既存 Session 一覧をユーザーで絞って返す (新しい順)
export async function listUserSessions(
  ctx: Pick<SessionContext, 'agentId' | 'kintoneDomain' | 'kintoneUserCode'>
): Promise<Session[]>
```

`createUserSession` は中身としては今の `forceNew=true` パスとほぼ同じ
(metadata + 新規 createSession)。
`listUserSessions` は `listSessions({ agent_id, order: 'desc', limit: 100 })`
+ `filterByMetadata` の組合せ。

### 2.2 `desktop/hooks/useSession.ts`

責務分割:
- 起動時の Agent/Environment 解決は維持
- **Session 解決 (resolveUserSession 呼び出し) を削除**
- 新規送信時 / 履歴復元時に呼ぶための関数を返す:

```ts
interface UseSessionResult {
  ensureSession: () => Promise<string>           // 既存 sessionId があれば返す、無ければ作成
  selectSession: (id: string) => void            // 履歴から復元 (sessionId 設定 + messages クリア)
  startNewConversation: () => void               // sessionId を null に戻し messages クリア
}
```

`ensureSession` の重複防止: `Promise<string> | null` の `inFlightRef` を保持し、
連投で複数回呼ばれても同じ Promise を返す (NFR-3)。

### 2.3 `desktop/ChatPanel.tsx`

`handleSubmit` 修正:
```ts
const handleSubmit = async (text: string) => {
  let sid = sessionId;
  if (!sid) {
    try { sid = await ensureSession(); }
    catch { /* error 表示 */ return; }
  }
  // 楽観的 user message → postUserMessage(sid, text)
};
```

Composer の `disabled` 条件を変更: `status !== 'ready'` のみ。
Session 不在では disable しない (AC-3)。
`status` の意味は「Agent/Env bootstrap が ready」。

### 2.4 `store/chatStore.ts`

追加:
```ts
view: 'chat' | 'history'    // パネル内の表示モード
setView: (v) => void
```

`startNewConversation` セマンティクスを変更: `messages` クリア + `sessionId = null`。
既存の `resetConversation` はそのまま (messages のみクリア) として残し、
`startNewConversation` は store メソッド化する。

### 2.5 `desktop/HistoryView.tsx` (新規)

```tsx
export function HistoryView({ onSelect, onClose }): JSX.Element
```

責務:
- マウント時に `listUserSessions(ctx)` を呼ぶ
- ロード中 / エラー / 空 / 一覧 の 4 状態を描画
- 各エントリ: 作成日時 (相対) + ラベル
- ラベル取得: 一覧 API のレスポンスに `title` または最初の `user.message` がそのまま入っているとは限らない。
  Session オブジェクトから取れない場合は **エントリの非同期 fetch は今回は省略**し、
  `session.title || '(無題)'` で表示する (今の createUserSession は `makeInitialTitle` で
  日時タイトルを付けている — これを表示するだけで十分情報量がある)。
  - 将来 Phase で「最初の user.message の 30 文字」へ拡張 (要件 AC-9 より厳密版)

### 2.6 `desktop/components/Header.tsx`

履歴アイコンボタンを追加。
- `onHistoryClick?: () => void` を prop で受ける
- 現在の view (chat / history) によって押下で view を切替
- アイコンは時計巻き戻し風 (clock-rewind / list 系の SVG)

### 2.7 `desktop/App.tsx` または `ChatPanel.tsx` のレイアウト

`view === 'history'` のとき `<HistoryView />` を、
`view === 'chat'` のとき MessageList + Composer を描画する。
History → 戻るボタンは `setView('chat')`。

---

## 3. データフロー図

```
[mount] → useSession (Agent/Env のみ resolve)
       → status='ready', sessionId=null

[ユーザー初回送信]
   ChatPanel.handleSubmit(text)
     ├── sessionId が null
     ├── ensureSession() ── inFlight 保護
     │     └── createUserSession(ctx) → POST /v1/sessions
     │           ↳ session_xxx 返る
     ├── chatStore.setSessionId('session_xxx')
     ├── poller が enabled=true で起動 (effect 再実行)
     └── postUserMessage(session_xxx, text)

[履歴を開く]
   Header の履歴ボタン → setView('history')
   HistoryView マウント → listUserSessions() → 表示

[履歴から復元]
   HistoryView entry click
     ├── chatStore.resetConversation()  // messages クリア
     ├── chatStore.setSessionId('session_yyy')
     ├── chatStore.setView('chat')
     └── poller が sessionId 変更で effect 再実行
         → fetchAllEventsSince(undefined) で全件 asc 取得
         → user.message / agent.message を mergeMessage で順に追加

[新規会話]
   chatStore.startNewConversation()
     ├── messages = []
     └── sessionId = null
   → "初回送信" 状態に戻る
```

---

## 4. 詳細設計トピック

### 4.1 ensureSession の競合回避

```ts
const inFlightRef = useRef<Promise<string> | null>(null);

const ensureSession = useCallback(async () => {
  const existing = useChatStore.getState().sessionId;
  if (existing) return existing;
  if (inFlightRef.current) return inFlightRef.current;

  const p = (async () => {
    try {
      const s = await createUserSession(ctx);
      setSessionId(s.id);
      return s.id;
    } finally {
      inFlightRef.current = null;
    }
  })();
  inFlightRef.current = p;
  return p;
}, [...]);
```

### 4.2 poller 切替

`useEventPoller` の `enabled` は今は `status === 'ready'`。
変更後は `sessionId !== null` になる。
sessionId 変化に伴う effect 再実行で `lastEventIdRef` がリセットされるため
履歴復元時に過去イベントが先頭から replay される (既存の挙動)。

### 4.3 履歴一覧の表示状態

```
loading → fetch 中 (スピナ)
empty   → "まだ会話がありません"
error   → "履歴の取得に失敗しました ({message}) — 再試行"
list    → エントリ配列
```

### 4.4 chatStore.setView と panel open state の関係

`view` (chat / history) は store、
`isOpen` (panel 開閉) は localStorage バック (既存)。
独立して管理する — 履歴画面開いた状態でパネルを閉じても、再度開いたとき
「履歴画面のまま」復元する必要は無い。`view` はメモリ上のみ、リロードで chat に戻る。

### 4.5 既存テストへの影響

| テスト | 影響 | 対応 |
|---|---|---|
| `resolveSession.test.ts` | `resolveUserSession` 削除 | 新関数 `createUserSession` / `listUserSessions` のテストに書き直し |
| `useSession.test.ts` | Session 解決のフロー削除 | bootstrap が Agent/Env のみ呼ぶことを assert、`ensureSession` の競合制御テスト追加 |
| `ChatPanel.test.tsx` | sessionId なしでも Composer enabled | テスト更新 |
| `useEventPoller.test.ts` | 既存の sessionId-driven 動作は変えない | 変更不要 |
| `App.test.tsx` | view 切替 | 既存テストはそのまま、新規テストで view 切替を追加 |
| `e2e/live.spec.ts` 「リロード後にユーザー発言が復元される」 | リロード後は復元されなくなる | テストの意図を変更: 「履歴から開けば復元される」 |

### 4.6 metadata schema の更新は不要

createSession 時に書く metadata は変えない。
`source` + `kintoneDomain` + `kintoneUserCode` + `agentId` で
履歴一覧フィルタが成立する。

---

## 5. UI 概要

### 5.1 Header アイコン配置 (左から)

```
[Avatar] [name + status]   [履歴] [新規会話?] [設定] [閉じる]
```

新規会話ボタンは Phase 1a 設計時にも検討されていた (`startNewConversation`
が hook に存在する)。今回履歴と並べて常設する。

### 5.2 HistoryView レイアウト (ChatPanel と同じ枠内)

```
┌─────────────────────────────┐
│ Header (戻るボタン: ←)         │ ← onHistoryClick で戻る
├─────────────────────────────┤
│ 過去の会話                     │
│                              │
│ ▸ 新規会話 - 2026-04-25 10:30 │
│   2 時間前                    │
│ ▸ 新規会話 - 2026-04-24 18:11 │
│   昨日                        │
│   ...                        │
└─────────────────────────────┘
```

戻る動線は Header の履歴ボタンを再押下で view を chat に戻す
(同ボタンが toggle として機能)。

---

## 6. 段階的な実装順序

1. **Store**: `view` 追加、`startNewConversation` 化
2. **Bootstrap 層**: `createUserSession` / `listUserSessions` を `resolveSession.ts` に追加 (既存 `resolveUserSession` は一時並存 → ステップ 6 で削除)
3. **useSession**: Session 解決を停止、`ensureSession` 関数化
4. **ChatPanel**: handleSubmit に ensureSession を挿入、Composer disabled 条件緩和
5. **Header + ChatPanel**: 履歴ボタン追加、view に応じたレンダリング切替
6. **HistoryView**: 新規実装 + 一覧 fetch + 選択 → store 切替
7. **resolveUserSession の削除** + 既存テスト書換
8. **E2E**: 起動時クリーン状態 / 履歴開閉 / 履歴選択での復元 / 新規会話で sessionId クリアを追加 + 既存「リロード後復元」テストの意図変更

各ステップで unit test を先に書き (TDD)、緑→次の段階。
