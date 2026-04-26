// kintone REST API クライアントヘルパ。
// Cloudflare Workers の標準 fetch + Web API のみ使用 (Node 互換不要)。
//
// 認証は OAuth Bearer 専用。
// Anthropic Managed Agents が Vault Credential (mcp_oauth) から取得した access_token を
// Authorization: Bearer <token> でそのまま MCP リクエストに乗せてくる前提。

export interface KintoneCreds {
  /** kintone domain (例: tenant.cybozu.com) */
  domain: string;
  /** OAuth access_token (Anthropic から渡ってきたもの) */
  bearer: string;
}

export interface KintoneRequestOptions {
  /** URL クエリパラメータ。配列値は `key=v1&key=v2` で送出される。null/undefined は送らない */
  params?: Record<string, unknown>;
  /** JSON body (GET 時は無視される) */
  body?: unknown;
}

function buildHeaders(creds: KintoneCreds, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    // cybozu.com Cloudflare WAF が User-Agent 無しを 1003 で弾くため明示。
    'User-Agent':
      'cowork-agent-kintone-mcp/0.1.0 (+https://github.com/sugimomoto/CoworkAgentForKintone)',
    Authorization: `Bearer ${creds.bearer}`,
  };
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
}

function buildUrl(domain: string, path: string, params: Record<string, unknown> | undefined): string {
  const url = new URL(`https://${domain}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function kintoneRequest(
  creds: KintoneCreds,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: KintoneRequestOptions = {},
): Promise<unknown> {
  const hasBody = options.body !== undefined;
  const url = buildUrl(creds.domain, path, options.params);
  const headers = buildHeaders(creds, hasBody);

  const init: RequestInit = { method, headers };
  if (hasBody) init.body = JSON.stringify(options.body);
  const response = await fetch(url, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`kintone ${response.status}: ${text}`);
  }

  if (response.status === 204) return {};
  return response.json();
}
