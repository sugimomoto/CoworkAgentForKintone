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

interface KintoneErrorBody {
  code?: string;
  message?: string;
  id?: string;
  errors?: unknown;
}

/**
 * kintone REST API のエラー応答を表す例外。
 *
 * - `status`: HTTP status
 * - `code`: kintone エラーコード (例: `GAIA_IL01`, `CB_VA01`)
 * - `errorId`: kintone リクエスト ID (サポート問い合わせで参照)
 * - `errors`: フィールド単位のエラー詳細 (`CV_VL01` など)
 * - `retryable`: クライアント側で再試行が妥当か (5xx / 429 のみ true)
 *
 * `message` は `kintone <status> [<code>]: <body>` 形式。既存の文字列マッチを壊さない。
 */
export class KintoneApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly errorId: string | undefined;
  readonly errors: unknown;
  readonly retryable: boolean;
  readonly responseText: string;

  constructor(status: number, responseText: string, parsed?: KintoneErrorBody) {
    const code = parsed?.code;
    const detail = parsed?.message ?? responseText;
    const prefix = code ? `kintone ${status} [${code}]` : `kintone ${status}`;
    super(`${prefix}: ${detail}`);
    this.name = 'KintoneApiError';
    this.status = status;
    this.code = code;
    this.errorId = parsed?.id;
    this.errors = parsed?.errors;
    this.retryable = status >= 500 || status === 429;
    this.responseText = responseText;
  }
}

function parseKintoneError(text: string): KintoneErrorBody | undefined {
  try {
    const obj = JSON.parse(text) as unknown;
    if (obj && typeof obj === 'object') return obj as KintoneErrorBody;
  } catch {
    // ignore
  }
  return undefined;
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
    throw new KintoneApiError(response.status, text, parseKintoneError(text));
  }

  if (response.status === 204) return {};
  return response.json();
}

/**
 * 添付ファイルアップロード (`POST /k/v1/file.json`, multipart/form-data, field=`file`)。
 * fetch が FormData の Content-Type / boundary を自動付与する。Authorization のみ明示。
 */
export async function kintoneUploadFile(
  creds: KintoneCreds,
  filename: string,
  bytes: Uint8Array,
  contentType?: string,
): Promise<{ fileKey: string }> {
  const url = `https://${creds.domain}/k/v1/file.json`;
  const form = new FormData();
  // Uint8Array<ArrayBufferLike> を BlobPart に渡すと TS が SharedArrayBuffer の可能性で
  // 怒るが、Workers ランタイムでは常に ArrayBuffer。安全にスライスして渡す。
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([ab], contentType ? { type: contentType } : undefined);
  form.append('file', blob, filename);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent':
        'cowork-agent-kintone-mcp/0.1.0 (+https://github.com/sugimomoto/CoworkAgentForKintone)',
      Authorization: `Bearer ${creds.bearer}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new KintoneApiError(response.status, text, parseKintoneError(text));
  }
  return (await response.json()) as { fileKey: string };
}

/**
 * 添付ファイルダウンロード (`GET /k/v1/file.json?fileKey=...`)。
 * バイナリを Uint8Array で返す。`Content-Type` ヘッダがあれば一緒に返す。
 */
export async function kintoneDownloadFile(
  creds: KintoneCreds,
  fileKey: string,
): Promise<{ bytes: Uint8Array; contentType: string | null; size: number }> {
  const url = buildUrl(creds.domain, '/k/v1/file.json', { fileKey });
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'cowork-agent-kintone-mcp/0.1.0 (+https://github.com/sugimomoto/CoworkAgentForKintone)',
      Authorization: `Bearer ${creds.bearer}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new KintoneApiError(response.status, text, parseKintoneError(text));
  }

  const buf = await response.arrayBuffer();
  const bytes = new Uint8Array(buf);
  return {
    bytes,
    contentType: response.headers.get('content-type'),
    size: bytes.byteLength,
  };
}
