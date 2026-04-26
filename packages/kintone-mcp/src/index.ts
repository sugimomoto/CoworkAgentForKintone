// Cowork Agent for kintone — Remote MCP Server (Cloudflare Workers)
//
// エンドポイント:
//   POST /mint  — Plugin が kintone 認証情報を渡して JWT を発行してもらう
//   POST /mcp   — Anthropic Managed Agents が JWT を Bearer に MCP リクエストを送る
//
// 詳細は packages/kintone-mcp/README.md を参照。

export interface Env {
  /** JWT 署名・検証に使う HMAC-SHA256 秘密鍵 (Worker 内部のみ) */
  JWT_HMAC_SECRET: string;
  /** Plugin → Worker /mint の Bearer 認証用秘密鍵 */
  MINT_API_KEY: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    // M9 で実装: /mint と /mcp ルーティング
    if (url.pathname === '/mint' && request.method === 'POST') {
      return new Response('Not Implemented (M4)', { status: 501 });
    }
    if (url.pathname === '/mcp' && request.method === 'POST') {
      return new Response('Not Implemented (M8)', { status: 501 });
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
