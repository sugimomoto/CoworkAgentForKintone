// useUserBinding (Phase 1b-3 OAuth) のテスト。
//
// connect() の主要分岐を、OAuth core モジュール (popup / tokenExchange /
// credentialsUpsertClient) と resolveUserVault / managed-agents/resources を
// モックして検証する。

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/oauth/popup', () => ({
  openOAuthPopup: vi.fn(),
}));
vi.mock('../../core/oauth/tokenExchange', () => ({
  exchangeCodeForTokens: vi.fn(),
}));
vi.mock('../../core/oauth/credentialsUpsertClient', () => {
  class CredentialUpsertError extends Error {
    status: number;
    responseBody: string;
    constructor(status: number, responseBody: string) {
      super(`upsert failed (${status})`);
      this.name = 'CredentialUpsertError';
      this.status = status;
      this.responseBody = responseBody;
    }
  }
  return {
    upsertKintoneCredential: vi.fn(),
    CredentialUpsertError,
  };
});
vi.mock('../../core/oauth/pkce', () => ({
  generatePkce: vi.fn(async () => ({
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    state: 'state-xyz',
  })),
  savePkce: vi.fn(),
  clearPkce: vi.fn(),
}));
vi.mock('../../core/bootstrap/resolveVault', () => ({
  resolveUserVault: vi.fn(),
}));
vi.mock('../../core/managed-agents/resources', () => ({
  listVaults: vi.fn(),
  listVaultCredentials: vi.fn(),
  filterByMetadata: <T extends { metadata?: Record<string, string> }>(
    items: T[],
    filter: Record<string, string>,
  ): T[] =>
    items.filter((it) =>
      Object.entries(filter).every(([k, v]) => it.metadata?.[k] === v),
    ),
  pickOldest: <T extends { created_at: string }>(items: T[]): T => items[0]!,
}));
vi.mock('../../core/kintone/pluginConfig', () => ({
  getPluginConfig: vi.fn(),
}));
vi.mock('../../core/kintone/user', () => ({
  getCurrentSessionContext: () => ({
    kintoneDomain: 'tenant.cybozu.com',
    kintoneUserCode: 'sato',
  }),
}));

import { resolveUserVault } from '../../core/bootstrap/resolveVault';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { listVaultCredentials, listVaults } from '../../core/managed-agents/resources';
import {
  CredentialUpsertError,
  upsertKintoneCredential,
} from '../../core/oauth/credentialsUpsertClient';
import { openOAuthPopup } from '../../core/oauth/popup';
import { exchangeCodeForTokens } from '../../core/oauth/tokenExchange';
import { useChatStore } from '../../store/chatStore';

import { useUserBinding } from './useUserBinding';

const mockListVaults = vi.mocked(listVaults);
const mockListCreds = vi.mocked(listVaultCredentials);
const mockGetCfg = vi.mocked(getPluginConfig);
const mockOpenPopup = vi.mocked(openOAuthPopup);
const mockExchange = vi.mocked(exchangeCodeForTokens);
const mockUpsert = vi.mocked(upsertKintoneCredential);
const mockResolveVault = vi.mocked(resolveUserVault);

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({
    pluginId: 'plg_x',
    bindingStatus: 'unknown',
    bindingError: null,
    status: 'ready',
    vaultId: null,
    credentialId: null,
  });
  mockGetCfg.mockReturnValue({
    workerUrl: 'https://worker.example.com',
    oauthClientId: 'client-id',
  });
  mockListVaults.mockResolvedValue({ data: [], next_page: null });
  mockResolveVault.mockResolvedValue({
    id: 'vlt_user',
    metadata: {},
    type: 'vault',
    created_at: '',
    updated_at: '',
    archived_at: null,
    display_name: 'x',
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUserBinding bootstrap (起動時の bound 判定)', () => {
  it('既存 Vault + 有効 Credential → bound', async () => {
    mockListVaults.mockResolvedValue({
      data: [
        {
          id: 'vlt_existing',
          metadata: {
            source: 'cowork-agent-for-kintone',
            kintoneDomain: 'tenant.cybozu.com',
            kintoneUserCode: 'sato',
          },
          created_at: '2026-04-25T00:00:00Z',
        } as never,
      ],
      next_page: null,
    });
    mockListCreds.mockResolvedValue({
      data: [{ id: 'vcrd_a', archived_at: null } as never],
      next_page: null,
    });

    renderHook(() => useUserBinding());
    await new Promise((r) => setTimeout(r, 10));
    expect(useChatStore.getState().bindingStatus).toBe('bound');
    expect(useChatStore.getState().vaultId).toBe('vlt_existing');
    expect(useChatStore.getState().credentialId).toBe('vcrd_a');
  });

  it('Vault 無し → unbound', async () => {
    mockListVaults.mockResolvedValue({ data: [], next_page: null });
    renderHook(() => useUserBinding());
    await new Promise((r) => setTimeout(r, 10));
    expect(useChatStore.getState().bindingStatus).toBe('unbound');
  });
});

