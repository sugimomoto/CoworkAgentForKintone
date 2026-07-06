import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveUserVault } from '../../core/bootstrap/resolveVault';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { archiveVaultCredential, listVaultCredentials } from '../../core/managed-agents/resources';
import { fetchMcpTools } from '../../core/mcp/toolsList';
import { upsertStaticBearerCredential } from '../../core/oauth/credentialsUpsertClient';

import { useMcpConnections } from './useMcpConnections';

import type { McpServerDef } from '../../core/mcp/registry';

vi.mock('../../core/kintone/pluginConfig', () => ({ getPluginConfig: vi.fn() }));
vi.mock('../../core/kintone/user', () => ({ getCurrentSessionContext: vi.fn() }));
vi.mock('../../core/bootstrap/resolveVault', () => ({ resolveUserVault: vi.fn() }));
vi.mock('../../core/managed-agents/resources', () => ({
  listVaultCredentials: vi.fn(),
  archiveVaultCredential: vi.fn(),
}));
vi.mock('../../core/mcp/toolsList', () => ({ fetchMcpTools: vi.fn() }));
vi.mock('../../core/oauth/credentialsUpsertClient', () => ({ upsertStaticBearerCredential: vi.fn() }));

const mockCfg = vi.mocked(getPluginConfig);
const mockCtx = vi.mocked(getCurrentSessionContext);
const mockVault = vi.mocked(resolveUserVault);
const mockList = vi.mocked(listVaultCredentials);
const mockArchive = vi.mocked(archiveVaultCredential);
const mockFetchTools = vi.mocked(fetchMcpTools);
const mockUpsert = vi.mocked(upsertStaticBearerCredential);

const SERVERS: McpServerDef[] = [
  { id: 'gh', name: 'GitHub', url: 'https://gh.example/mcp', authType: 'bearer' },
  { id: 'pub', name: 'Public', url: 'https://pub.example/mcp', authType: 'none' },
  { id: 'oa', name: 'OAuthSrv', url: 'https://oa.example/mcp', authType: 'oauth' },
];

function setup(creds: Array<{ id: string; url: string; archived?: boolean }> = []) {
  mockCfg.mockReturnValue({ workerUrl: 'https://w.example.com', oauthClientId: null, mcpServers: SERVERS });
  mockCtx.mockReturnValue({ kintoneDomain: 'd.cybozu.com', kintoneUserCode: 'u' } as ReturnType<typeof getCurrentSessionContext>);
  mockVault.mockResolvedValue({ id: 'vlt_1' } as Awaited<ReturnType<typeof resolveUserVault>>);
  mockList.mockResolvedValue({
    data: creds.map((c) => ({
      id: c.id,
      auth: { type: 'static_bearer', mcp_server_url: c.url },
      archived_at: c.archived ? '2026-01-01' : null,
    })),
    next_page: null,
  } as Awaited<ReturnType<typeof listVaultCredentials>>);
}

afterEach(() => vi.clearAllMocks());

describe('useMcpConnections', () => {
  it('カタログ×credential を突合（bearer connected/unconnected, none は常に connected）', async () => {
    setup([{ id: 'cred_gh', url: 'https://gh.example/mcp' }]);
    const { result } = renderHook(() => useMcpConnections('plugin_1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.connections['gh']?.status).toBe('connected');
    expect(result.current.connections['gh']?.credentialId).toBe('cred_gh');
    expect(result.current.connections['pub']?.status).toBe('connected'); // none = 常に
    expect(result.current.connections['oa']?.status).toBe('unconnected');
  });

  it('archived credential は connected 扱いしない', async () => {
    setup([{ id: 'cred_gh', url: 'https://gh.example/mcp', archived: true }]);
    const { result } = renderHook(() => useMcpConnections('plugin_1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.connections['gh']?.status).toBe('unconnected');
  });

  it('connectBearer: tools/list 検証 → static_bearer upsert', async () => {
    setup([]);
    mockFetchTools.mockResolvedValue([{ name: 'get_issue' }]);
    mockUpsert.mockResolvedValue({ credential_id: 'cred_new', vault_id: 'vlt_1' });
    mockList.mockResolvedValueOnce({ data: [], next_page: null } as Awaited<ReturnType<typeof listVaultCredentials>>);

    const { result } = renderHook(() => useMcpConnections('plugin_1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let tools: { name: string }[] = [];
    await act(async () => {
      tools = await result.current.connectBearer(SERVERS[0]!, 'pat_x');
    });
    expect(tools).toEqual([{ name: 'get_issue' }]);
    expect(mockFetchTools).toHaveBeenCalledWith({ url: 'https://gh.example/mcp', bearerToken: 'pat_x' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ vaultId: 'vlt_1', mcpServerUrl: 'https://gh.example/mcp', token: 'pat_x' }),
    );
  });

  it('disconnect: connected な bearer の credential を archive', async () => {
    setup([{ id: 'cred_gh', url: 'https://gh.example/mcp' }]);
    mockArchive.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMcpConnections('plugin_1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.disconnect(SERVERS[0]!);
    });
    expect(mockArchive).toHaveBeenCalledWith('vlt_1', 'cred_gh');
  });
});
