import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { useAgentPhase } from './useAgentPhase';

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('useAgentPhase', () => {
  it('初期状態は idle', () => {
    const { result } = renderHook(() => useAgentPhase());
    expect(result.current).toBe('idle');
  });

  it('isAgentRunning=true なら running', () => {
    useChatStore.getState().setAgentRunning(true);
    const { result } = renderHook(() => useAgentPhase());
    expect(result.current).toBe('running');
  });

  it('pending custom_tool があれば running', () => {
    useChatStore.getState().addPendingCustomToolUse('tu_1', 'a1');
    const { result } = renderHook(() => useAgentPhase());
    expect(result.current).toBe('running');
  });

  it('オプティミスティック thinking (pending- prefix) があれば running', () => {
    useChatStore.getState().addMessage({ id: 'pending-thinking-1', kind: 'thinking' });
    const { result } = renderHook(() => useAgentPhase());
    expect(result.current).toBe('running');
  });

  it('agent.thinking 由来の通常 thinking (sevt_xxx) は idle 扱いを邪魔しない', () => {
    useChatStore.getState().addMessage({ id: 'sevt_xxx', kind: 'thinking' });
    useChatStore.getState().addMessage({ id: 'sevt_msg', kind: 'agent', text: 'done' });
    const { result } = renderHook(() => useAgentPhase());
    expect(result.current).toBe('idle');
  });

  it('pending-confirmation の tool があれば最優先で awaiting-confirm', () => {
    useChatStore.getState().setAgentRunning(true);
    useChatStore.getState().addMessage({
      id: 'tu_x',
      kind: 'tool',
      name: 'kintone-delete-records',
      input: {},
      status: 'pending-confirmation',
    });
    const { result } = renderHook(() => useAgentPhase());
    expect(result.current).toBe('awaiting-confirm');
  });
});
