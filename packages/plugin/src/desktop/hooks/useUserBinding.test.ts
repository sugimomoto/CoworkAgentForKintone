import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';
import { jsonResponse, makeVault } from '../../test/fixtures';

import { useUserBinding } from './useUserBinding';

vi.mock('../../core/kintone/user', () => ({
  getCurrentSessionContext: vi.fn(() => ({
    kintoneUserCode: 'sato',
    kintoneDomain: 'example.cybozu.com',
  })),
}));

vi.mock('../../core/kintone/pluginConfig', () => ({
  getPluginConfig: vi.fn(() => ({ workerUrl: 'https://worker.example.com' })),
}));

vi.mock('../../core/mcp/mintClient', () => ({
  mintKintoneJwt: vi.fn(),
}));

import { mintKintoneJwt } from '../../core/mcp/mintClient';
import { _resetResolveUserVaultCache } from '../../core/bootstrap/resolveVault';

const mockMint = vi.mocked(mintKintoneJwt);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  useChatStore.getState().reset();
  useChatStore.getState().setStatus('ready');
  useChatStore.getState().setAgentId('agent_default');
  useChatStore.getState().setPluginId('plugin_abc');
  _resetResolveUserVaultCache();
  mockMint.mockReset();
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

function freshJsonResponse(body: unknown, status = 200): () => Response {
  return () => jsonResponse(body, status);
}

describe('useUserBinding (auto-detect on mount)', () => {
  it('Vault と Credential が両方ある場合は status="bound"', async () => {
    fetchMock
      // listVaults
      .mockImplementationOnce(
        freshJsonResponse({
          data: [makeVault({ id: 'vault_x', metadata: mineMeta })],
          next_page: null,
        }),
      )
      // listVaultCredentials
      .mockImplementationOnce(
        freshJsonResponse({
          data: [
            {
              id: 'cred_x',
              vault_id: 'vault_x',
              type: 'credential',
              display_name: 'kintone',
              auth: { type: 'static_bearer', mcp_server_url: 'https://w/mcp' },
              created_at: '2026-04-26T00:00:00Z',
              updated_at: '2026-04-26T00:00:00Z',
              archived_at: null,
            },
          ],
          next_page: null,
        }),
      );

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('bound'));

    expect(useChatStore.getState().vaultId).toBe('vault_x');
    expect(useChatStore.getState().credentialId).toBe('cred_x');
  });

  it('Vault が無ければ status="unbound"', async () => {
    fetchMock.mockImplementation(freshJsonResponse({ data: [], next_page: null }));

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));
  });

  it('Vault があっても Credential が無ければ status="unbound"', async () => {
    fetchMock
      .mockImplementationOnce(
        freshJsonResponse({
          data: [makeVault({ id: 'vault_x', metadata: mineMeta })],
          next_page: null,
        }),
      )
      .mockImplementationOnce(freshJsonResponse({ data: [], next_page: null }));

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));
  });

  it('検索失敗時は status="error"', async () => {
    fetchMock.mockRejectedValue(new Error('listVaults failed'));

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(useChatStore.getState().bindingError).toContain('listVaults failed');
  });
});

