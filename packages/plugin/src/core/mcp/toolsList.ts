// 第三者 MCP サーバーの公開ツールを取得する（接続テスト + ツール一覧表示・#42）。
//
// MCP Streamable HTTP transport の最小クライアント:
//   initialize → notifications/initialized → tools/list
// CORS 回避のため kintone.proxy を使う（proxyConfig 不要の汎用 proxy）。
// bearer 接続では接続時に手元にある API キーを Authorization: Bearer で付与する。
// レスポンスは JSON または SSE（text/event-stream の data: 行）のどちらでも解釈する。

import type { McpTool } from './registry';

interface RpcResult {
  json: unknown;
  sessionId: string | null;
}

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'cowork-agent-for-kintone', version: '1' };

/** SSE（event/data 行）or 素の JSON の本文から JSON-RPC オブジェクトを取り出す。 */
function parseRpcBody(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  // SSE: 最後の `data: ` 行を JSON として読む
  const dataLines = trimmed
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  const last = dataLines[dataLines.length - 1];
  if (!last) throw new Error(`MCP 応答を解釈できません: ${trimmed.slice(0, 120)}`);
  return JSON.parse(last);
}

function headerCI(headers: Record<string, string>, name: string): string | null {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

async function rpc(
  url: string,
  payload: Record<string, unknown>,
  opts: { bearerToken?: string; sessionId?: string | null; expectResult: boolean },
): Promise<RpcResult> {
  if (typeof kintone === 'undefined' || !kintone) {
    throw new Error('kintone JavaScript API is not available');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (opts.bearerToken) headers.Authorization = `Bearer ${opts.bearerToken}`;
  if (opts.sessionId) headers['Mcp-Session-Id'] = opts.sessionId;

  const [body, status, resHeaders] = await kintone.proxy(url, 'POST', headers, JSON.stringify(payload));
  const sessionId = headerCI(resHeaders ?? {}, 'Mcp-Session-Id');

  if (status < 200 || status >= 300) {
    throw new Error(`MCP ${String(payload.method)} 失敗 (HTTP ${status}): ${body.slice(0, 200)}`);
  }
  if (!opts.expectResult) {
    return { json: null, sessionId };
  }
  const json = parseRpcBody(body);
  const err = (json as { error?: { message?: string } } | null)?.error;
  if (err) {
    throw new Error(`MCP ${String(payload.method)} エラー: ${err.message ?? JSON.stringify(err)}`);
  }
  return { json, sessionId };
}

/**
 * MCP サーバーの公開ツール一覧を取得する。接続テスト兼ツール列挙に使う。
 * @throws 疎通失敗・認証エラー・プロトコルエラー時
 */
export async function fetchMcpTools(args: { url: string; bearerToken?: string }): Promise<McpTool[]> {
  const { url, bearerToken } = args;

  // 1. initialize（session を確立）
  const init = await rpc(
    url,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    },
    { ...(bearerToken ? { bearerToken } : {}), expectResult: true },
  );
  const sessionId = init.sessionId;

  // 2. notifications/initialized（session があるときのみ・通知なので結果なし）
  if (sessionId) {
    try {
      await rpc(
        url,
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { ...(bearerToken ? { bearerToken } : {}), sessionId, expectResult: false },
      );
    } catch {
      // 通知失敗は致命ではない（tools/list を試す）
    }
  }

  // 3. tools/list
  const res = await rpc(
    url,
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { ...(bearerToken ? { bearerToken } : {}), sessionId, expectResult: true },
  );
  const tools = (res.json as { result?: { tools?: unknown[] } } | null)?.result?.tools;
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((t): t is { name: string; description?: string } => !!t && typeof (t as { name?: unknown }).name === 'string')
    .map((t) => ({ name: t.name, ...(typeof t.description === 'string' ? { description: t.description } : {}) }));
}
