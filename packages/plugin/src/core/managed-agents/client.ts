// Cowork Agent for kintone — Managed Agents API HTTP クライアント
//
// kintone.plugin.app.proxy 経由で Anthropic API を呼ぶ前提のため、
// API Key はここでは扱わない (Proxy 設定で固定ヘッダとして注入される)。

import { ANTHROPIC_API_BASE, ANTHROPIC_VERSION, MANAGED_AGENTS_BETA } from '../constants';

export type Headers = Record<string, string>;
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * Anthropic API に渡す必須ヘッダを構築する。
 *
 * curl で検証した結果、Managed Agents Beta API は以下のヘッダを必須とする:
 *   - anthropic-version (なしだと 400 "anthropic-version: header is required")
 *   - anthropic-beta (Beta 機能利用に必須)
 *   - x-api-key (kintone.plugin.app.setProxyConfig で固定登録、JS 側からは付与しない)
 *
 * Content-Type はリクエスト body を伴うメソッド (POST 等) のみ付与する。
 */
export function apiHeaders(method: HttpMethod = 'GET', extra: Headers = {}): Headers {
  const headers: Headers = {
    ...extra,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-beta': MANAGED_AGENTS_BETA,
  };
  if (method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// ----- transport (差し替え可能な HTTP 送信層) -------------------------------
//
// 既定は fetch (テスト・Node 環境向け)。
// ブラウザ運用時は kintone.plugin.app.proxy 経由に差し替えることで CORS を回避する。

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

const defaultTransport: Transport = (url, init) => fetch(url, init);

let transport: Transport = defaultTransport;

export function setTransport(t: Transport): void {
  transport = t;
}

export function resetTransport(): void {
  transport = defaultTransport;
}

/** Managed Agents API のエラー */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Managed Agents API への HTTP リクエスト。
 * - 200/201: パース済 JSON を返す
 * - 204 / body 空: null を返す
 * - 4xx/5xx: ApiError を throw
 */
export async function apiRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const url = `${ANTHROPIC_API_BASE}${path}`;
  // x-api-key は kintone.plugin.app.setProxyConfig で固定ヘッダとして登録され、
  // kintone runtime がリクエスト時に自動付与する (JS 側からは付与しない)
  const init: RequestInit = {
    method,
    headers: apiHeaders(method),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await transport(url, init);

  if (!res.ok) {
    let parsed: unknown;
    // 既定: HTTP ステータスと statusText
    let message = `[HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}]`;
    try {
      parsed = await res.json();
      const err = (parsed as { error?: { message?: string; type?: string } })?.error;
      if (err?.message) {
        // Anthropic エラーは type を含めると原因特定しやすい
        // 例: "[HTTP 401] authentication_error: Authentication failed"
        message = err.type
          ? `[HTTP ${res.status}] ${err.type}: ${err.message}`
          : `[HTTP ${res.status}] ${err.message}`;
      }
    } catch {
      // body がない / JSON でない場合はそのまま
    }
    throw new ApiError(res.status, message, parsed);
  }

  // 204 No Content や Content-Length: 0 の場合
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }
  const text = await res.text();
  if (!text) return null;

  return JSON.parse(text) as T;
}
