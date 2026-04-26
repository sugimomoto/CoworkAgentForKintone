import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exchangeCodeForTokens } from './tokenExchange';

const PLUGIN_ID = 'plg_test';
const TOKEN_URL = 'https://tenant.cybozu.com/oauth2/token';
const REDIRECT_URI = 'https://worker.example.com/oauth/callback';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  // @ts-expect-error global kintone shim for tests
  globalThis.kintone = { plugin: { app: { proxy: proxyMock } } };
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.kintone;
});

describe('exchangeCodeForTokens', () => {
  it('成功: tokens を返す', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({
        access_token: 'AT',
        refresh_token: 'RT',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'k:app_record:read',
      }),
      200,
    ]);

    const tokens = await exchangeCodeForTokens({
      pluginId: PLUGIN_ID,
      tokenUrl: TOKEN_URL,
      redirectUri: REDIRECT_URI,
      code: 'auth-code',
      codeVerifier: 'verifier',
    });

    expect(tokens.access_token).toBe('AT');
    expect(tokens.refresh_token).toBe('RT');
    expect(tokens.expires_in).toBe(3600);
  });

  it('proxy 呼出: URL / method / body 形式が正しい', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({ access_token: 'AT', token_type: 'bearer', expires_in: 3600, scope: '' }),
      200,
    ]);

    await exchangeCodeForTokens({
      pluginId: PLUGIN_ID,
      tokenUrl: TOKEN_URL,
      redirectUri: REDIRECT_URI,
      code: 'auth-code',
      codeVerifier: 'verifier',
    });

    expect(proxyMock).toHaveBeenCalledWith(
      PLUGIN_ID,
      TOKEN_URL,
      'POST',
      {},
      expect.any(String),
    );
    const body = proxyMock.mock.calls[0]![4] as string;
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('auth-code');
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(params.get('code_verifier')).toBe('verifier');
  });

  it('4xx は例外', async () => {
    proxyMock.mockResolvedValue([
      JSON.stringify({ error: 'invalid_grant' }),
      400,
    ]);

    await expect(
      exchangeCodeForTokens({
        pluginId: PLUGIN_ID,
        tokenUrl: TOKEN_URL,
        redirectUri: REDIRECT_URI,
        code: 'bad',
        codeVerifier: 'v',
      }),
    ).rejects.toThrow(/400|invalid_grant/);
  });

  it('access_token 欠損は例外', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ token_type: 'bearer' }), 200]);

    await expect(
      exchangeCodeForTokens({
        pluginId: PLUGIN_ID,
        tokenUrl: TOKEN_URL,
        redirectUri: REDIRECT_URI,
        code: 'auth',
        codeVerifier: 'v',
      }),
    ).rejects.toThrow(/access_token/);
  });
});
