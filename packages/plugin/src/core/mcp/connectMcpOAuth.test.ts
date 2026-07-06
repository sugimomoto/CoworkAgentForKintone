import { afterEach, describe, expect, it, vi } from 'vitest';

import { upsertKintoneCredential } from '../oauth/credentialsUpsertClient';
import { generatePkce, clearPkce } from '../oauth/pkce';
import { openOAuthPopup } from '../oauth/popup';
import { exchangeCodeForTokens } from '../oauth/tokenExchange';

import { connectMcpOAuth } from './connectMcpOAuth';

import type { McpServerDef } from './registry';

vi.mock('../oauth/pkce', () => ({
  generatePkce: vi.fn(),
  savePkce: vi.fn(),
  clearPkce: vi.fn(),
}));
vi.mock('../oauth/popup', () => ({ openOAuthPopup: vi.fn() }));
vi.mock('../oauth/tokenExchange', () => ({ exchangeCodeForTokens: vi.fn() }));
vi.mock('../oauth/credentialsUpsertClient', () => ({ upsertKintoneCredential: vi.fn() }));

const mockPkce = vi.mocked(generatePkce);
const mockPopup = vi.mocked(openOAuthPopup);
const mockExchange = vi.mocked(exchangeCodeForTokens);
const mockUpsert = vi.mocked(upsertKintoneCredential);

const BASE = {
  pluginId: 'plugin_1',
  workerUrl: 'https://w.example.com',
  vaultId: 'vlt_1',
};

function oauthServer(over: Partial<McpServerDef> = {}): McpServerDef {
  return {
    id: 'srv1',
    name: 'OAuthSrv',
    url: 'https://w.example.com/mcp/x',
    authType: 'oauth',
    authorizationEndpoint: 'https://idp.example.com/authorize',
    tokenEndpoint: 'https://idp.example.com/token',
    clientId: 'cid',
    scope: 'read write',
    tokenEndpointAuthType: 'basic',
    ...over,
  };
}

function arm(): void {
  mockPkce.mockResolvedValue({ state: 'st', codeVerifier: 'ver', codeChallenge: 'chal' });
  mockPopup.mockResolvedValue({ code: 'authcode', state: 'st' } as Awaited<ReturnType<typeof openOAuthPopup>>);
  mockExchange.mockResolvedValue({ access_token: 'at', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt' });
  mockUpsert.mockResolvedValue({ credential_id: 'cred_1', vault_id: 'vlt_1' });
}

afterEach(() => vi.clearAllMocks());

describe('connectMcpOAuth', () => {
  it('authorization URL を正しく組み立てて popup を開く', async () => {
    arm();
    await connectMcpOAuth({ ...BASE, server: oauthServer() });
    const url = new URL(mockPopup.mock.calls[0]![0].authorizationUrl);
    expect(url.origin + url.pathname).toBe('https://idp.example.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe('https://w.example.com/oauth/callback');
    expect(url.searchParams.get('scope')).toBe('read write');
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('confidential(basic): per-server URL に upsert（serverId 付き・clientId は body に載せない）', async () => {
    arm();
    await connectMcpOAuth({ ...BASE, server: oauthServer({ tokenEndpointAuthType: 'basic' }) });
    expect(mockExchange).toHaveBeenCalledWith(expect.not.objectContaining({ clientId: expect.anything() }));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ serverId: 'srv1', mcpServerUrl: 'https://w.example.com/mcp/x', refreshToken: 'rt' }),
    );
  });

  it('public(none): worker root に upsert（serverId なし）+ token 交換に client_id を載せる', async () => {
    arm();
    await connectMcpOAuth({ ...BASE, server: oauthServer({ tokenEndpointAuthType: 'none' }) });
    expect(mockExchange).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'cid' }));
    expect(mockUpsert).toHaveBeenCalledWith(expect.not.objectContaining({ serverId: expect.anything() }));
  });

  it('oauth でない server は例外', async () => {
    await expect(
      connectMcpOAuth({ ...BASE, server: { id: 's', name: 'x', url: 'https://e', authType: 'bearer' } }),
    ).rejects.toThrow();
  });

  it('失敗時も clearPkce する', async () => {
    mockPkce.mockResolvedValue({ state: 'st', codeVerifier: 'ver', codeChallenge: 'chal' });
    mockPopup.mockRejectedValue(new Error('popup closed'));
    await expect(connectMcpOAuth({ ...BASE, server: oauthServer() })).rejects.toThrow('popup closed');
    expect(vi.mocked(clearPkce)).toHaveBeenCalled();
  });
});
