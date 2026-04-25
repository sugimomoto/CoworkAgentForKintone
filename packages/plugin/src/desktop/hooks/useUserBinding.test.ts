import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';
import { jsonResponse, makeEnv, makeVault } from '../../test/fixtures';

import { useUserBinding } from './useUserBinding';

vi.mock('../../core/kintone/user', () => ({
  getCurrentSessionContext: vi.fn(() => ({
    kintoneUserCode: 'sato',
    kintoneDomain: 'example.cybozu.com',
  })),
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  useChatStore.getState().reset();
  // bootstrap が完了している前提
  useChatStore.getState().setStatus('ready');
  useChatStore.getState().setAgentId('agent_default');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const mineMeta = {
  source: 'cowork-agent-for-kintone',
  kintoneDomain: 'example.cybozu.com',
  kintoneUserCode: 'sato',
};

describe('useUserBinding (auto-detect on mount)', () => {
  it('Vault も Environment も無ければ status="unbound"', async () => {
    // Response の body は 1 回しか読めないため毎回新しいインスタンスを返す
    fetchMock.mockImplementation(async () =>
      jsonResponse({ data: [], next_page: null }),
    );

    const { result } = renderHook(() => useUserBinding());

    await waitFor(() => expect(result.current.status).toBe('unbound'));
  });

  it('両方ある場合は status="bound" + store に各 ID 反映', async () => {
    fetchMock
      // listVaults
      .mockResolvedValueOnce(
        jsonResponse({ data: [makeVault({ id: 'vault_x', metadata: mineMeta })], next_page: null }),
      )
      // listEnvironments
      .mockResolvedValueOnce(
        jsonResponse({ data: [makeEnv({ id: 'env_x', metadata: mineMeta })], next_page: null }),
      );

    const { result } = renderHook(() => useUserBinding());

    await waitFor(() => expect(result.current.status).toBe('bound'));
    expect(useChatStore.getState().vaultId).toBe('vault_x');
    expect(useChatStore.getState().userEnvironmentId).toBe('env_x');
  });

  it('片方だけ存在する場合も status="unbound" (bind() で再構築)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ data: [makeVault({ id: 'vault_x', metadata: mineMeta })], next_page: null }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));

    const { result } = renderHook(() => useUserBinding());

    await waitFor(() => expect(result.current.status).toBe('unbound'));
  });

  it('検索失敗時は status="error" + bindingError', async () => {
    fetchMock.mockRejectedValue(new Error('listVaults failed'));

    const { result } = renderHook(() => useUserBinding());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(useChatStore.getState().bindingError).toContain('listVaults failed');
  });

  it('bootstrapStatus !== "ready" のときは検索しない', async () => {
    useChatStore.getState().setStatus('bootstrapping');
    renderHook(() => useUserBinding());

    // 100ms 待っても fetch が呼ばれない
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useUserBinding.bind', () => {
  it('Vault 解決 → setVaultKeys → Env 解決 を順に呼んで status="bound"', async () => {
    // mount 時の listVaults / listEnvironments は空
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null })) // listVaults (mount)
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null })) // listEnvironments (mount)
      // bind: resolveUserVault が listVaults
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      // createVault
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201))
      // setVaultKeys
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 200))
      // ensureUserEnvironment が listEnvironments
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      // createEnvironment
      .mockResolvedValueOnce(jsonResponse(makeEnv({ id: 'env_new' }), 201));

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await result.current.bind({
        domain: 'example.cybozu.com',
        login: 'sato',
        password: 'p4ss',
      });
    });

    expect(result.current.status).toBe('bound');
    expect(useChatStore.getState().vaultId).toBe('vault_new');
    expect(useChatStore.getState().userEnvironmentId).toBe('env_new');
  });

  it('bind 失敗時は status="error" + reject 伝播', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      // bind の最初の呼出で失敗
      .mockRejectedValueOnce(new Error('vault create failed'));

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await expect(
        result.current.bind({ domain: 'x.cybozu.com', login: 'a', password: 'p' }),
      ).rejects.toThrow();
    });

    expect(result.current.status).toBe('error');
    expect(useChatStore.getState().bindingError).toContain('vault create failed');
  });
});
