// Cowork Agent for kintone — Managed Agents API HTTP クライアント
//
// kintone.plugin.app.proxy 経由で Anthropic API を呼ぶ前提のため、
// API Key はここでは扱わない (Proxy 設定で固定ヘッダとして注入される)。
//
// Issue #31: API base は **Worker /anthropic/* 経由** が標準。`setApiBase()` で
// 起動時に `${workerUrl}/anthropic` を inject する。テストや fallback では
// Anthropic 直接 (`ANTHROPIC_API_BASE`) を使う。

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

// ----- API base (差し替え可能な URL prefix) ---------------------------------
//
// 既定は Anthropic 直接 (旧経路 / テスト互換)。
// 本番起動時は `setApiBase('${workerUrl}/anthropic')` を呼び、Worker 経由に切替。

let apiBase: string = ANTHROPIC_API_BASE;

/** Anthropic API へのリクエスト URL prefix を切り替える。 */
export function setApiBase(base: string): void {
  apiBase = base.replace(/\/$/, '');
}

/** 現在の API base を取得する (テスト用)。 */
export function getApiBase(): string {
  return apiBase;
}

/** API base をデフォルト (`ANTHROPIC_API_BASE`) に戻す (テスト用)。 */
export function resetApiBase(): void {
  apiBase = ANTHROPIC_API_BASE;
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
  const url = `${apiBase}${path}`;
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

/**
 * Managed Agents API への raw リクエスト。
 * バイナリレスポンス (Files API の `/content` など) を取りたいときに使う。
 * 4xx/5xx は `apiRequest` 同様 ApiError を throw。成功時はそのまま `Response` を返す。
 */
export async function apiRequestRaw(
  method: HttpMethod,
  path: string,
  extraHeaders: Headers = {},
): Promise<Response> {
  const url = `${apiBase}${path}`;
  const init: RequestInit = {
    method,
    headers: apiHeaders(method, extraHeaders),
  };
  const res = await transport(url, init);
  if (!res.ok) {
    let body: string | undefined;
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      `[HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}]`,
      body,
    );
  }
  return res;
}
