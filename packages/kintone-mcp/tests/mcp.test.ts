// /mcp/<domain> Bearer 透過モードのテスト (マルチテナント版)。
//
// 検証:
// - URL 形式違反 → 404
// - Bearer 無し → 401
// - 正規 URL + Bearer + initialize → serverInfo
// - tools/list → 10 ツール並び (read 4 + write 6)
// - tools/call (kintone-get-apps) → kintone fetch を Bearer + 正しいドメインで叩く

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleMcp } from '../src/mcp';

const BEARER = 'oauth-access-token';
const DOMAIN = 'tenant.cybozu.com';
const URL_PATH = `https://example.com/mcp/${DOMAIN}`;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mcpRequest(
  body: unknown,
  opts: { authHeader?: string | null; url?: string } = {},
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.authHeader === undefined) {
    headers['Authorization'] = `Bearer ${BEARER}`;
  } else if (opts.authHeader !== null) {
    headers['Authorization'] = opts.authHeader;
  }
  const init: RequestInit = { method: 'POST', headers, body: JSON.stringify(body) };
  return new Request(opts.url ?? URL_PATH, init);
}

describe('handleMcp', () => {
  it('URL が /mcp/<domain> 形式でないと 404', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', method: 'initialize', id: 1 }, { url: 'https://example.com/mcp' }),
    );
    expect(res.status).toBe(404);
  });

  it('cybozu.com 以外のドメインは 404', async () => {
    const res = await handleMcp(
      mcpRequest(
        { jsonrpc: '2.0', method: 'initialize', id: 1 },
        { url: 'https://example.com/mcp/example.com' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('Authorization ヘッダ無しなら 401', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', method: 'initialize', id: 1 }, { authHeader: null }),
    );
    expect(res.status).toBe(401);
  });

  it('initialize は serverInfo + capabilities を返す', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', method: 'initialize', id: 1 }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: { serverInfo: { name: string }; capabilities: unknown } };
    expect(json.result.serverInfo.name).toBe('cowork-agent-kintone-mcp');
    expect(json.result.capabilities).toBeDefined();
  });

  it('tools/list は read 4 + write 6 ツールを返す', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', method: 'tools/list', id: 2 }));
    const json = (await res.json()) as { result: { tools: Array<{ name: string }> } };
    const names = json.result.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        // Read
        'kintone-get-apps',
        'kintone-get-app',
        'kintone-get-form-fields',
        'kintone-get-records',
        // Write
        'kintone-add-record',
        'kintone-add-records',
        'kintone-update-record',
        'kintone-update-records',
        'kintone-delete-records',
        'kintone-add-record-comment',
      ]),
    );
    expect(names).toHaveLength(10);
  });

  it('tools/call kintone-get-apps は URL のドメインに対して Bearer で叩く', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ apps: [{ appId: '1', name: 'App1' }] }), { status: 200 }),
    );

    const res = await handleMcp(
      mcpRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 3,
        params: { name: 'kintone-get-apps', arguments: {} },
      }),
    );

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`https://${DOMAIN}/k/v1/apps.json`);
    const h = init.headers as Record<string, string>;
    expect(h['Authorization']).toBe(`Bearer ${BEARER}`);
  });

  it('別ドメインの URL なら別ドメインに対して叩く', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }));
    await handleMcp(
      mcpRequest(
        { jsonrpc: '2.0', method: 'tools/call', id: 4, params: { name: 'kintone-get-apps', arguments: {} } },
        { url: 'https://example.com/mcp/another.cybozu.com' },
      ),
    );
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('https://another.cybozu.com/k/v1/apps.json');
  });

  it('未知のツール名は -32601', async () => {
    const res = await handleMcp(
      mcpRequest({ jsonrpc: '2.0', method: 'tools/call', id: 5, params: { name: 'no-such' } }),
    );
    const json = (await res.json()) as { error: { code: number } };
    expect(json.error.code).toBe(-32601);
  });

  it('未知の method は -32601', async () => {
    const res = await handleMcp(mcpRequest({ jsonrpc: '2.0', method: 'unknown', id: 6 }));
    const json = (await res.json()) as { error: { code: number } };
    expect(json.error.code).toBe(-32601);
  });
});
