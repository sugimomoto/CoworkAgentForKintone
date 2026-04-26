// Cowork Agent for kintone — Remote MCP Server (Cloudflare Workers)
//
// エンドポイント:
//   POST /mint  — Plugin が kintone 認証情報を渡して JWT を発行してもらう
//   POST /mcp   — Anthropic Managed Agents が JWT を Bearer に MCP リクエストを送る
//
// 詳細は packages/kintone-mcp/README.md を参照。

import { handleMcp } from './mcp';
import { handleMint } from './mint';

export interface Env {
  /** JWT 署名・検証に使う HMAC-SHA256 秘密鍵 (Worker 内部のみ) */
  JWT_HMAC_SECRET: string;
  /** Plugin → Worker /mint の Bearer 認証用秘密鍵 */
  MINT_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/mint' && request.method === 'POST') {
      return handleMint(request, env);
    }
    if (url.pathname === '/mcp' && request.method === 'POST') {
      return handleMcp(request, env);
    }

    // Health check / 405
    if (url.pathname === '/' || url.pathname === '/healthz') {
      return new Response('OK', { status: 200 });
    }
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
