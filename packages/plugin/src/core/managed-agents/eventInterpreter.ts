// Cowork Agent for kintone — Managed Agents イベント → UI 操作 の変換
//
// useEventPoller から呼ばれる pure な変換ロジック。
// 戻り値は discriminated union:
//   - { kind: 'add', message }            — 新規 ChatMessage を追加
//   - { kind: 'update-tool', toolUseId, patch } — 既存 tool message を id で部分更新
//   - null                                — 表示に関係しないイベント

import type { ChatMessage, ToolMessage } from '../../desktop/components/MessageList';
import type { SessionEvent } from './types';

export type InterpretedEvent =
  | { kind: 'add'; message: ChatMessage }
  | { kind: 'update-tool'; toolUseId: string; patch: Partial<Omit<ToolMessage, 'id' | 'kind'>> }
  | null;

export function interpretEvent(event: SessionEvent): InterpretedEvent {
  switch (event.type) {
    case 'user.message': {
      const content = (event as { content?: unknown }).content;
      return { kind: 'add', message: { id: event.id, kind: 'user', text: extractText(content) } };
    }
    case 'agent.message': {
      const content = (event as { content?: unknown }).content;
      return { kind: 'add', message: { id: event.id, kind: 'agent', text: extractText(content) } };
    }
    case 'agent.thinking':
      return { kind: 'add', message: { id: event.id, kind: 'thinking' } };
    // 組み込みツール (agent_toolset_20260401: bash/read/write 等) と
    // MCP ツール (kintone-* 等) は別イベント名で来るが、payload は同型なので同じ扱い。
    case 'agent.tool_use':
    case 'agent.mcp_tool_use': {
      const e = event as Extract<SessionEvent, { type: 'agent.tool_use' | 'agent.mcp_tool_use' }>;
      return {
        kind: 'add',
        message: {
          id: e.id,
          kind: 'tool',
          name: e.name,
          input: e.input,
          status: 'running',
        },
      };
    }
    case 'agent.tool_result':
    case 'agent.mcp_tool_result': {
      const e = event as Extract<
        SessionEvent,
        { type: 'agent.tool_result' | 'agent.mcp_tool_result' }
      >;
      // 組み込みツールは tool_use_id、MCP ツールは mcp_tool_use_id にリンク id が入る
      const toolUseId =
        e.type === 'agent.mcp_tool_result' ? e.mcp_tool_use_id : e.tool_use_id;
      const isError = e.is_error === true;
      return {
        kind: 'update-tool',
        toolUseId,
        patch: {
          status: isError ? 'error' : 'success',
          result: e.content,
          ...(isError ? { errorText: extractText(e.content) } : {}),
        },
      };
    }
    case 'session.status_idle': {
      const e = event as Extract<SessionEvent, { type: 'session.status_idle' }>;
      if (e.stop_reason.type !== 'tool_confirmation_required') return null;
      const ids = e.stop_reason.event_ids;
      if (!Array.isArray(ids) || ids.length === 0) return null;
      // 複数 pending は events stream 上通常 1 件のため最初の 1 件のみ処理。
      // 多重 pending を扱うなら interpretEvent を array 戻りに拡張する必要あり。
      return {
        kind: 'update-tool',
        toolUseId: ids[0]!,
        patch: { status: 'pending-confirmation' },
      };
    }
    default:
      return null;
  }
}

/**
 * Session のターン終了を示すイベントか判定する。
 * `session.status_idle` で `stop_reason.type` が `end_turn` または `retries_exhausted` のとき true。
 * tool_confirmation_required は **ターン終了ではない** (ユーザ応答待ち) ので false。
 */
export function isTerminalEvent(event: SessionEvent): boolean {
  if (event.type !== 'session.status_idle') return false;
  const reason = (event as { stop_reason?: { type?: string } }).stop_reason;
  return reason?.type === 'end_turn' || reason?.type === 'retries_exhausted';
}

/**
 * Anthropic 形式の content を表示用テキストに正規化する。
 * - string → そのまま
 * - Array<{type:'text', text}> → text を連結 (text 以外のブロックは無視)
 * - undefined/null → ''
 */
function extractText(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (b && typeof b === 'object' && 'type' in b && (b as { type: string }).type === 'text') {
          const text = (b as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return '';
}
