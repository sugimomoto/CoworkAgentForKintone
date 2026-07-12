import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetResolveDefaultAgentCache } from '../../core/bootstrap/resolveAgent';
import { resolveDefaultAgent } from '../../core/bootstrap/resolveAgent';
import { resolveBootstrapEnvironment } from '../../core/bootstrap/resolveEnvironment';
import { createUserSession } from '../../core/bootstrap/resolveSession';
import { useChatStore } from '../../store/chatStore';
import { makeAgent, makeEnv, makeSession } from '../../test/fixtures';

import { selectAgent, useSession } from './useSession';

vi.mock('../../core/bootstrap/resolveAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/bootstrap/resolveAgent')>();
  return { ...actual, resolveDefaultAgent: vi.fn() };
});
vi.mock('../../core/bootstrap/resolveEnvironment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/bootstrap/resolveEnvironment')>();
  return { ...actual, resolveBootstrapEnvironment: vi.fn() };
});
vi.mock('../../core/bootstrap/resolveSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/bootstrap/resolveSession')>();
  return { ...actual, createUserSession: vi.fn() };
});
// #15: ensureSession の memory store 解決を決定的に空 resolve (実 fetch を打たせない)。
vi.mock('../../core/bootstrap/resolveMemoryStore', () => ({
  resolveMemoryResources: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../core/kintone/user', () => ({
  getCurrentSessionContext: vi.fn(() => ({
    kintoneUserCode: 'sato',
    kintoneDomain: 'example.cybozu.com',
  })),
}));


const mockResolveAgent = vi.mocked(resolveDefaultAgent);
const mockResolveEnv = vi.mocked(resolveBootstrapEnvironment);
const mockCreateSession = vi.mocked(createUserSession);

const agentForTest = () => makeAgent({ id: 'agent_1' });
const envForTest = () => makeEnv();
const sessionForTest = (id = 'sess_new') => makeSession({ id });

beforeEach(() => {
  useChatStore.getState().reset();
  _resetResolveDefaultAgentCache();
  mockResolveAgent.mockReset();
  mockResolveEnv.mockReset();
  mockCreateSession.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useSession (起動時の bootstrap)', () => {
  it('マウント時に bootstrapping 状態になり、Agent と Environment を解決する', () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());

    renderHook(() => useSession());

    expect(useChatStore.getState().status).toBe('bootstrapping');
  });

  it('Agent/Env 解決後は status が ready になり、Session API は呼ばれない', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());

    renderHook(() => useSession());

    await waitFor(() => {
      expect(useChatStore.getState().status).toBe('ready');
    });
    expect(useChatStore.getState().sessionId).toBeNull();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('Agent 解決失敗時は status が error になる', async () => {
    mockResolveAgent.mockRejectedValue(new Error('network down'));

    renderHook(() => useSession());

    await waitFor(() => {
      expect(useChatStore.getState().status).toBe('error');
    });
    expect(useChatStore.getState().error).toContain('network down');
  });
});

describe('useSession.ensureSession', () => {
  it('既存 sessionId が無いとき、createUserSession で新規作成し store に保存する', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());
    mockCreateSession.mockResolvedValue(sessionForTest('sess_new'));

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    let id = '';
    await act(async () => {
      id = await result.current.ensureSession();
    });

    expect(id).toBe('sess_new');
    expect(useChatStore.getState().sessionId).toBe('sess_new');
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    // #141: systemOverride も渡るため objectContaining で必須項目のみ検証
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent_1',
        environmentId: 'env_1',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'sato',
      }),
    );
  });

  it('連続で 2 回呼んでも createUserSession は 1 回しか走らない (in-flight 保護)', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());
    mockCreateSession.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(sessionForTest('sess_x')), 10)),
    );

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    let a = '';
    let b = '';
    await act(async () => {
      const pa = result.current.ensureSession();
      const pb = result.current.ensureSession();
      [a, b] = await Promise.all([pa, pb]);
    });

    expect(a).toBe('sess_x');
    expect(b).toBe('sess_x');
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it('既存 sessionId があれば API を呼ばずそのまま返す', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    useChatStore.getState().setSessionId('sess_existing');

    let id = '';
    await act(async () => {
      id = await result.current.ensureSession();
    });

    expect(id).toBe('sess_existing');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe('useSession.ensureSession (Phase 1b-2 改訂: vault_ids 注入)', () => {
  it('bindingStatus=bound + vaultId + credentialId が揃っているとき、bootstrap env + vaultId が createUserSession に渡る', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());
    mockCreateSession.mockResolvedValue(sessionForTest('sess_user'));

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    useChatStore.getState().setVaultId('vault_x');
    useChatStore.getState().setCredentialId('cred_x');
    useChatStore.getState().setBindingStatus('bound');

    await act(async () => {
      await result.current.ensureSession();
    });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        // Phase 1b-2 改訂: ユーザー専用 Env は廃止、bootstrap Env のまま
        environmentId: 'env_1',
        vaultId: 'vault_x',
      }),
    );
  });

  it('bindingStatus=unbound のときは bootstrap env で作成 (vaultId 未指定)', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());
    mockCreateSession.mockResolvedValue(sessionForTest('sess_boot'));

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    // bindingStatus はデフォルト 'unknown'。'unbound' をシミュレート
    useChatStore.getState().setBindingStatus('unbound');

    await act(async () => {
      await result.current.ensureSession();
    });

    const lastCall = mockCreateSession.mock.calls.at(-1)!;
    expect(lastCall[0]).not.toHaveProperty('vaultId');
    expect(lastCall[0].environmentId).toBe('env_1'); // bootstrap env
  });
});

describe('useSession.selectSession / startNewConversation', () => {
  it('selectSession は messages をクリアして sessionId を切替える', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    useChatStore.getState().setSessionId('sess_a');
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });

    act(() => {
      result.current.selectSession('sess_b');
    });

    expect(useChatStore.getState().sessionId).toBe('sess_b');
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it('startNewConversation で sessionId が null、messages が空になる', async () => {
    mockResolveAgent.mockResolvedValue(agentForTest());
    mockResolveEnv.mockResolvedValue(envForTest());

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    useChatStore.getState().setSessionId('sess_a');
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });

    act(() => {
      result.current.startNewConversation();
    });

    expect(useChatStore.getState().sessionId).toBeNull();
    expect(useChatStore.getState().messages).toEqual([]);
  });
});

describe('selectAgent (#121: エージェント切替で添付を失わない)', () => {
  const ctx = { kintoneDomain: 'd.cybozu.com', kintoneUserCode: 'u' };

  it('別エージェントへ切替えても attachedFiles を保持する (messages は会話リセット)', () => {
    useChatStore.getState().setCurrentAgentId('agent_prev');
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });
    useChatStore.getState().addAttachedFile({
      localId: 'f1', filename: 'a.png', size: 1, mimeType: 'image/png', kind: 'image', status: 'ready',
    });

    act(() => {
      selectAgent('agent_next', ctx);
    });

    // 会話はリセットされるが、クイックアクション送信に乗せるため添付は残る
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().sessionId).toBeNull();
    expect(useChatStore.getState().attachedFiles).toHaveLength(1);
    expect(useChatStore.getState().attachedFiles[0]?.localId).toBe('f1');
  });
});
