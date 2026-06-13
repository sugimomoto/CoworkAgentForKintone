# 要求: リファクタリング Phase 2 — レイヤー是正 + 信頼性改善

## 背景

2026-06-11 実施のコードベース全体レビューで、plugin パッケージのレイヤリングに以下の問題が確認された。これらは Phase 3 (God ファイル分割) の前提となる土台整備であり、放置すると分割作業のたびに依存の向きが問題になる。

1. **core → desktop の依存逆転** — ビジネスロジック層が UI 層の型を import している:
   - `packages/plugin/src/core/managed-agents/eventInterpreter.ts:19` が `desktop/components/MessageList` から `ChatMessage` / `ToolMessage` を import
   - `packages/plugin/src/core/skills/chatPanelSkillsSync.ts:14` が `desktop/settings/SkillAddModal` から `CustomSkillInput` を import
   - 本来は core が型を定義し、UI が core から import する向きであるべき
2. **useSession がオーケストレーション層化** — `packages/plugin/src/desktop/hooks/useSession.ts:62-195` が hook 内で `resolveBuiltInAgents()` / `listCustomAgents()` / `resolveBootstrapEnvironment()` / ユーザーグループ取得 / ACL フィルタ / 初期 Agent 選択を直接実行している。React の hook 経由でしかテストできず、ブートストラップの単体テストに重いモックが必要
3. **カスタムツール応答のリトライが無限・固定間隔** — `packages/plugin/src/desktop/hooks/useCustomToolResponder.ts:21` で `RETRY_INTERVAL_MS = 3000` 固定、最大リトライ回数なし。POST 成功後の `user.custom_tool_result` エコーバックがロストすると永久にリトライし続ける
4. **セッション終了判定が 3 箇所に分散** — `useEventPoller.ts` 内で (a) `archived_at` / `status === 'terminated'` チェック、(b) `session.status_terminated` イベント、(c) `isTerminalEvent()` がそれぞれ独立に同じフラグを立てており、単一の真実源がない

## ゴール

- 依存の向きを「desktop → core」の一方向に統一し、core 層を React なしでテスト・再利用できる状態にする
- ブートストラップ処理を純粋な async 関数としてテスト可能にする
- カスタムツール応答リトライに上限とバックオフを導入し、無限リトライを排除する

## スコープ

- **A. チャット型定義の core 移動**: `ChatMessage` / `ToolMessage` ほかメッセージ系の型を `core/chat/types.ts` (新設) に移動。`MessageList.tsx` / `eventInterpreter.ts` / `chatStore.ts` / テスト群の import を core 参照に更新。`CustomSkillInput` も同様に core 側 (例: `core/skills/types.ts`) へ移動
- **B. ブートストラップの純関数化**: `core/bootstrap/initializeSession.ts` (新設) に useSession 内のオーケストレーションを移動し、`useSession` はキャンセル処理 + store への反映のみを担う薄いラッパーにする
- **C. リトライ戦略の導入**: `core/utils/retryWithBackoff.ts` (新設) — 指数バックオフ (初期 1s、上限 10s 程度)、最大リトライ回数 (5 回程度) を `useCustomToolResponder` に適用。上限到達時は pending から除去し、ユーザーに分かる形でエラー表示する
- **D. セッション終了判定の単一ソース化**: 終了判定ロジックを 1 箇所 (eventInterpreter または専用ヘルパー) に集約し、useEventPoller はその結果を参照するだけにする

### スコープ外

- chatStore / resolveAgent / 巨大コンポーネントの分割 (Phase 3)
- UI 共通コンポーネント化 (Phase 4)
- イベントポーリングのアーキテクチャ変更 (ポーリング→SSE 等は対象外)

## ユーザーストーリー

### US-1: プラグイン開発者 (機能追加担当)

> 私は core 層に新しいイベント解釈ロジックを追加したい。**core のテストが React / DOM のモックなしで書ける**なら、vitest で高速に TDD できる。UI の型に引きずられて import が循環する心配もしたくない。

### US-2: プラグイン開発者 (ブートストラップ改修担当)

> Phase 3 で Agent 解決ロジックを分割する予定だ。その前に**ブートストラップ全体が `initializeSession()` という 1 つの純関数になっていれば**、分割後の挙動が変わっていないことを関数の入出力だけで検証できる。

### US-3: 業務ユーザー

> Agent がアーティファクトを生成した直後にネットワークが不安定になった。**裏で永久にリトライが走り続ける**のではなく、数回の再試行後に「送信に失敗しました」と表示されて再操作できる方が安心だ。

## 受け入れ条件

### AC-1: core から desktop への import がゼロになる

- `grep -rn "from '.*desktop" packages/plugin/src/core/` が 0 件
- `ChatMessage` / `ToolMessage` / `CustomSkillInput` の定義元が core 配下にあり、UI 側は core から import している
- 既存テストが全て green (型移動のみで挙動変更なし)

### AC-2: initializeSession が純関数としてテストされている

- `core/bootstrap/initializeSession.ts` が React に依存せず、入力 (pluginId 等) → 出力 (解決済み agent / environment / ACL 適用済み一覧等) の async 関数である
- `initializeSession.test.ts` が renderHook なしで主要パス (正常系 / built-in 解決失敗 / ACL フィルタ) をカバー
- `useSession.ts` は 100 行未満になり、キャンセル処理と store 反映のみを担う
- 既存のブートストラップ挙動 (初期 Agent 選択の localStorage フォールバック含む) が変わらない

### AC-3: カスタムツール応答リトライに上限とバックオフがある

- `retryWithBackoff` ユニットテストが存在 (成功 / 最大回数到達 / バックオフ間隔) し green
- `useCustomToolResponder` が固定 3 秒の `setInterval` ではなくバックオフ付きリトライを使用
- 最大リトライ到達時: pending Map から該当 toolUseId が除去され、UI にエラーが表示される

### AC-4: セッション終了判定が 1 箇所に集約されている

- 終了判定 (`archived_at` / `status === 'terminated'` / `session.status_terminated` / terminal event) のロジックが単一のヘルパー関数にあり、useEventPoller はそれを呼ぶだけ
- 終了判定ヘルパーのユニットテストが各パターンをカバー

## 制約事項

- **挙動変更を伴わない構造変更が原則** (AC-3 のリトライ上限のみ意図的な挙動変更)
- 1 つの PR を大きくしすぎない: A (型移動) / B (純関数化) / C+D (信頼性) の 3 PR 程度に分割する
- 各 PR で `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green を維持
- Phase 1 (セキュリティ修正) の完了後に着手する
