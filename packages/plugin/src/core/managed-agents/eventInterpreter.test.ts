import { describe, it, expect } from 'vitest';

import { eventToMessage, isTerminalEvent } from './eventInterpreter';

import type { SessionEvent } from './types';

describe('eventToMessage', () => {
  it('agent.message を agent kind の ChatMessage に変換', () => {
    const evt: SessionEvent = {
      id: 'evt_1',
      type: 'agent.message',
      content: 'こんにちは',
      processed_at: '2026-04-25T00:00:00Z',
    };
    expect(eventToMessage(evt)).toEqual({
      id: 'evt_1',
      kind: 'agent',
      text: 'こんにちは',
    });
  });

  it('user.message を user kind の ChatMessage に変換 (セッション復元用)', () => {
    const evt = {
      id: 'evt_user_1',
      type: 'user.message',
      content: [{ type: 'text', text: 'こんにちは' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(eventToMessage(evt)).toEqual({
      id: 'evt_user_1',
      kind: 'user',
      text: 'こんにちは',
    });
  });

  it('agent.thinking を thinking kind の ChatMessage に変換', () => {
    const evt: SessionEvent = { id: 'evt_2', type: 'agent.thinking', processed_at: '...' };
    expect(eventToMessage(evt)).toEqual({ id: 'evt_2', kind: 'thinking' });
  });

  it('未対応のイベント種別は null を返す', () => {
    const evt = {
      id: 'evt_3',
      type: 'session.status_running',
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(eventToMessage(evt)).toBeNull();
  });

  it('agent.message の content が text ブロック配列のとき text を連結する', () => {
    const evt = {
      id: 'evt_blocks',
      type: 'agent.message',
      content: [
        { type: 'text', text: 'こんにちは' },
        { type: 'text', text: '、世界' },
      ],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(eventToMessage(evt)).toEqual({
      id: 'evt_blocks',
      kind: 'agent',
      text: 'こんにちは、世界',
    });
  });

  it('agent.message の content に text 以外のブロックが混在しても落ちずに text のみ抽出', () => {
    const evt = {
      id: 'evt_mixed',
      type: 'agent.message',
      content: [
        { type: 'tool_use', id: 'tu_1', name: 'x' },
        { type: 'text', text: 'hello' },
      ],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(eventToMessage(evt)).toEqual({
      id: 'evt_mixed',
      kind: 'agent',
      text: 'hello',
    });
  });

  it('agent.message の content が undefined のときは空文字に正規化', () => {
    const evt = {
      id: 'evt_4',
      type: 'agent.message',
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(eventToMessage(evt)).toEqual({ id: 'evt_4', kind: 'agent', text: '' });
  });
});

describe('isTerminalEvent', () => {
  it('session.status_idle + stop_reason.end_turn は terminal', () => {
    const evt: SessionEvent = {
      id: 'evt_1',
      type: 'session.status_idle',
      stop_reason: { type: 'end_turn' },
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(true);
  });

  it('session.status_idle + stop_reason.retries_exhausted も terminal', () => {
    const evt: SessionEvent = {
      id: 'evt_2',
      type: 'session.status_idle',
      stop_reason: { type: 'retries_exhausted' },
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(true);
  });

  it('session.status_idle + 他の stop_reason は terminal ではない', () => {
    const evt: SessionEvent = {
      id: 'evt_3',
      type: 'session.status_idle',
      stop_reason: { type: 'requires_action' },
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(false);
  });

  it('agent.message は terminal ではない', () => {
    const evt: SessionEvent = {
      id: 'evt_4',
      type: 'agent.message',
      content: 'x',
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(false);
  });
});
