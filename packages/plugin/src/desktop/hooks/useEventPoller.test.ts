import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { useEventPoller } from './useEventPoller';

import type { SessionEvent } from '../../core/managed-agents/types';

vi.mock('../../core/managed-agents/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/managed-agents/events')>();
  return {
    ...actual,
    fetchAllEventsSince: vi.fn(),
  };
});

import { fetchAllEventsSince } from '../../core/managed-agents/events';

const mockFetch = vi.mocked(fetchAllEventsSince);

beforeEach(() => {
  useChatStore.getState().reset();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useEventPoller', () => {
  it('sessionId が null なら何もしない', () => {
    renderHook(() => useEventPoller({ sessionId: null, enabled: true }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('enabled=false なら何もしない', () => {
    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: false }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('マウント時に 1 回 fetchAllEventsSince を呼ぶ (sinceEventId=undefined)', async () => {
    mockFetch.mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith('sess_1', undefined);
  });

  it('取得した agent.message を store に追加する', async () => {
    const events: SessionEvent[] = [
      {
        id: 'evt_1',
        type: 'agent.message',
        content: 'こんにちは',
        processed_at: '2026-04-25T00:00:00Z',
      },
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => {
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.kind).toBe('agent');
    });
  });

  it('agent.thinking イベントも thinking kind として追加する', async () => {
    const events: SessionEvent[] = [
      { id: 'evt_1', type: 'agent.thinking', processed_at: '2026-04-25T00:00:00Z' },
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => {
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.kind).toBe('thinking');
    });
  });

  it('2 回目以降の呼び出しは最後に取得したイベント ID を since として渡す', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const first: SessionEvent[] = [
      {
        id: 'evt_1',
        type: 'agent.message',
        content: 'a',
        processed_at: '2026-04-25T00:00:00Z',
      },
    ];
    mockFetch.mockResolvedValueOnce(first).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    // 1 回目完了まで microtask を流す
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    // 初期ポーリング間隔を進める
    await vi.advanceTimersByTimeAsync(2500);
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'sess_1', 'evt_1');
  });

  it('agent.message を含むイベント受信時にオプティミスティック thinking を除去する', async () => {
    useChatStore
      .getState()
      .addMessage({ id: 'pending-thinking-1', kind: 'thinking' });
    useChatStore.getState().addMessage({ id: 'user-1', kind: 'user', text: 'hi' });

    const events: SessionEvent[] = [
      {
        id: 'evt_1',
        type: 'agent.message',
        content: 'hi back',
        processed_at: '2026-04-25T00:00:00Z',
      },
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => {
      const msgs = useChatStore.getState().messages;
      expect(msgs.some((m) => m.id.startsWith('pending-'))).toBe(false);
      expect(msgs.some((m) => m.id === 'evt_1')).toBe(true);
    });
  });

  it('agent.thinking だけが来た場合は pending を残し、API thinking もメッセージに追加する', async () => {
    // agent.thinking は中間思考。ユーザー的には "まだ処理中" なので pending dots は維持し、
    // 同時に API 由来の thinking メッセージも履歴に追加して経過を可視化する。
    useChatStore
      .getState()
      .addMessage({ id: 'pending-thinking-1', kind: 'thinking' });

    const events: SessionEvent[] = [
      { id: 'evt_thinking', type: 'agent.thinking', processed_at: '2026-04-25T00:00:00Z' },
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => {
      const msgs = useChatStore.getState().messages;
      expect(msgs.some((m) => m.id === 'evt_thinking')).toBe(true);
    });
    // pending は除去されない
    expect(useChatStore.getState().messages.some((m) => m.id.startsWith('pending-'))).toBe(true);
  });

  it('user.message のエコーだけが返るときは pending を除去しない', async () => {
    // session 復元のような状況で user.message だけ先に返るパターン。
    // pending を消してしまうと「応答が来ていない」のに dots が消えて UX が止まったように見える。
    useChatStore
      .getState()
      .addMessage({ id: 'pending-thinking-1', kind: 'thinking' });

    const events: SessionEvent[] = [
      {
        id: 'evt_user',
        type: 'user.message',
        content: [{ type: 'text', text: 'hi' }],
        processed_at: '2026-04-25T00:00:00Z',
      } as unknown as SessionEvent,
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    // user.message は来たが agent 活動はないので pending は残る
    await new Promise((r) => setTimeout(r, 50));
    expect(useChatStore.getState().messages.some((m) => m.id.startsWith('pending-'))).toBe(true);
  });

  it('terminal イベントが来たら agent.message が無くても pending を除去する', async () => {
    useChatStore
      .getState()
      .addMessage({ id: 'pending-thinking-1', kind: 'thinking' });

    const events: SessionEvent[] = [
      {
        id: 'evt_idle',
        type: 'session.status_idle',
        stop_reason: { type: 'end_turn' },
        processed_at: '2026-04-25T00:00:00Z',
      },
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => {
      expect(useChatStore.getState().messages.some((m) => m.id.startsWith('pending-'))).toBe(
        false,
      );
    });
  });

  it('events が空のときはオプティミスティック thinking を除去しない', async () => {
    useChatStore
      .getState()
      .addMessage({ id: 'pending-thinking-1', kind: 'thinking' });
    mockFetch.mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(useChatStore.getState().messages.some((m) => m.id.startsWith('pending-'))).toBe(true);
  });

  it('session.status_idle + stop_reason.end_turn 後は最大間隔 (10s) で待機継続', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const events: SessionEvent[] = [
      {
        id: 'evt_1',
        type: 'agent.message',
        content: 'ok',
        processed_at: '2026-04-25T00:00:00Z',
      },
      {
        id: 'evt_2',
        type: 'session.status_idle',
        stop_reason: { type: 'end_turn' },
        processed_at: '2026-04-25T00:00:00Z',
      },
    ];
    mockFetch.mockResolvedValueOnce(events).mockResolvedValue([]);

    renderHook(() => useEventPoller({ sessionId: 'sess_1', enabled: true }));

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    // 5 秒後 (max=10s) ではまだ 2 回目は呼ばれない
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 10 秒以上進めれば 2 回目が呼ばれる (terminal でも完全停止しない)
    await vi.advanceTimersByTimeAsync(6_000);
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
