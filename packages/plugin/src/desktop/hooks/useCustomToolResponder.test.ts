import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { useCustomToolResponder } from './useCustomToolResponder';

vi.mock('../../core/managed-agents/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/managed-agents/events')>();
  return {
    ...actual,
    postCustomToolResult: vi.fn(),
  };
});

import { postCustomToolResult } from '../../core/managed-agents/events';

const mockPost = vi.mocked(postCustomToolResult);

beforeEach(() => {
  useChatStore.getState().reset();
  mockPost.mockReset();
  mockPost.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCustomToolResponder', () => {
  it('sessionId が null なら何もしない', () => {
    useChatStore.getState().addPendingCustomToolUse('tu_1', 'a1');
    renderHook(() => useCustomToolResponder({ sessionId: null, enabled: true }));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('enabled=false なら POST しない', () => {
    useChatStore.getState().addPendingCustomToolUse('tu_1', 'a1');
    renderHook(() => useCustomToolResponder({ sessionId: 'sess_1', enabled: false }));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('pending に追加されると postCustomToolResult が呼ばれる', async () => {
    const { rerender } = renderHook(() =>
      useCustomToolResponder({ sessionId: 'sess_1', enabled: true }),
    );
    // 初期は空 → 何も呼ばれない
    expect(mockPost).not.toHaveBeenCalled();

    useChatStore.getState().addPendingCustomToolUse('tu_42', 'artifact-x');
    rerender();

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('sess_1', 'tu_42', {
      ok: true,
      artifactId: 'artifact-x',
    }));
  });

  it('成功しても pending からは削除しない (Anthropic 側 echo back を待つ)', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_42', 'artifact-x');
    renderHook(() => useCustomToolResponder({ sessionId: 'sess_1', enabled: true }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    // useEventPoller が user.custom_tool_result を観測したら remove する設計のため、
    // responder 側からは消さない。
    expect(useChatStore.getState().pendingCustomToolUseIds.has('tu_42')).toBe(true);
  });

  it('複数 pending を一度に POST する', async () => {
    useChatStore.getState().addPendingCustomToolUse('tu_a', 'art-a');
    useChatStore.getState().addPendingCustomToolUse('tu_b', 'art-b');
    renderHook(() => useCustomToolResponder({ sessionId: 'sess_1', enabled: true }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenCalledWith('sess_1', 'tu_a', { ok: true, artifactId: 'art-a' });
    expect(mockPost).toHaveBeenCalledWith('sess_1', 'tu_b', { ok: true, artifactId: 'art-b' });
  });

  it('POST 失敗時はログを残し再試行できる (pending に残る)', async () => {
    mockPost.mockRejectedValueOnce(new Error('network'));
    useChatStore.getState().addPendingCustomToolUse('tu_x', 'art-x');
    renderHook(() => useCustomToolResponder({ sessionId: 'sess_1', enabled: true }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    // pending には残っているので次回 effect 機会で再試行可能
    expect(useChatStore.getState().pendingCustomToolUseIds.has('tu_x')).toBe(true);
  });
});
