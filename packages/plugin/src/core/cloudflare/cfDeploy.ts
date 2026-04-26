// Cloudflare Workers デプロイクライアント。
//
// Plugin 設定画面から `kintone.proxy()` 経由で api.cloudflare.com を叩く。
// 設定画面では `kintone.plugin.app.proxy` は使えず (desktop runtime 専用)、
// `kintone.proxy()` を使う必要がある。Cloudflare API Token は admin が
// 同画面で入力した値を Authorization ヘッダに直接乗せる。
//
// フロー:
//   1. GET /accounts/{id}/workers/subdomain  → account の workers.dev サブドメイン取得
//   2. PUT /accounts/{id}/workers/scripts/{name}  → Worker JS バンドルを multipart でアップロード
//   3. POST /accounts/{id}/workers/scripts/{name}/subdomain  → workers.dev エンドポイント有効化
//   4. URL を組み立てて返す: https://{name}.{subdomain}.workers.dev

import { buildMultipartBody, generateBoundary } from './multipart';

const CF_BASE = 'https://api.cloudflare.com/client/v4';
const COMPATIBILITY_DATE = '2026-04-01';

export interface CloudflareDeployArgs {
  /** Cloudflare API Token (Authorization: Bearer に乗せる) */
  apiToken: string;
  accountId: string;
  /** Worker script 名 (固定推奨: cowork-agent-kintone-mcp) */
  scriptName: string;
  /** ES module 形式の Worker JS バンドル (export default { fetch }) */
  workerJsContent: string;
}

export interface CloudflareDeployResult {
  workerUrl: string;
  scriptName: string;
  accountSubdomain: string;
}

interface CfApiEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

class CloudflareApiError extends Error {
  status: number;
  responseBody: string;
  constructor(message: string, status: number, responseBody: string) {
    super(message);
    this.name = 'CloudflareApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

async function cfProxy(
  apiToken: string,
  url: string,
  method: 'GET' | 'POST' | 'PUT',
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; body: string }> {
  if (typeof kintone === 'undefined' || typeof kintone.proxy !== 'function') {
    throw new Error('kintone.proxy is not available (Plugin 設定画面以外では使えません)');
  }
  const finalHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    ...headers,
  };
  const [respBody, status] = await kintone.proxy(url, method, finalHeaders, body);
  return { status, body: respBody };
}

async function getAccountSubdomain(args: { apiToken: string; accountId: string }): Promise<string> {
  const url = `${CF_BASE}/accounts/${encodeURIComponent(args.accountId)}/workers/subdomain`;
  const { status, body } = await cfProxy(args.apiToken, url, 'GET', {}, '');
  if (status < 200 || status >= 300) {
    throw new CloudflareApiError(`failed to get account subdomain (${status})`, status, body);
  }
  const parsed = JSON.parse(body) as CfApiEnvelope<{ subdomain: string }>;
  if (!parsed.success || !parsed.result?.subdomain) {
    throw new CloudflareApiError(
      'Cloudflare account に workers.dev サブドメインが設定されていません。Cloudflare Dashboard で 1 度設定してください。',
      status,
      body,
    );
  }
  return parsed.result.subdomain;
}

async function uploadWorkerScript(args: {
  apiToken: string;
  accountId: string;
  scriptName: string;
  workerJsContent: string;
}): Promise<void> {
  const url = `${CF_BASE}/accounts/${encodeURIComponent(args.accountId)}/workers/scripts/${encodeURIComponent(args.scriptName)}`;
  const boundary = generateBoundary();
  const metadata = JSON.stringify({
    main_module: 'worker.js',
    compatibility_date: COMPATIBILITY_DATE,
  });
  const body = buildMultipartBody(
    [
      { name: 'metadata', contentType: 'application/json', content: metadata },
      {
        name: 'worker.js',
        filename: 'worker.js',
        contentType: 'application/javascript+module',
        content: args.workerJsContent,
      },
    ],
    boundary,
  );
  const { status, body: respBody } = await cfProxy(
    args.apiToken,
    url,
    'PUT',
    { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  );
  if (status < 200 || status >= 300) {
    throw new CloudflareApiError(`failed to upload Worker (${status})`, status, respBody);
  }
}

/**
 * デプロイ済 Worker の /version エンドポイントを直接叩き、build version を取得。
 * /version は CORS allow-origin: * を返すので kintone proxy は不要。
 *
 * @returns 取得できた version 情報、or 取得失敗時は null
 */
export interface WorkerVersionInfo {
  name: string;
  version: string;
  builtAt: string;
}

export async function fetchDeployedWorkerVersion(workerUrl: string): Promise<WorkerVersionInfo | null> {
  const url = `${workerUrl.replace(/\/$/, '')}/version`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<WorkerVersionInfo>;
    if (
      typeof data.name === 'string' &&
      typeof data.version === 'string' &&
      typeof data.builtAt === 'string'
    ) {
      return data as WorkerVersionInfo;
    }
    return null;
  } catch {
    return null;
  }
}

async function enableWorkersDev(args: { apiToken: string; accountId: string; scriptName: string }): Promise<void> {
  const url = `${CF_BASE}/accounts/${encodeURIComponent(args.accountId)}/workers/scripts/${encodeURIComponent(args.scriptName)}/subdomain`;
  const { status, body } = await cfProxy(
    args.apiToken,
    url,
    'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ enabled: true }),
  );
  if (status < 200 || status >= 300) {
    throw new CloudflareApiError(`failed to enable workers.dev (${status})`, status, body);
  }
}

export async function deployWorker(args: CloudflareDeployArgs): Promise<CloudflareDeployResult> {
  const accountSubdomain = await getAccountSubdomain({
    apiToken: args.apiToken,
    accountId: args.accountId,
  });
  await uploadWorkerScript(args);
  await enableWorkersDev({
    apiToken: args.apiToken,
    accountId: args.accountId,
    scriptName: args.scriptName,
  });
  const workerUrl = `https://${args.scriptName}.${accountSubdomain}.workers.dev`;
  return { workerUrl, scriptName: args.scriptName, accountSubdomain };
}

export { CloudflareApiError };
