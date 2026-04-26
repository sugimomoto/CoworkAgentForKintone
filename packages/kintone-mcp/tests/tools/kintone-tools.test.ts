// 4 ツール (get-apps / get-app / get-form-fields / get-records) の統合テスト。
// kintone REST 呼出の URL / params / レスポンス変換を検証。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getApp } from '../../src/tools/get-app';
import { getApps } from '../../src/tools/get-apps';
import { getFormFields } from '../../src/tools/get-form-fields';
import { getRecords } from '../../src/tools/get-records';

import type { KintoneCreds } from '../../src/kintone';

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('kintone-get-apps', () => {
  it('name / spaceIds などのパラメータが付与される', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ apps: [{ appId: '1', name: '顧客' }] }));

    const result = await getApps.callback(
      { name: '顧客', spaceIds: [10, 20], limit: 10 },
      { creds: CREDS },
    );

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/k/v1/apps.json');
    expect(url).toContain('name=');
    expect(url).toContain('spaceIds=10');
    expect(url).toContain('spaceIds=20');
    expect(url).toContain('limit=10');

    const structured = result.structuredContent as { apps: unknown[] };
    expect(structured.apps).toHaveLength(1);
  });

  it('引数なしでも limit=100/offset=0 がデフォルト適用される', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ apps: [] }));

    await getApps.callback({}, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('limit=100');
    expect(url).toContain('offset=0');
  });
});

describe('kintone-get-app', () => {
  it('id を渡して /k/v1/app.json を呼ぶ', async () => {
    const app = { appId: '42', name: 'Cowork Agent' };
    fetchMock.mockResolvedValue(jsonResponse(app));

    const result = await getApp.callback({ app: '42' }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/k/v1/app.json');
    expect(url).toContain('id=42');
    expect(result.structuredContent).toEqual(app);
  });

  it('404 で例外が伝播する', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'GAIA_AP01', message: 'app not found' }), {
        status: 404,
      }),
    );

    await expect(getApp.callback({ app: '99' }, { creds: CREDS })).rejects.toThrow(/404/);
  });
});

describe('kintone-get-form-fields', () => {
  it('app id を渡して /k/v1/app/form/fields.json を呼ぶ', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ properties: {}, revision: '5' }));

    await getFormFields.callback({ app: '42' }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/k/v1/app/form/fields.json');
    expect(url).toContain('app=42');
    expect(url).not.toContain('/preview/');
  });

  it('preview=true で /k/v1/preview/app/form/fields.json を呼ぶ', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ properties: {} }));

    await getFormFields.callback({ app: '42', preview: true }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/k/v1/preview/app/form/fields.json');
  });

  it('lang を指定すると query param に含まれる', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ properties: {} }));

    await getFormFields.callback({ app: '42', lang: 'ja' }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('lang=ja');
  });
});

describe('kintone-get-records', () => {
  it('基本: app id 指定 → /k/v1/records.json', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [] }));

    await getRecords.callback({ app: '42' }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/k/v1/records.json');
    expect(url).toContain('app=42');
    expect(url).not.toContain('query=');
  });

  it('filters → kintone query 文字列に組立 (M5 の build-query 利用)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [] }));

    await getRecords.callback(
      {
        app: '42',
        filters: { equals: [{ field: 'status', value: 'open' }] },
        orderBy: [{ field: 'created_time', order: 'desc' }],
        limit: 50,
      },
      { creds: CREDS },
    );

    const url = fetchMock.mock.calls[0]![0] as string;
    const qs = new URL(url).searchParams.get('query');
    expect(qs).toBe('status = "open" order by created_time desc limit 50');
  });

  it('total_count=true で query param に totalCount=true', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [], totalCount: '5' }));

    const result = await getRecords.callback({ app: '42', total_count: true }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('totalCount=true');

    const out = result.structuredContent as { totalCount: string | null };
    expect(out.totalCount).toBe('5');
  });

  it('total_count 未指定なら totalCount は null として返却', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [{ $id: { value: '1' } }] }));

    const result = await getRecords.callback({ app: '42' }, { creds: CREDS });
    const out = result.structuredContent as { totalCount: string | null };
    expect(out.totalCount).toBeNull();
  });

  it('fields を指定すると repeating param で送出', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [] }));

    await getRecords.callback({ app: '42', fields: ['title', 'owner'] }, { creds: CREDS });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('fields=title');
    expect(url).toContain('fields=owner');
  });
});
