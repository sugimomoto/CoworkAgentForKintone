// Cowork Agent for kintone — Remote MCP Server (Cloudflare Workers)
//
// マルチテナント版 (env / secret 一切なし):
//   POST /mcp/<domain>             — Anthropic Managed Agents が Bearer (kintone OAuth access_token) で叩く
//   GET  /oauth/callback           — kintone OAuth リダイレクト受け口
//   POST /credentials/upsert       — Plugin が Anthropic Vault Credential を作成・更新
//   POST /skills/sync              — Plugin が kintone 固有 custom skill を Anthropic にアップロード (Issue #30)
//   *    /anthropic/<path>         — Anthropic API 汎用 passthrough (Issue #31)
//   GET  /files/<id>/content       — Anthropic Files API バイナリ DL (base64 中継)
//   GET  /healthz                  — health check
//   GET  /version                  — build version
//   GET  /debug/echo               — リクエストヘッダ確認用 (検証中のみ)

import { maskToken } from './_http';
import { handleAnthropicPassthrough } from './anthropic-passthrough';
import { handleCredentialsUpsert } from './credentials-upsert';
import { handleFilesDownload } from './files-download';
import { handleMcp } from './mcp';
import { handleNotify } from './notify';
import { handleOAuthCallback } from './oauth-callback';
import { handleSkillsSync } from './skills-sync';
import { BUILD_TIME, BUILD_VERSION } from './version';

// Worker は env / secret を保持しない。型のために空オブジェクトで宣言。
export type Env = Record<string, never>;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/notify/') && request.method === 'POST') {
      return handleNotify(request);
    }

    if (url.pathname.startsWith('/mcp/') && request.method === 'POST') {
      return handleMcp(request);
    }

    if (url.pathname === '/oauth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request);
    }

    if (url.pathname === '/credentials/upsert' && request.method === 'POST') {
      return handleCredentialsUpsert(request);
    }

    // POST /skills/sync — Plugin → Anthropic Skills API の multipart 中継 (Issue #30)
    if (url.pathname === '/skills/sync' && request.method === 'POST') {
      return handleSkillsSync(request);
    }

    // GET /files/:fileId/content — Anthropic Files API バイナリ DL の base64 中継
    {
      const m = url.pathname.match(/^\/files\/([^/]+)\/content$/);
      if (m && request.method === 'GET') {
        return handleFilesDownload(request, m[1]!);
      }
    }

    // /anthropic/<path> — Anthropic API 汎用 passthrough (Issue #31)
    if (url.pathname.startsWith('/anthropic/')) {
      const upstreamPath = url.pathname.slice('/anthropic'.length); // "/v1/agents" など
      return handleAnthropicPassthrough(request, upstreamPath);
    }

    if (url.pathname === '/' || url.pathname === '/healthz') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/version' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          name: 'cowork-agent-kintone-mcp',
          version: BUILD_VERSION,
          builtAt: BUILD_TIME,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            // ブラウザから直接 GET で確認できるよう CORS を許可
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    if (url.pathname === '/debug/echo') {
      const headers: Record<string, string> = {};
      request.headers.forEach((v, k) => {
        if (k.toLowerCase() === 'authorization' && v.startsWith('Bearer ')) {
          headers[k] = `Bearer ${maskToken(v.replace(/^Bearer /, ''))}`;
        } else {
          headers[k] = v;
        }
      });
      let bodyText: string | null = null;
      if (request.method === 'POST') {
        try {
          bodyText = await request.text();
        } catch {
          bodyText = null;
        }
      }
      return new Response(
        JSON.stringify(
          { method: request.method, url: url.toString(), headers, body: bodyText },
          null,
          2,
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
