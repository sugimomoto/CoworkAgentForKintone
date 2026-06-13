// Worker /credentials/upsert ハンドラのテスト。
//
// 検証内容:
// - X-Anthropic-Api-Key 必須 (無し → 401)
// - body 必須フィールド検証 (vaultId 欠損 → 400)
// - refreshToken 有り + client_id/secret ヘッダ無し → 400 (Create 時のみ厳しく)
// - credentialId 有 → Update path (Anthropic への URL / body 形式)
// - credentialId 無 → Create path (Anthropic への URL / body のネスト構造)
// - Anthropic 200 → { credential_id, vault_id } を返す
// - Anthropic 4xx → status / body そのまま転載

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleCredentialsUpsert } from '../src/credentials-upsert';


let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeRequest(opts: {
  body?: unknown;
  anthropicApiKey?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.anthropicApiKey !== null && opts.anthropicApiKey !== undefined) {
    headers['X-Anthropic-Api-Key'] = opts.anthropicApiKey;
  }
  if (opts.clientId !== null && opts.clientId !== undefined) {
    headers['X-Kintone-OAuth-Client-Id'] = opts.clientId;
  }
  if (opts.clientSecret !== null && opts.clientSecret !== undefined) {
    headers['X-Kintone-OAuth-Client-Secret'] = opts.clientSecret;
  }
  const init: RequestInit = { method: 'POST', headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  return new Request('https://example.com/credentials/upsert', init);
}

const VALID_BODY = {
  vaultId: 'vlt_abc',
  mcpServerUrl: 'https://example.com/mcp/tenant.cybozu.com',
  accessToken: 'kintone-access-token',
  expiresIn: 3600,
  refreshToken: 'kintone-refresh-token',
  tokenEndpoint: 'https://tenant.cybozu.com/oauth2/token',
  scope: 'k:app_record:read',
};

const VALID_HEADERS = {
  anthropicApiKey: 'sk-ant-test',
  clientId: 'kintone-client-id',
  clientSecret: 'kintone-client-secret',
};

describe('handleCredentialsUpsert', () => {
  describe('認証ヘッダ', () => {
    it('X-Anthropic-Api-Key 無しなら 401', async () => {
      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS, anthropicApiKey: null });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('X-Anthropic-Api-Key が空文字なら 401', async () => {
      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS, anthropicApiKey: '' });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(401);
    });
  });

  describe('body 検証', () => {
    it('body が無いと 400', async () => {
      const req = makeRequest({ ...VALID_HEADERS });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
    });

    it('vaultId が無いと 400', async () => {
      const { vaultId: _v, ...rest } = VALID_BODY;
      const req = makeRequest({ body: rest, ...VALID_HEADERS });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
    });

    it('accessToken が無いと 400', async () => {
      const { accessToken: _a, ...rest } = VALID_BODY;
      const req = makeRequest({ body: rest, ...VALID_HEADERS });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
    });

    it('Create 時に refreshToken 有りなのに client_id ヘッダ無しなら 400', async () => {
      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS, clientId: null });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
    });

    it('Create 時に refreshToken 有りなのに client_secret ヘッダ無しなら 400', async () => {
      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS, clientSecret: null });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
    });

    it('vaultId に不正な文字 (パストラバーサル) が含まれると 400', async () => {
      const req = makeRequest({
        body: { ...VALID_BODY, vaultId: 'vlt_abc/../../v1/foo' },
        ...VALID_HEADERS,
      });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('credentialId に / が含まれると 400 (URL パス改変を防ぐ)', async () => {
      const req = makeRequest({
        body: { ...VALID_BODY, credentialId: 'vcrd/../bar' },
        ...VALID_HEADERS,
      });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Create 時に refreshToken 無しなら client_id/secret 不要 (200)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'vcrd_x', vault_id: 'vlt_abc' }), { status: 200 }),
      );
      const { refreshToken: _r, ...bodyWithoutRefresh } = VALID_BODY;
      const req = makeRequest({
        body: bodyWithoutRefresh,
        anthropicApiKey: VALID_HEADERS.anthropicApiKey,
        // client id/secret 無し
      });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Create path (credentialId 無し)', () => {
    it('Anthropic に POST /v1/vaults/{id}/credentials を呼ぶ', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'vcrd_new', vault_id: 'vlt_abc' }), { status: 200 }),
      );

      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS });
      const res = await handleCredentialsUpsert(req);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { credential_id: string; vault_id: string };
      expect(json.credential_id).toBe('vcrd_new');
      expect(json.vault_id).toBe('vlt_abc');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.anthropic.com/v1/vaults/vlt_abc/credentials');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['X-Api-Key']).toBe('sk-ant-test');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01');
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body as string);
      expect(body.auth.type).toBe('mcp_oauth');
      expect(body.auth.mcp_server_url).toBe('https://example.com/mcp/tenant.cybozu.com');
      expect(body.auth.access_token).toBe('kintone-access-token');
      expect(typeof body.auth.expires_at).toBe('string');
      // refresh ブロックのネスト構造が正しい
      expect(body.auth.refresh.refresh_token).toBe('kintone-refresh-token');
      expect(body.auth.refresh.token_endpoint).toBe('https://tenant.cybozu.com/oauth2/token');
      expect(body.auth.refresh.client_id).toBe('kintone-client-id');
      expect(body.auth.refresh.scope).toBe('k:app_record:read');
      expect(body.auth.refresh.token_endpoint_auth.type).toBe('client_secret_basic');
      expect(body.auth.refresh.token_endpoint_auth.client_secret).toBe('kintone-client-secret');
      expect(body.display_name).toBe('kintone');
    });

    it('refreshToken 無しなら refresh ブロックを含めない', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'vcrd_new', vault_id: 'vlt_abc' }), { status: 200 }),
      );

      const { refreshToken: _r, ...bodyWithoutRefresh } = VALID_BODY;
      const req = makeRequest({
        body: bodyWithoutRefresh,
        anthropicApiKey: VALID_HEADERS.anthropicApiKey,
      });
      await handleCredentialsUpsert(req);

      const init = fetchMock.mock.calls[0]![1];
      const body = JSON.parse(init.body as string);
      expect(body.auth.refresh).toBeUndefined();
    });
  });

  describe('Update path (credentialId 有り)', () => {
    it('Anthropic に POST /v1/vaults/{id}/credentials/{cred_id} を呼ぶ', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'vcrd_existing', vault_id: 'vlt_abc' }), { status: 200 }),
      );

      const req = makeRequest({
        body: { ...VALID_BODY, credentialId: 'vcrd_existing' },
        ...VALID_HEADERS,
      });
      const res = await handleCredentialsUpsert(req);

      expect(res.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.anthropic.com/v1/vaults/vlt_abc/credentials/vcrd_existing');
      expect(init.method).toBe('POST');

      const body = JSON.parse(init.body as string);
      expect(body.auth.type).toBe('mcp_oauth');
      expect(body.auth.access_token).toBe('kintone-access-token');
      expect(body.auth.refresh.refresh_token).toBe('kintone-refresh-token');
      expect(body.auth.refresh.scope).toBe('k:app_record:read');
      // Update では client_secret / client_id / token_endpoint / mcp_server_url を含めない
      expect(body.auth.mcp_server_url).toBeUndefined();
      expect(body.auth.refresh.client_id).toBeUndefined();
      expect(body.auth.refresh.client_secret).toBeUndefined();
      expect(body.auth.refresh.token_endpoint).toBeUndefined();
      expect(body.auth.refresh.token_endpoint_auth).toBeUndefined();
    });

    it('Update 時は client_id/secret ヘッダ無しでも OK', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'vcrd_existing', vault_id: 'vlt_abc' }), { status: 200 }),
      );

      const req = makeRequest({
        body: { ...VALID_BODY, credentialId: 'vcrd_existing' },
        anthropicApiKey: VALID_HEADERS.anthropicApiKey,
        // client id/secret 無し
      });
      const res = await handleCredentialsUpsert(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Anthropic エラー転載', () => {
    it('404 はそのまま転載', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ type: 'error', error: { message: 'not found' } }), {
          status: 404,
        }),
      );

      const req = makeRequest({
        body: { ...VALID_BODY, credentialId: 'vcrd_archived' },
        ...VALID_HEADERS,
      });
      const res = await handleCredentialsUpsert(req);

      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: string; status: number };
      expect(json.error).toBe('anthropic_error');
      expect(json.status).toBe(404);
    });

    it('500 もそのまま転載', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('internal server error', { status: 500 }),
      );

      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS });
      const res = await handleCredentialsUpsert(req);

      expect(res.status).toBe(500);
    });

    it('上流エラー body に秘匿情報が混入していても伏字にして返す', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('auth error: sk-ant-api03-LeakedKey_123abc was rejected', { status: 401 }),
      );

      const req = makeRequest({ body: VALID_BODY, ...VALID_HEADERS });
      const res = await handleCredentialsUpsert(req);

      const json = (await res.json()) as { body: string };
      expect(json.body).not.toContain('sk-ant-api03-LeakedKey_123abc');
      expect(json.body).toContain('[REDACTED]');
    });
  });
});
