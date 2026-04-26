import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { kintoneRequest } from '../src/kintone';

const CREDS_BASIC = {
  domain: 'tenant.cybozu.com',
  auth_type: 'basic' as const,
  login: 'sato',
  password: 'p4ss',
};

const CREDS_TOKEN = {
  domain: 'tenant.cybozu.com',
  auth_type: 'api_token' as const,
  api_token: 'abc123',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('kintoneRequest — Basic 認証', () => {
  it('GET 時に X-Cybozu-Authorization ヘッダを送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ apps: [] }));

    await kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/apps.json', { params: { limit: 10 } });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      'X-Cybozu-Authorization': btoa('sato:p4ss'),
    });
  });

  it('GET 時には Content-Type を付けない (kintone CB_IL02 回避)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/apps.json');

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('POST 時に Content-Type: application/json + JSON body を送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'cursor_x' }, 201));

    await kintoneRequest(CREDS_BASIC, 'POST', '/k/v1/records/cursor.json', {
      body: { app: 1, size: 500 },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
    });
    expect((init as RequestInit).body).toBe(JSON.stringify({ app: 1, size: 500 }));
  });
});

describe('kintoneRequest — API Token 認証', () => {
  it('X-Cybozu-API-Token ヘッダを送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [] }));

    await kintoneRequest(CREDS_TOKEN, 'GET', '/k/v1/records.json', { params: { app: 1 } });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      'X-Cybozu-API-Token': 'abc123',
    });
  });
});

describe('kintoneRequest — params のシリアライズ', () => {
  it('リスト値は key=v1&key=v2 形式 (kintone 互換)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/records.json', {
      params: { app: 1, fields: ['title', 'owner'] },
    });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('fields=title');
    expect(url).toContain('fields=owner');
  });

  it('null / undefined の値は送らない', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/records.json', {
      params: { app: 1, query: null, fields: undefined },
    });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).not.toContain('query=');
    expect(url).not.toContain('fields=');
  });
});

describe('kintoneRequest — エラー処理', () => {
  it('4xx で例外、kintone エラー body を含むメッセージ', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'GAIA_QU01', message: 'Invalid query', id: 'abc' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/records.json', { params: { app: 1, query: 'bad' } }),
    ).rejects.toThrow(/GAIA_QU01|Invalid query|400/);
  });

  it('5xx で例外', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 503 }));

    await expect(kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/records.json')).rejects.toThrow(/503/);
  });

  it('2xx の json レスポンスは dict として返す', async () => {
    const payload = { totalCount: '5', records: [{ $id: { value: '1' } }] };
    fetchMock.mockResolvedValue(jsonResponse(payload));

    const result = await kintoneRequest(CREDS_BASIC, 'GET', '/k/v1/records.json');

    expect(result).toEqual(payload);
  });
});
