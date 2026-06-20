// POST /notify/<domain>/<notifyKey> エンドポイント (#13)。
// Anthropic Managed Agents が MCP HTTP transport (JSON-RPC 2.0) で叩く。
// Agent ごとの通知用 MCP サーバ。Authorization: Bearer <Webhook URL> が
// Vault static_bearer で注入される (未設定 Agent では無し)。Worker は何も保存しない。
//
// セキュリティ: Bearer (= Webhook URL 実値) は秘匿。ヘッダ/URL をログに出さない。

import { jsonResponse } from './_http';
import { notifyPathPattern } from './kintone-domains';
import { runSendNotification } from './notify/sendNotification';

import type { NotifyMessage } from './notify/format';

const SERVER_INFO = { name: 'cowork-agent-notify-mcp', version: '0.1.0' };

const SEND_NOTIFICATION_TOOL = {
  name: 'send_notification',
  title: '通知を送信',
  description:
    'このエージェントに登録された Slack / Microsoft Teams / Discord の Webhook に通知を送る。' +
    '集計結果やタスク完了などをチームへ共有したいときに使う。通知先が未設定なら送信されない。',
  inputSchema: {
    title: { type: 'string', description: '通知の見出し (例: 顧客別売上集計 完了)' },
    text: { type: 'string', description: '本文 (要約・結果)' },
    fields: {
      type: 'array',
      description: '任意の補足項目 (label/value)',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'string' } },
      },
    },
    link: {
      type: 'object',
      description: 'kintone レコード等へのリンク (任意)',
      properties: { label: { type: 'string' }, url: { type: 'string' } },
    },
  },
};

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: unknown;
}

function rpcSuccess(id: number | string | null, result: unknown): unknown {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: number | string | null, code: number, message: string): unknown {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export async function handleNotify(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!notifyPathPattern().test(url.pathname)) {
    return jsonResponse({ error: 'invalid_path', message: 'Expected /notify/<domain>/<key>' }, 404);
  }

  // Bearer = 注入された Webhook URL (未設定なら null)。ログには出さない。
  const auth = request.headers.get('Authorization');
  const webhookUrl = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() || null : null;

  let req: JsonRpcRequest;
  try {
    req = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonResponse(rpcError(null, -32700, 'Parse error'));
  }
  if (
    typeof req !== 'object' ||
    req === null ||
    req.jsonrpc !== '2.0' ||
    typeof req.method !== 'string'
  ) {
    return jsonResponse(rpcError(req?.id ?? null, -32600, 'Invalid Request'));
  }
  const id = req.id ?? null;

  switch (req.method) {
    case 'initialize':
      return jsonResponse(
        rpcSuccess(id, {
          protocolVersion: '2024-11-05',
          serverInfo: SERVER_INFO,
          capabilities: { tools: {} },
        }),
      );
    case 'tools/list':
      return jsonResponse(
        rpcSuccess(id, {
          tools: [
            {
              name: SEND_NOTIFICATION_TOOL.name,
              title: SEND_NOTIFICATION_TOOL.title,
              description: SEND_NOTIFICATION_TOOL.description,
              inputSchema: { type: 'object', properties: SEND_NOTIFICATION_TOOL.inputSchema },
            },
          ],
        }),
      );
    case 'tools/call': {
      const params = req.params as { name?: string; arguments?: Record<string, unknown> } | null;
      if (!params || params.name !== 'send_notification') {
        return jsonResponse(rpcError(id, -32601, `Unknown tool: ${params?.name ?? ''}`));
      }
      const result = await runSendNotification(
        (params.arguments ?? {}) as unknown as NotifyMessage,
        webhookUrl,
      );
      return jsonResponse(rpcSuccess(id, result));
    }
    default:
      return jsonResponse(rpcError(id, -32601, `Method not found: ${req.method}`));
  }
}
