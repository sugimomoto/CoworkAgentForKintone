// Cowork Agent for kintone — Agent ターン進行中の「現在の局面」を 1 つの enum に
// マッピングする純関数。`useEventPoller` が受信した SessionEvent を見て、
// 進行インジケータが何を表示すべきかを決める材料を抽出する。

import type { SessionEvent } from './types';

/**
 * 進行インジケータが表示する「Agent が今何をしているか」の状態種別。
 * - thinking         : 推論中 (Anthropic 側で extended thinking 等)
 * - tool_use         : ツール呼び出し中 (組み込み + MCP の両方)
 * - tool_result      : ツール完了直後、結果を LLM が読んでいる段階
 * - custom_tool_use  : Custom Tool 呼び出し中 (create_artifact 等)
 * - message          : agent.message を生成中
 */
export type ProgressEventKind =
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'custom_tool_use'
  | 'message';

/**
 * `SessionEvent` を `ProgressEventKind` (+ tool 名) にマッピングする。
 * 進行表示に意味のある event だけ返し、それ以外 (`session.*` / `span.*` / `user.*` 等) は null。
 */
export function mapEventToProgressKind(
  e: SessionEvent,
): { kind: ProgressEventKind; toolName?: string } | null {
  switch (e.type) {
    case 'agent.thinking':
      return { kind: 'thinking' };
    case 'agent.tool_use':
    case 'agent.mcp_tool_use': {
      const name = (e as { name?: unknown }).name;
      return typeof name === 'string'
        ? { kind: 'tool_use', toolName: name }
        : { kind: 'tool_use' };
    }
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
