// Phase 1b-2 (改訂) M0 暫定: スタブ動作のみ確認。
// P4 で完全実装に伴って書き直す。

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { useUserBinding } from './useUserBinding';

beforeEach(() => {
  useChatStore.getState().reset();
  useChatStore.getState().setStatus('ready');
  useChatStore.getState().setAgentId('agent_default');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUserBinding (M0 stub)', () => {
  it('bootstrap が ready になったら status="unbound" に遷移する', async () => {
    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));
  });

  it('bind() は P4 で実装されるため現状は throw する', async () => {
    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await expect(result.current.bind({ login: 'sato', password: 'p' })).rejects.toThrow(
      /P4 \(Phase 1b-2 改訂\) で実装予定/,
    );
  });
});
