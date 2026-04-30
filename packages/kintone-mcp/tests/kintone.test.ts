// kintone REST API ヘルパのテスト。OAuth Bearer 専用。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KintoneApiError, kintoneRequest, type KintoneCreds } from '../src/kintone';

const CREDS: KintoneCreds = {
  domain: 'tenant.cybozu.com',
  bearer: 'oauth-access-token',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('kintoneRequest', () => {
  it('GET 時は Authorization Bearer + User-Agent を付け、Content-Type は付けない', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }));

    await kintoneRequest(CREDS, 'GET', '/k/v1/apps.json');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://tenant.cybozu.com/k/v1/apps.json');
    expect(init.method).toBe('GET');
    const h = init.headers as Record<string, string>;
    expect(h['Authorization']).toBe('Bearer oauth-access-token');
    expect(h['User-Agent']).toContain('cowork-agent-kintone-mcp');
    expect(h['Content-Type']).toBeUndefined();
  });

  it('body 有りなら Content-Type: application/json と JSON body を付ける', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await kintoneRequest(CREDS, 'POST', '/k/v1/record.json', {
      body: { app: 1, record: { foo: { value: 'bar' } } },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const h = init.headers as Record<string, string>;
    expect(h['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string).app).toBe(1);
  });

  it('params: スカラー / 配列 / null を正しく URL に展開', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ apps: [] }), { status: 200 }));

    await kintoneRequest(CREDS, 'GET', '/k/v1/apps.json', {
      params: {
        limit: 10,
        ids: ['1', '2'],
        name: null,
        offset: undefined,
      },
    });

    const [url] = fetchMock.mock.calls[0]!;
    const u = new URL(url as string);
    expect(u.searchParams.get('limit')).toBe('10');
    expect(u.searchParams.getAll('ids')).toEqual(['1', '2']);
    expect(u.searchParams.has('name')).toBe(false);
    expect(u.searchParams.has('offset')).toBe(false);
  });

  it('204 No Content は空オブジェクトを返す', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await kintoneRequest(CREDS, 'PUT', '/k/v1/record.json', { body: {} });
    expect(result).toEqual({});
  });

  it('非 2xx は KintoneApiError を投げ、status / code / message を含む', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"code":"GAIA_DA02","message":"app not found","id":"req-1"}', {
        status: 404,
      }),
    );

    await expect(kintoneRequest(CREDS, 'GET', '/k/v1/app.json')).rejects.toThrow(
      /404.*app not found/,
    );

    fetchMock.mockResolvedValue(
      new Response('{"code":"GAIA_DA02","message":"app not found","id":"req-1"}', {
        status: 404,
      }),
    );

    try {
      await kintoneRequest(CREDS, 'GET', '/k/v1/app.json');
      expect.fail('should throw');
    } catch (e) {
      const err = e as KintoneApiError;
      expect(err).toBeInstanceOf(KintoneApiError);
      expect(err.status).toBe(404);
      expect(err.code).toBe('GAIA_DA02');
      expect(err.errorId).toBe('req-1');
      expect(err.retryable).toBe(false);
    }
  });

  it('5xx は retryable=true', async () => {
    fetchMock.mockResolvedValue(new Response('upstream', { status: 503 }));

    try {
      await kintoneRequest(CREDS, 'GET', '/k/v1/app.json');
      expect.fail('should throw');
    } catch (e) {
      const err = e as KintoneApiError;
      expect(err).toBeInstanceOf(KintoneApiError);
      expect(err.status).toBe(503);
      expect(err.retryable).toBe(true);
      expect(err.code).toBeUndefined();
    }
  });
});
