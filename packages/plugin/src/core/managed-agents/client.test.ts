import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ApiError, apiHeaders, apiRequest, resetTransport, setTransport } from './client';

describe('apiHeaders', () => {
  it('GET リクエストでは anthropic-version + anthropic-beta が必須、Content-Type は付かない', () => {
    const headers = apiHeaders('GET');

    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('POST リクエストでは Content-Type: application/json が追加される', () => {
    const headers = apiHeaders('POST');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01');
  });

  it('追加ヘッダをマージできる', () => {
    const headers = apiHeaders('GET', { 'X-Test': 'value' });

    expect(headers['X-Test']).toBe('value');
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01');
  });

  it('追加ヘッダで必須ヘッダを上書きしない (必須が優先)', () => {
    const headers = apiHeaders('GET', { 'anthropic-version': 'BAD' });

    expect(headers['anthropic-version']).toBe('2023-06-01');
  });
});

describe('apiRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET リクエストで JSON を返す', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'agent_1', type: 'agent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await apiRequest('GET', '/v1/agents/agent_1');

    expect(result).toEqual({ id: 'agent_1', type: 'agent' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/agents/agent_1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'managed-agents-2026-04-01',
        }),
      }),
    );
  });

  it('POST リクエストで body を JSON 文字列にして送る', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 201 }),
    );

    await apiRequest('POST', '/v1/sessions', { agent: 'agent_1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/sessions');
    expect((init as RequestInit).body).toBe(JSON.stringify({ agent: 'agent_1' }));
  });

  it('4xx エラーレスポンスで ApiError を throw する', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'invalid', type: 'invalid_request_error' } }), {
        status: 400,
      }),
    );

    await expect(apiRequest('GET', '/v1/agents')).rejects.toBeInstanceOf(ApiError);
  });

  it('ApiError は status と message を保持する', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'forbidden' } }), { status: 403 }),
    );

    try {
      await apiRequest('GET', '/v1/agents');
      throw new Error('should not reach');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(403);
      expect(err.message).toContain('forbidden');
      expect(err.message).toContain('403'); // HTTP ステータスを含む
    }
  });

  it('error.type を含む Anthropic エラーは "type: message" 形式で表示する', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { type: 'authentication_error', message: 'Authentication failed' },
        }),
        { status: 401 },
      ),
    );

    try {
      await apiRequest('GET', '/v1/agents');
      throw new Error('should not reach');
    } catch (e) {
      const err = e as ApiError;
      expect(err.message).toBe('[HTTP 401] authentication_error: Authentication failed');
    }
  });

  it('204 No Content (body 空) は null を返す', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiRequest('DELETE', '/v1/sessions/sess_1');

    expect(result).toBeNull();
  });

  it('x-api-key は JS 側で付与しない (kintone proxy が固定ヘッダとして注入する)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await apiRequest('GET', '/v1/agents');

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('setTransport でカスタム transport に差し替えできる', async () => {
    const customTransport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ via: 'custom' }), { status: 200 }),
    );
    setTransport(customTransport);

    const result = await apiRequest('GET', '/v1/agents');

    expect(result).toEqual({ via: 'custom' });
    expect(customTransport).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    resetTransport();
  });

  it('resetTransport で fetch ベースの既定実装に戻る', async () => {
    setTransport(vi.fn().mockRejectedValue(new Error('should not be called')));
    resetTransport();

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await apiRequest('GET', '/v1/agents');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
