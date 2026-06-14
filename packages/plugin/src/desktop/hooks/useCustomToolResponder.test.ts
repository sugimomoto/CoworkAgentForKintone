import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { postCustomToolResult } from '../../core/managed-agents/events';
import { useChatStore } from '../../store/chatStore';

import { useCustomToolResponder } from './useCustomToolResponder';

vi.mock('../../core/managed-agents/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/managed-agents/events')>();
  return {
    ...actual,
    postCustomToolResult: vi.fn(),
  };
});

const mockPost = vi.mocked(postCustomToolResult);

beforeEach(() => {
  vi.useFakeTimers();
  useChatStore.getState().reset();
  mockPost.mockReset();
  mockPost.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

function mount(props: { sessionId: string | null; enabled: boolean }) {
  return renderHook(() => useCustomToolResponder(props));
}

const pendingHas = (id: string): boolean =>
  useChatStore.getState().pendingCustomToolUseIds.has(id);
const hasErrorMessage = (id: string): boolean =>
  useChatStore.getState().messages.some((m) => m.id === `custom-tool-error-${id}`);

describe('useCustomToolResponder', () => {
  it('sessionId が null なら何もしない', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_1', 'a1');
    mount({ sessionId: null, enabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('enabled=false なら POST しない', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_1', 'a1');
    mount({ sessionId: 'sess_1', enabled: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('pending に追加されると postCustomToolResult が呼ばれる', async () => {
    mount({ sessionId: 'sess_1', enabled: true });
    expect(mockPost).not.toHaveBeenCalled();

    useChatStore.getState().addPendingCustomToolUse('tu_42', 'artifact-x');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockPost).toHaveBeenCalledWith('sess_1', 'tu_42', {
      ok: true,
      artifactId: 'artifact-x',
    });
  });

  it('成功しても pending からは削除しない (echo back を待つ)', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_42', 'artifact-x');
    mount({ sessionId: 'sess_1', enabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPost).toHaveBeenCalled();
    expect(pendingHas('tu_42')).toBe(true);
  });

  it('複数 pending をそれぞれ POST する', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_a', 'art-a');
    useChatStore.getState().addPendingCustomToolUse('tu_b', 'art-b');
    mount({ sessionId: 'sess_1', enabled: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenCalledWith('sess_1', 'tu_a', { ok: true, artifactId: 'art-a' });
    expect(mockPost).toHaveBeenCalledWith('sess_1', 'tu_b', { ok: true, artifactId: 'art-b' });
  });

  it('一時的な POST 失敗はバックオフ再試行で回復する', async () => {
    mockPost.mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
    useChatStore.getState().addPendingCustomToolUse('tu_x', 'art-x');
    mount({ sessionId: 'sess_1', enabled: true });

    await vi.advanceTimersByTimeAsync(0);
    expect(mockPost).toHaveBeenCalledTimes(1); // 1 回目失敗

    await vi.advanceTimersByTimeAsync(1000); // バックオフ後に 2 回目 → 成功
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(pendingHas('tu_x')).toBe(true); // echo back 待ち
    expect(hasErrorMessage('tu_x')).toBe(false);
  });

  it('POST が 5 回失敗すると諦めて pending 除去 + エラー表示', async () => {
    mockPost.mockRejectedValue(new Error('down'));
    useChatStore.getState().addPendingCustomToolUse('tu_x', 'art-x');
    mount({ sessionId: 'sess_1', enabled: true });

    // 1s + 2s + 4s + 8s のバックオフを挟んで計 5 回試行
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockPost).toHaveBeenCalledTimes(5);
    expect(pendingHas('tu_x')).toBe(false);
    expect(hasErrorMessage('tu_x')).toBe(true);
  });

  it('echo back が 60s 来ないと諦めて pending 除去 + エラー表示', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_x', 'art-x');
    mount({ sessionId: 'sess_1', enabled: true });

    await vi.advanceTimersByTimeAsync(0); // POST 成功
    expect(pendingHas('tu_x')).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000); // echo back タイムアウト
    expect(pendingHas('tu_x')).toBe(false);
    expect(hasErrorMessage('tu_x')).toBe(true);
  });

  it('echo back (pending 除去) が来ればタイムアウトは発火しない', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_x', 'art-x');
    mount({ sessionId: 'sess_1', enabled: true });
    await vi.advanceTimersByTimeAsync(0); // POST 成功 → echo timeout 開始

    // useEventPoller 相当: echo back 観測で pending から除去
    useChatStore.getState().removePendingCustomToolUse('tu_x');
    await vi.advanceTimersByTimeAsync(60_000);

    // タイムアウトでエラー表示されない
    expect(hasErrorMessage('tu_x')).toBe(false);
  });
});
