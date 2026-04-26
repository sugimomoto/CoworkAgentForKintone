import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/jwt';
import { handleMcp } from '../src/mcp';

const ENV = {
  JWT_HMAC_SECRET: 'jwt-secret-32-bytes-or-more-yes',
  MINT_API_KEY: 'mint-api-key-32-bytes-or-more-x',
};

const VALID_KINTONE_PAYLOAD = {
  iss: 'cowork-agent-for-kintone',
  sub: 'kintone-creds',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  kintone: {
    domain: 'tenant.cybozu.com',
    auth_type: 'basic' as const,
    login: 'sato',
    password: 'p',
  },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mcpRequest(body: unknown, opts?: { authHeader?: string }): Promise<Request> {
  const jwt = await signJwt(VALID_KINTONE_PAYLOAD, ENV.JWT_HMAC_SECRET);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.authHeader !== undefined) {
    headers['Authorization'] = opts.authHeader;
  } else {
    headers['Authorization'] = `Bearer ${jwt}`;
  }
  return new Request('https://worker.example.com/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/mcp 認証', () => {
  it('Authorization 無しで 401', async () => {
    const req = await mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, {
      authHeader: '',
    });
    const res = await handleMcp(req, ENV);
    expect(res.status).toBe(401);
  });

  it('JWT が不正で 401', async () => {
    const req = await mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, {
      authHeader: 'Bearer not-a-jwt',
    });
    const res = await handleMcp(req, ENV);
    expect(res.status).toBe(401);
  });

  it('JWT 署名鍵違いで 401', async () => {
    const evilJwt = await signJwt(VALID_KINTONE_PAYLOAD, 'different-secret');
    const req = await mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, {
      authHeader: `Bearer ${evilJwt}`,
    });
    const res = await handleMcp(req, ENV);
    expect(res.status).toBe(401);
  });

  it('JWT exp 切れで 401', async () => {
    const expiredJwt = await signJwt(
      { ...VALID_KINTONE_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 60 },
      ENV.JWT_HMAC_SECRET,
    );
    const req = await mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, {
      authHeader: `Bearer ${expiredJwt}`,
    });
    const res = await handleMcp(req, ENV);
    expect(res.status).toBe(401);
  });
});

describe('/mcp JSON-RPC', () => {
  it('initialize で server info / capabilities を返す', async () => {
    const req = await mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const res = await handleMcp(req, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jsonrpc: string; id: number; result: { serverInfo: unknown; capabilities: unknown } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect(body.result.serverInfo).toBeDefined();
    expect(body.result.capabilities).toBeDefined();
  });

  it('tools/list で 4 ツールを返す (Basic 認証)', async () => {
    const req = await mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const res = await handleMcp(req, ENV);
    const body = (await res.json()) as { result: { tools: { name: string }[] } };
    const names = body.result.tools.map((t) => t.name);
    expect(names).toContain('kintone-get-apps');
    expect(names).toContain('kintone-get-records');
    expect(names).toHaveLength(4);
  });

  it('tools/list で API トークン認証時は kintone-get-apps が除外される', async () => {
    const apiTokenJwt = await signJwt(
      {
        ...VALID_KINTONE_PAYLOAD,
        kintone: {
          domain: 'tenant.cybozu.com',
          auth_type: 'api_token',
          api_token: 'tok',
        },
      },
      ENV.JWT_HMAC_SECRET,
    );
    const req = new Request('https://worker.example.com/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiTokenJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const res = await handleMcp(req, ENV);
    const body = (await res.json()) as { result: { tools: { name: string }[] } };
    const names = body.result.tools.map((t) => t.name);
    expect(names).not.toContain('kintone-get-apps');
    expect(names).toContain('kintone-get-records');
  });

  it('tools/call で対応するツールが起動して結果を返す', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ apps: [{ appId: '1', name: 'X' }] }));

    const req = await mcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'kintone-get-apps', arguments: { limit: 10 } },
    });
    const res = await handleMcp(req, ENV);

    const body = (await res.json()) as {
      result: { structuredContent: unknown; content: { type: string; text: string }[] };
    };
    expect(body.result.content[0]?.type).toBe('text');
    const text = body.result.content[0]!.text;
    expect(text).toContain('appId');
  });

  it('tools/call で不明なツール名は error を返す', async () => {
    const req = await mcpRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'kintone-unknown', arguments: {} },
    });
    const res = await handleMcp(req, ENV);
    const body = (await res.json()) as { error?: { code: number; message: string } };
    expect(body.error).toBeDefined();
    expect(body.error?.message).toMatch(/unknown|not found/i);
  });

  it('未対応 method は error を返す', async () => {
    const req = await mcpRequest({ jsonrpc: '2.0', id: 5, method: 'unknown/method' });
    const res = await handleMcp(req, ENV);
    const body = (await res.json()) as { error?: { code: number; message: string } };
    expect(body.error).toBeDefined();
  });

  it('JSON parse 失敗で error を返す', async () => {
    const jwt = await signJwt(VALID_KINTONE_PAYLOAD, ENV.JWT_HMAC_SECRET);
    const req = new Request('https://worker.example.com/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await handleMcp(req, ENV);
    const body = (await res.json()) as { error?: { code: number } };
    expect(body.error).toBeDefined();
  });
});
