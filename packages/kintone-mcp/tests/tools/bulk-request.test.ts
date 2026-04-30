// kintone-bulk-request の統合テスト。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bulkRequest } from '../../src/tools/bulk-request';

import { TEST_CREDS as CREDS, jsonResponse } from './_helpers';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('kintone-bulk-request', () => {
  it('POST /k/v1/bulkRequest.json + body = {requests}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [{ id: '1', revision: '1' }] }));

    const requests = [
      {
        method: 'POST' as const,
        api: '/k/v1/record.json',
        payload: { app: '1', record: { title: { value: 'a' } } },
      },
    ];
    const result = await bulkRequest.callback({ requests }, { creds: CREDS });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/bulkRequest.json');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ requests });
    expect(result.structuredContent).toEqual({ results: [{ id: '1', revision: '1' }] });
  });

  it('複数 method を 1 リクエストで送る', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [{ id: '1', revision: '1' }, { revision: '2' }, {}] }),
    );

    const requests = [
      { method: 'POST' as const, api: '/k/v1/record.json', payload: { app: '1', record: {} } },
      {
        method: 'PUT' as const,
        api: '/k/v1/record.json',
        payload: { app: '1', id: '5', record: {} },
      },
      {
        method: 'DELETE' as const,
        api: '/k/v1/records.json',
        payload: { app: '1', ids: ['10'] },
      },
    ];

    await bulkRequest.callback({ requests }, { creds: CREDS });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.requests).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('20 件超は client side で例外', async () => {
    const requests = Array.from({ length: 21 }, () => ({
      method: 'POST' as const,
      api: '/k/v1/record.json',
      payload: { app: '1', record: {} },
    }));

    await expect(bulkRequest.callback({ requests }, { creds: CREDS })).rejects.toThrow(/max 20/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('空配列は例外', async () => {
    await expect(bulkRequest.callback({ requests: [] }, { creds: CREDS })).rejects.toThrow(
      /non-empty/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('kintone エラー時は KintoneApiError として伝播', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'CB_VA01', message: 'validation' }), { status: 520 }),
    );

    const requests = [
      {
        method: 'POST' as const,
        api: '/k/v1/record.json',
        payload: { app: '1', record: {} },
      },
    ];

    await expect(bulkRequest.callback({ requests }, { creds: CREDS })).rejects.toThrow(
      /520.*CB_VA01/,
    );
  });
});
