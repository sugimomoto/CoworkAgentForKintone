// Worker /anthropic/<path> 汎用 passthrough のテスト (Issue #31)。
//
// 検証内容:
// - X-Anthropic-Api-Key 無し → 401
// - GET /anthropic/v1/agents → upstream に X-Api-Key 付加して fetch
// - POST /anthropic/v1/agents → body 転送、Content-Type 維持
// - query string 維持
// - /v1/files/<id>/content (binary DL) は 415 で別ルート誘導
// - upstream エラーがそのまま返る

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAnthropicPassthrough } from '../src/anthropic-passthrough';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeRequest(
  url: string,
  init: RequestInit & { anthropicApiKey?: string | null } = {},
): Request {
  const headers = new Headers(init.headers);
  if (init.anthropicApiKey !== null) {
    headers.set('X-Anthropic-Api-Key', init.anthropicApiKey ?? 'sk-ant-test');
  }
  return new Request(url, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body !== undefined ? { body: init.body } : {}),
  });
}

describe('handleAnthropicPassthrough', () => {
  it('X-Anthropic-Api-Key 無しは 401', async () => {
    const req = makeRequest('https://worker.example.com/anthropic/v1/agents', {
      anthropicApiKey: null,
    });
    const res = await handleAnthropicPassthrough(req, '/v1/agents');
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('missing_anthropic_api_key');
  });

  it('GET /anthropic/v1/agents → Anthropic に X-Api-Key 付加して fetch する', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = makeRequest('https://worker.example.com/anthropic/v1/agents', {
      method: 'GET',
      headers: { 'anthropic-version': '2023-06-01', 'anthropic-beta': 'managed-agents-2026-04-01' },
    });
    const res = await handleAnthropicPassthrough(req, '/v1/agents');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/agents');
    const fwdHeaders = (init as RequestInit).headers as Headers;
    expect(fwdHeaders.get('X-Api-Key')).toBe('sk-ant-test');
    expect(fwdHeaders.get('anthropic-version')).toBe('2023-06-01');
    expect(fwdHeaders.get('anthropic-beta')).toBe('managed-agents-2026-04-01');
  });

  it('POST /anthropic/v1/agents → body と Content-Type を転送', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'agent_x' }), { status: 201 }),
    );

    const req = makeRequest('https://worker.example.com/anthropic/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });
    await handleAnthropicPassthrough(req, '/v1/agents');

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'test' }));
    const fwdHeaders = init.headers as Headers;
    expect(fwdHeaders.get('Content-Type')).toBe('application/json');
  });

  it('query string が維持される', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const req = makeRequest(
      'https://worker.example.com/anthropic/v1/files?scope_id=sesn_abc',
      { method: 'GET' },
    );
    await handleAnthropicPassthrough(req, '/v1/files');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/files?scope_id=sesn_abc');
  });

  it('/v1/files/<id>/content (binary) は 415 で別ルートに誘導する', async () => {
    const req = makeRequest(
      'https://worker.example.com/anthropic/v1/files/file_xyz/content',
      { method: 'GET' },
    );
    const res = await handleAnthropicPassthrough(req, '/v1/files/file_xyz/content');
    expect(res.status).toBe(415);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('use_files_endpoint');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upstream エラー (4xx/5xx) はそのまま返す', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'invalid' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const req = makeRequest('https://worker.example.com/anthropic/v1/agents', {
      method: 'POST',
      body: '{}',
    });
    const res = await handleAnthropicPassthrough(req, '/v1/agents');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toBe('invalid');
  });

  it('host 系 / 認証系のヘッダは upstream へ転送しない (whitelisted のみ)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const req = makeRequest('https://worker.example.com/anthropic/v1/agents', {
      method: 'GET',
      headers: {
        Cookie: 'sensitive=value',
        Host: 'worker.example.com',
        Authorization: 'Bearer leaked-token',
      },
    });
    await handleAnthropicPassthrough(req, '/v1/agents');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const fwdHeaders = init.headers as Headers;
    expect(fwdHeaders.get('Cookie')).toBeNull();
    expect(fwdHeaders.get('Authorization')).toBeNull();
    expect(fwdHeaders.get('X-Api-Key')).toBe('sk-ant-test'); // 自前で付加した分は通す
  });
});
