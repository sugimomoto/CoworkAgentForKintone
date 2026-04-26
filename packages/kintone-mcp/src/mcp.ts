// POST /mcp エンドポイント。
// Anthropic Managed Agents から Bearer JWT 付きで MCP HTTP transport (JSON-RPC 2.0) で呼ばれる。
//
// 対応 method:
//   - initialize     — server info / capabilities を返す
//   - tools/list     — ツール一覧 (auth_type に応じて除外フィルタ適用)
//   - tools/call     — 指定ツールを実行

import type { Env } from './index';
import { verifyJwt } from './jwt';
import type { KintoneCreds } from './kintone';
import { shouldEnableTool } from './server/tool-filters';
import { tools } from './tools';

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

interface JwtKintonePayload {
  kintone: KintoneCreds;
  exp?: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rpcSuccess(id: number | string | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function authenticate(request: Request, env: Env): Promise<KintoneCreds | null> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (token === '') return null;
  try {
    const payload = await verifyJwt<JwtKintonePayload>(token, env.JWT_HMAC_SECRET);
    return payload.kintone;
  } catch {
    return null;
  }
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const creds = await authenticate(request, env);
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
      const isApiTokenAuth = creds.auth_type === 'api_token';
      const enabled = tools
        .filter((t) => shouldEnableTool(t.name, { isApiTokenAuth }))
        .map((t) => ({
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
      const isApiTokenAuth = creds.auth_type === 'api_token';
      const tool = tools.find(
        (t) => t.name === params.name && shouldEnableTool(t.name, { isApiTokenAuth }),
      );
      if (!tool) {
        return jsonResponse(rpcError(id, -32601, `Unknown tool: ${params.name}`));
      }
      try {
        const result = await tool.callback(params.arguments ?? {}, { creds });
        return jsonResponse(rpcSuccess(id, result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // ツール内エラーは isError: true で MCP に返す (= プロトコル成功、論理エラー)
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
