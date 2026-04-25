// Cowork Agent for kintone — Managed Agents イベント → ChatMessage 変換
//
// useEventPoller から呼ばれる pure な変換ロジック。
// Phase 1b で tool / plan / progress / result カードを増やす際もここを拡張する。

import type { ChatMessage } from '../../desktop/components/MessageList';
import type { SessionEvent } from './types';

/**
 * Managed Agents の SessionEvent を UI 用の ChatMessage に変換する。
 * 対応しないイベント (session.* / span.* など) は null を返す。
 */
export function eventToMessage(event: SessionEvent): ChatMessage | null {
  switch (event.type) {
    case 'user.message': {
      // セッション復元時にユーザー発言を画面に戻すため。
      const content = (event as { content?: unknown }).content;
      return { id: event.id, kind: 'user', text: extractText(content) };
    }
    case 'agent.message': {
      const content = (event as { content?: unknown }).content;
      return { id: event.id, kind: 'agent', text: extractText(content) };
    }
    case 'agent.thinking':
      return { id: event.id, kind: 'thinking' };
    default:
      return null;
  }
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

/**
 * Session のターン終了を示すイベントか判定する。
 * `session.status_idle` で `stop_reason.type` が `end_turn` または `retries_exhausted` のとき true。
 * これを返したイベント以降はポーリングを停止する。
 */
export function isTerminalEvent(event: SessionEvent): boolean {
  if (event.type !== 'session.status_idle') return false;
  const reason = (event as { stop_reason?: { type?: string } }).stop_reason;
  return reason?.type === 'end_turn' || reason?.type === 'retries_exhausted';
}
