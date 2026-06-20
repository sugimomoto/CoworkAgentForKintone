// /notify/<domain>/<notifyKey> ハンドラのテスト (#13)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleNotify } from '../src/notify';

const SLACK = 'https://hooks.slack.com/services/T0/B0/SECRETPART';
const URL_PATH = 'https://example.com/notify/tenant.cybozu.com/business';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function notifyReq(body: unknown, opts: { bearer?: string | null; url?: string } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.bearer) headers['Authorization'] = `Bearer ${opts.bearer}`;
  return new Request(opts.url ?? URL_PATH, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
const callBody = (args: unknown) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'send_notification', arguments: args },
});

describe('handleNotify', () => {
  it('パス形式違反は 404', async () => {
    const res = await handleNotify(notifyReq({}, { url: 'https://example.com/notify/bad' }));
    expect(res.status).toBe(404);
  });

  it('initialize → serverInfo', async () => {
    const res = await handleNotify(notifyReq({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { bearer: SLACK }));
    const j = (await res.json()) as { result: { serverInfo: { name: string } } };
    expect(j.result.serverInfo.name).toContain('notify');
  });

  it('tools/list → send_notification', async () => {
    const res = await handleNotify(notifyReq({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { bearer: SLACK }));
    const j = (await res.json()) as { result: { tools: Array<{ name: string }> } };
    expect(j.result.tools.map((t) => t.name)).toEqual(['send_notification']);
  });

  it('Bearer(=Webhook URL) ありで Slack へ POST → 成功', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await handleNotify(notifyReq(callBody({ title: 't', text: 'x' }), { bearer: SLACK }));
    const j = (await res.json()) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    expect(j.result.isError).toBeFalsy();
    expect(j.result.content[0]!.text).toContain('Slack');
    // 実際に webhook URL へ POST した
    expect(fetchMock).toHaveBeenCalledWith(SLACK, expect.objectContaining({ method: 'POST' }));
  });

  it('Bearer 無し(未設定 Agent)は送信せず「未設定」を返す', async () => {
    const res = await handleNotify(notifyReq(callBody({ title: 't', text: 'x' })));
    const j = (await res.json()) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    expect(j.result.isError).toBe(true);
    expect(j.result.content[0]!.text).toContain('未設定');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Webhook が 4xx → 失敗 (URL は結果に含めない)', async () => {
    fetchMock.mockResolvedValue(new Response('no_service', { status: 404 }));
    const res = await handleNotify(notifyReq(callBody({ title: 't', text: 'x' }), { bearer: SLACK }));
    const j = (await res.json()) as { result: { isError?: boolean; content: Array<{ text: string }> } };
    expect(j.result.isError).toBe(true);
    expect(JSON.stringify(j.result)).not.toContain('SECRETPART'); // URL 非露出
  });
});