describe('useUserBinding connect (OAuth flow)', () => {
  // bootstrap useEffect は status='ready' で発火する。connect 系テストでは
  // bootstrap と connect の競合を避けるため、status='bootstrapping' に設定して
  // bootstrap useEffect を抑止する。
  beforeEach(() => {
    useChatStore.setState({ status: 'bootstrapping' });
  });

  it('成功フロー: popup → token 交換 → upsert → bound', async () => {
    mockOpenPopup.mockResolvedValue({
      source: 'cowork-agent-kintone-mcp',
      code: 'auth-code',
      state: 'state-xyz',
      error: null,
      error_description: null,
    });
    mockExchange.mockResolvedValue({
      access_token: 'AT',
      refresh_token: 'RT',
      token_type: 'bearer',
      expires_in: 3600,
    });
    mockUpsert.mockResolvedValue({ credential_id: 'vcrd_new', vault_id: 'vlt_user' });

    const { result } = renderHook(() => useUserBinding());
    await act(async () => {
      await result.current.connect();
    });

    expect(useChatStore.getState().bindingStatus).toBe('bound');
    expect(useChatStore.getState().vaultId).toBe('vlt_user');
    expect(useChatStore.getState().credentialId).toBe('vcrd_new');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('Worker URL 未設定 → status=error で例外', async () => {
    mockGetCfg.mockReturnValue({ workerUrl: null, oauthClientId: null });
    const { result } = renderHook(() => useUserBinding());
    await expect(
      act(async () => {
        await result.current.connect();
      }),
    ).rejects.toThrow();
    expect(useChatStore.getState().bindingStatus).toBe('error');
  });

  it('popup キャンセル → status=error', async () => {
    mockOpenPopup.mockRejectedValue(new Error('popup cancelled'));
    const { result } = renderHook(() => useUserBinding());
    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow();
    });
    expect(useChatStore.getState().bindingStatus).toBe('error');
  });

  it('upsert 404 fallback: credentialId クリアして create で再試行', async () => {
    useChatStore.setState({ credentialId: 'vcrd_old' });
    mockOpenPopup.mockResolvedValue({
      source: 'cowork-agent-kintone-mcp',
      code: 'c',
      state: 'state-xyz',
      error: null,
      error_description: null,
    });
    mockExchange.mockResolvedValue({
      access_token: 'AT',
      refresh_token: 'RT',
      token_type: 'bearer',
      expires_in: 3600,
    });
    mockUpsert
      .mockRejectedValueOnce(new CredentialUpsertError(404, 'archived'))
      .mockResolvedValueOnce({ credential_id: 'vcrd_new', vault_id: 'vlt_user' });

    const { result } = renderHook(() => useUserBinding());
    await act(async () => {
      await result.current.connect();
    });

    expect(useChatStore.getState().bindingStatus).toBe('bound');
    expect(useChatStore.getState().credentialId).toBe('vcrd_new');
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert.mock.calls[0]![0]).toMatchObject({ credentialId: 'vcrd_old' });
    expect(mockUpsert.mock.calls[1]![0]).not.toHaveProperty('credentialId');
  });
});