describe('useUserBinding.bind (実装版)', () => {
  it('mint → resolveUserVault → createVaultCredential のフロー (Vault 新規)', async () => {
    mockMint.mockResolvedValue('jwt-xxx');

    fetchMock
      // mount: listVaults (空)
      .mockImplementationOnce(freshJsonResponse({ data: [], next_page: null }))
      // bind: resolveUserVault → listVaults
      .mockImplementationOnce(freshJsonResponse({ data: [], next_page: null }))
      // bind: resolveUserVault → createVault
      .mockImplementationOnce(
        freshJsonResponse(makeVault({ id: 'vault_new', metadata: mineMeta }), 201),
      )
      // bind: listVaultCredentials (空 → create する)
      .mockImplementationOnce(freshJsonResponse({ data: [], next_page: null }))
      // bind: createVaultCredential
      .mockImplementationOnce(
        freshJsonResponse(
          {
            id: 'cred_new',
            vault_id: 'vault_new',
            type: 'credential',
            display_name: 'x',
            auth: {
              type: 'static_bearer',
              mcp_server_url: 'https://worker.example.com/mcp',
            },
            created_at: '2026-04-26T00:00:00Z',
            updated_at: '2026-04-26T00:00:00Z',
            archived_at: null,
          },
          201,
        ),
      );

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await result.current.bind({ login: 'sato', password: 'p4ss' });
    });

    expect(result.current.status).toBe('bound');
    expect(mockMint).toHaveBeenCalledWith('plugin_abc', {
      workerUrl: 'https://worker.example.com',
      kintone_domain: 'example.cybozu.com',
      kintone_login: 'sato',
      kintone_password: 'p4ss',
    });
    expect(useChatStore.getState().vaultId).toBe('vault_new');
    expect(useChatStore.getState().credentialId).toBe('cred_new');
  });

  it('既存 Credential があれば updateVaultCredential を呼ぶ', async () => {
    mockMint.mockResolvedValue('jwt-new');

    fetchMock
      // mount: listVaults (空 想定だが、別ケース確認のため bind 時の処理を直接テスト)
      .mockImplementationOnce(freshJsonResponse({ data: [], next_page: null }))
      // bind: resolveUserVault → listVaults (空)
      .mockImplementationOnce(freshJsonResponse({ data: [], next_page: null }))
      // bind: resolveUserVault → createVault
      .mockImplementationOnce(
        freshJsonResponse(makeVault({ id: 'vault_a', metadata: mineMeta }), 201),
      )
      // bind: listVaultCredentials (既存 1 件、URL 一致)
      .mockImplementationOnce(
        freshJsonResponse({
          data: [
            {
              id: 'cred_existing',
              vault_id: 'vault_a',
              type: 'credential',
              display_name: 'old',
              auth: {
                type: 'static_bearer',
                mcp_server_url: 'https://worker.example.com/mcp',
              },
              created_at: '2026-04-26T00:00:00Z',
              updated_at: '2026-04-26T00:00:00Z',
              archived_at: null,
            },
          ],
          next_page: null,
        }),
      )
      // bind: updateVaultCredential
      .mockImplementationOnce(
        freshJsonResponse({
          id: 'cred_existing',
          vault_id: 'vault_a',
          type: 'credential',
        }),
      );

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await result.current.bind({ login: 'sato', password: 'p' });
    });

    expect(result.current.status).toBe('bound');
    expect(useChatStore.getState().credentialId).toBe('cred_existing');

    // 5 番目の fetch が PATCH/POST update であることを確認
    const updateCall = fetchMock.mock.calls[4]!;
    const url = updateCall[0] as string;
    expect(url).toContain('/v1/vaults/vault_a/credentials/cred_existing');
  });

  it('Worker URL 未設定時は status="error" + reject', async () => {
    fetchMock.mockImplementation(freshJsonResponse({ data: [], next_page: null }));

    // pluginConfig を override
    const { getPluginConfig } = await import('../../core/kintone/pluginConfig');
    vi.mocked(getPluginConfig).mockReturnValueOnce({ workerUrl: null });

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await expect(result.current.bind({ login: 'a', password: 'p' })).rejects.toThrow(
        /Worker URL/,
      );
    });

    expect(result.current.status).toBe('error');
  });

  it('Plugin ID 未解決時は reject', async () => {
    fetchMock.mockImplementation(freshJsonResponse({ data: [], next_page: null }));

    useChatStore.getState().setPluginId(null);

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await expect(result.current.bind({ login: 'a', password: 'p' })).rejects.toThrow();
    });

    expect(result.current.status).toBe('error');
  });

  it('mint 失敗時は status="error" + reject', async () => {
    mockMint.mockRejectedValueOnce(new Error('mint 401'));

    fetchMock.mockImplementation(freshJsonResponse({ data: [], next_page: null }));

    const { result } = renderHook(() => useUserBinding());
    await waitFor(() => expect(result.current.status).toBe('unbound'));

    await act(async () => {
      await expect(result.current.bind({ login: 'a', password: 'p' })).rejects.toThrow(
        /mint 401/,
      );
    });

    expect(result.current.status).toBe('error');
  });
});
