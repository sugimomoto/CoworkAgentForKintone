// kintone REST API クライアントヘルパ。
// Cloudflare Workers の標準 fetch + Web API のみ使用 (Node 互換不要)。
//
// Phase 1b-1 の Python helper の TypeScript 版に相当する最小実装。
// 認証は Basic 認証 / API トークン両対応。

export type KintoneCreds =
  | {
      domain: string;
      auth_type: 'basic';
      login: string;
      password: string;
    }
  | {
      domain: string;
      auth_type: 'api_token';
      api_token: string;
    };

export interface KintoneRequestOptions {
  /** URL クエリパラメータ。配列値は `key=v1&key=v2` で送出される。null/undefined は送らない */
  params?: Record<string, unknown>;
  /** JSON body (GET 時は無視される) */
  body?: unknown;
}

function buildHeaders(creds: KintoneCreds, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (creds.auth_type === 'basic') {
    headers['X-Cybozu-Authorization'] = btoa(`${creds.login}:${creds.password}`);
  } else {
    headers['X-Cybozu-API-Token'] = creds.api_token;
  }
  // GET など body 無しのリクエストには Content-Type を付けない
  // (kintone は CB_IL02 で拒否することがある — Phase 1b-1 で踏んだ罠)
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
