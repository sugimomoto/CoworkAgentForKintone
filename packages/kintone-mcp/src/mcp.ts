// POST /mcp/:domain エンドポイント (マルチテナント版)。
// Anthropic Managed Agents から MCP HTTP transport (JSON-RPC 2.0) で呼ばれる。
//
// URL パス末尾の :domain (例: tenant.cybozu.com) で kintone ドメインを指定する。
// Authorization: Bearer <kintone_oauth_access_token> をそのまま kintone API
// リクエストに転送する。Worker は何の env / secret も保持しない。

import { jsonResponse, maskToken, sanitizeError, sanitizeText } from './_http';
import { mcpPathPattern } from './kintone-domains';
import { tools } from './tools';

import type { KintoneCreds } from './kintone';

const SERVER_INFO = {
  name: 'cowork-agent-kintone-mcp',
  version: '0.1.0',
};

const CAPABILITIES = {
  tools: {},
};

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number | string | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: number | string | null;
  error: { code: number; message: string };
}

function rpcSuccess(id: number | string | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** URL `/mcp/<domain>` の domain 部分を取り出す。形式: `<sub>.cybozu.com` 等 */
function extractDomain(request: Request): string | null {
  const url = new URL(request.url);
  const match = url.pathname.match(mcpPathPattern());
  return match ? match[1]! : null;
}

function authenticate(request: Request, domain: string): KintoneCreds | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (token === '') return null;
  return { domain, bearer: token };
}

export async function handleMcp(request: Request): Promise<Response> {
  // 検証用: 受信したヘッダのプレビューをログ
  const allHeaders: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    allHeaders[k] = k.toLowerCase() === 'authorization' ? maskToken(v.replace(/^Bearer /, '')) : v;
  });
  console.log('[/mcp] headers:', sanitizeText(JSON.stringify(allHeaders)));

  const domain = extractDomain(request);
  if (!domain) {
    return jsonResponse({ error: 'invalid_path', message: 'Expected /mcp/<sub>.cybozu.com' }, 404);
  }
  const creds = authenticate(request, domain);
  if (!creds) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let req: JsonRpcRequest;
  try {
    req = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonResponse(rpcError(null, -32700, 'Parse error'));
  }

  if (typeof req !== 'object' || req === null || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return jsonResponse(rpcError(req?.id ?? null, -32600, 'Invalid Request'));
  }

  const id = req.id ?? null;
  console.log('[/mcp] method:', req.method);

  switch (req.method) {
    case 'initialize':
      return jsonResponse(
        rpcSuccess(id, {
          protocolVersion: '2024-11-05',
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES,
        }),
      );

    case 'tools/list': {
      const enabled = tools.map((t) => ({
        name: t.name,
        title: t.config.title,
        description: t.config.description,
        inputSchema: { type: 'object', properties: t.config.inputSchema },
        ...(t.config.outputSchema
          ? { outputSchema: { type: 'object', properties: t.config.outputSchema } }
          : {}),
      }));
      return jsonResponse(rpcSuccess(id, { tools: enabled }));
    }

    case 'tools/call': {
      const params = req.params as { name?: string; arguments?: Record<string, unknown> } | null;
      if (!params || typeof params.name !== 'string') {
        return jsonResponse(rpcError(id, -32602, 'Invalid params (name is required)'));
      }
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) {
        return jsonResponse(rpcError(id, -32601, `Unknown tool: ${params.name}`));
      }
      try {
        const result = await tool.callback(params.arguments ?? {}, { creds });
        return jsonResponse(rpcSuccess(id, result));
      } catch (err) {
        const message = sanitizeError(err);
        console.log('[/mcp] tool error:', message);
        return jsonResponse(
          rpcSuccess(id, {
            isError: true,
            content: [{ type: 'text', text: `Tool error: ${message}` }],
          }),
        );
      }
    }

    default:
      return jsonResponse(rpcError(id, -32601, `Method not found: ${req.method}`));
  }
}
