import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudflareApiError, deployWorker } from './cfDeploy';

const API_TOKEN = 'cf-token-xxx';
const ACCOUNT_ID = 'acct_123';
const SCRIPT_NAME = 'cowork-agent-kintone-mcp';
const WORKER_JS = 'export default { fetch() { return new Response("ok"); } };';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  // @ts-expect-error global kintone shim — Plugin Config 画面では kintone.proxy を使う
  globalThis.kintone = { proxy: proxyMock };
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.kintone;
});

describe('deployWorker', () => {
  it('成功フロー: subdomain 取得 → script PUT → enable → URL 返却', async () => {
    proxyMock
      // 1. GET subdomain
      .mockResolvedValueOnce([
        JSON.stringify({ success: true, errors: [], result: { subdomain: 'myaccount' } }),
        200,
      ])
      // 2. PUT script
      .mockResolvedValueOnce([JSON.stringify({ success: true, errors: [], result: {} }), 200])
      // 3. POST enable subdomain
      .mockResolvedValueOnce([JSON.stringify({ success: true, errors: [], result: {} }), 200]);

    const result = await deployWorker({
      apiToken: API_TOKEN,
      accountId: ACCOUNT_ID,
      scriptName: SCRIPT_NAME,
      workerJsContent: WORKER_JS,
    });

    expect(result.workerUrl).toBe(`https://${SCRIPT_NAME}.myaccount.workers.dev`);
    expect(result.scriptName).toBe(SCRIPT_NAME);
    expect(result.accountSubdomain).toBe('myaccount');

    // kintone.proxy(url, method, headers, body) — pluginId なし
    // 1) subdomain GET
    expect(proxyMock.mock.calls[0]![0]).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/subdomain`,
    );
    expect(proxyMock.mock.calls[0]![1]).toBe('GET');
    expect((proxyMock.mock.calls[0]![2] as Record<string, string>)['Authorization']).toBe(
      `Bearer ${API_TOKEN}`,
    );

    // 2) script PUT - multipart
    const putCall = proxyMock.mock.calls[1]!;
    expect(putCall[0]).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`,
    );
    expect(putCall[1]).toBe('PUT');
    const putHeaders = putCall[2] as Record<string, string>;
    expect(putHeaders['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(putHeaders['Authorization']).toBe(`Bearer ${API_TOKEN}`);
    const putBody = putCall[3] as string;
    expect(putBody).toContain('"main_module":"worker.js"');
    expect(putBody).toContain('"compatibility_date":"2026-04-01"');
    expect(putBody).toContain(WORKER_JS);

    // 3) enable subdomain POST
    expect(proxyMock.mock.calls[2]![0]).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/subdomain`,
    );
    expect(proxyMock.mock.calls[2]![1]).toBe('POST');
    expect(proxyMock.mock.calls[2]![3]).toBe('{"enabled":true}');
  });

  it('subdomain 取得失敗 → CloudflareApiError', async () => {
    proxyMock.mockResolvedValueOnce([
      JSON.stringify({
        success: false,
        errors: [{ code: 10000, message: 'Authentication error' }],
      }),
      403,
    ]);

    await expect(
      deployWorker({
        apiToken: API_TOKEN,
        accountId: ACCOUNT_ID,
        scriptName: SCRIPT_NAME,
        workerJsContent: WORKER_JS,
      }),
    ).rejects.toBeInstanceOf(CloudflareApiError);
  });

  it('subdomain 未設定 (success=true 但し result.subdomain 空) → エラー', async () => {
    proxyMock.mockResolvedValueOnce([
      JSON.stringify({ success: true, errors: [], result: { subdomain: '' } }),
      200,
    ]);

    await expect(
      deployWorker({
        apiToken: API_TOKEN,
        accountId: ACCOUNT_ID,
        scriptName: SCRIPT_NAME,
        workerJsContent: WORKER_JS,
      }),
    ).rejects.toThrow(/サブドメイン/);
  });

  it('script アップロード失敗 → CloudflareApiError', async () => {
    proxyMock
      .mockResolvedValueOnce([
        JSON.stringify({ success: true, errors: [], result: { subdomain: 'myaccount' } }),
        200,
      ])
      .mockResolvedValueOnce([
        JSON.stringify({ success: false, errors: [{ code: 10013, message: 'Script syntax error' }] }),
        400,
      ]);

    await expect(
      deployWorker({
        apiToken: API_TOKEN,
        accountId: ACCOUNT_ID,
        scriptName: SCRIPT_NAME,
        workerJsContent: WORKER_JS,
      }),
    ).rejects.toBeInstanceOf(CloudflareApiError);
  });
});
