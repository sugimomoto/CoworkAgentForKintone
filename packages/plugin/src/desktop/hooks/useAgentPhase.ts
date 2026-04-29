// Agent ターンの「現在の局面」を 1 つの enum に集約する derived selector。
//
// 既存の `isAgentRunning` (boolean) は内部的に維持しつつ、UI 側はこの phase だけを
// 見れば良い。pending-confirmation / pending custom_tool / optimistic thinking など
// 個別のフラグを各コンポーネントで再計算するのを止めるための薄いラッパ。
//
//   idle             — 何もしていない。Composer 入力可、応答完了 divider 表示
//   running          — Agent ターン進行中 (推論 / tool 実行 / custom_tool 応答中)
//   awaiting-confirm — 破壊的ツール (delete-records 等) のユーザー承認待ち
//
// `awaiting-custom-tool` (= Anthropic が plugin の custom_tool_result を待つ状態) は
// **`running` に含める** 設計にする。ユーザーから見ると「まだ動いている」のと同じ。
// useCustomToolResponder が裏で POST するので UI は何もしない。

import { useChatStore } from '../../store/chatStore';

export type AgentPhase = 'idle' | 'running' | 'awaiting-confirm';

export function useAgentPhase(): AgentPhase {
  const isAgentRunning = useChatStore((s) => s.isAgentRunning);
  const messages = useChatStore((s) => s.messages);
  const pendingCustomToolSize = useChatStore((s) => s.pendingCustomToolUseIds.size);

  // 承認待ちは isAgentRunning に関係なく最優先で識別する。
  // (pending-confirmation の tool message が 1 つでもあれば awaiting-confirm)
  if (messages.some((m) => m.kind === 'tool' && m.status === 'pending-confirmation')) {
    return 'awaiting-confirm';
  }
  // 公式 running、未応答 custom_tool あり、オプティミスティック thinking あり、
  // のいずれかなら running 扱い。
  if (isAgentRunning) return 'running';
  if (pendingCustomToolSize > 0) return 'running';
  if (messages.some((m) => m.kind === 'thinking' && m.id.startsWith('pending-'))) {
    return 'running';
  }
  return 'idle';
}
