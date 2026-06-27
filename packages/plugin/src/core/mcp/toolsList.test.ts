import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMcpTools } from './toolsList';

type ProxyReturn = [string, number, Record<string, string>];

function installProxy(handler: (url: string, method: string, headers: Record<string, string>, data: string) => ProxyReturn): void {
  (globalThis as unknown as { kintone: unknown }).kintone = {
    proxy: vi.fn(async (url: string, method: string, headers: Record<string, string>, data: string) =>
      handler(url, method, headers, data),
    ),
  };
}

afterEach(() => {
  delete (globalThis as unknown as { kintone?: unknown }).kintone;
});

describe('fetchMcpTools', () => {
  it('initialize→tools/list（JSON 応答・session ヘッダ）でツール一覧を返す', async () => {
    const seen: Record<string, string> = {};
    installProxy((_url, _m, headers, data) => {
      const body = JSON.parse(data) as { method: string };
      if (body.method === 'initialize') {
        return [JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } }), 200, { 'Mcp-Session-Id': 'sess-123' }];
      }
      if (body.method === 'notifications/initialized') {
        seen.sessionOnNotify = headers['Mcp-Session-Id'] ?? '';
        return ['', 202, {}];
      }
      // tools/list
      seen.sessionOnList = headers['Mcp-Session-Id'] ?? '';
      return [
        JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'get_issue', description: 'Get an issue' }, { name: 'create_issue' }] } }),
        200,
        {},
      ];
    });

    const tools = await fetchMcpTools({ url: 'https://mcp.example.com', bearerToken: 'pat_x' });
    expect(tools).toEqual([
      { name: 'get_issue', description: 'Get an issue' },
      { name: 'create_issue' },
    ]);
    expect(seen.sessionOnNotify).toBe('sess-123');
    expect(seen.sessionOnList).toBe('sess-123');
  });

  it('SSE（data: 行）応答も解釈する', async () => {
    installProxy((_url, _m, _h, data) => {
      const body = JSON.parse(data) as { method: string };
      if (body.method === 'initialize') {
        return ['event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', 200, {}];
      }
      return ['event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"ping"}]}}\n\n', 200, {}];
    });
    const tools = await fetchMcpTools({ url: 'https://mcp.example.com' });
    expect(tools).toEqual([{ name: 'ping' }]);
  });

  it('JSON-RPC エラーは例外', async () => {
    installProxy((_url, _m, _h, data) => {
      const body = JSON.parse(data) as { method: string };
      if (body.method === 'initialize') return [JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), 200, {}];
      return [JSON.stringify({ jsonrpc: '2.0', id: 2, error: { code: -32601, message: 'no tools' } }), 200, {}];
    });
    await expect(fetchMcpTools({ url: 'https://mcp.example.com' })).rejects.toThrow(/no tools/);
  });

  it('HTTP 401 は例外（認証エラー）', async () => {
    installProxy(() => ['Unauthorized', 401, {}]);
    await expect(fetchMcpTools({ url: 'https://mcp.example.com', bearerToken: 'bad' })).rejects.toThrow(/401/);
  });

  it('bearerToken は Authorization に乗る', async () => {
    let auth = '';
    installProxy((_url, _m, headers, data) => {
      auth = headers.Authorization ?? '';
      const body = JSON.parse(data) as { method: string };
      if (body.method === 'initialize') return [JSON.stringify({ result: {} }), 200, {}];
      return [JSON.stringify({ result: { tools: [] } }), 200, {}];
    });
    await fetchMcpTools({ url: 'https://mcp.example.com', bearerToken: 'pat_abc' });
    expect(auth).toBe('Bearer pat_abc');
  });
});
