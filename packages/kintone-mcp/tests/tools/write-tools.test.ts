// 書き込み系 6 ツールの統合テスト。
// URL / method / body の組立てと、引数バリデーションを検証。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addRecord } from '../../src/tools/add-record';
import { addRecordComment } from '../../src/tools/add-record-comment';
import { addRecords } from '../../src/tools/add-records';
import { deleteRecords } from '../../src/tools/delete-records';
import { updateRecord } from '../../src/tools/update-record';
import { updateRecords } from '../../src/tools/update-records';

import { TEST_CREDS as CREDS, jsonResponse } from './_helpers';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('kintone-add-record', () => {
  it('POST /k/v1/record.json + body = {app, record}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '42', revision: '1' }));

    const result = await addRecord.callback(
      { app: '1', record: { title: { value: '新規' } } },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/record.json');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ app: '1', record: { title: { value: '新規' } } });
    expect(result.structuredContent).toEqual({ id: '42', revision: '1' });
  });

  it('4xx は例外', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'invalid' }, 400));
    await expect(
      addRecord.callback({ app: '1', record: {} }, { creds: CREDS }),
    ).rejects.toThrow(/400/);
  });
});

describe('kintone-add-records', () => {
  it('POST /k/v1/records.json + body = {app, records[]}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ids: ['1', '2'], revisions: ['1', '1'] }));

    await addRecords.callback(
      { app: '1', records: [{ title: { value: 'a' } }, { title: { value: 'b' } }] },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/records.json');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.records).toHaveLength(2);
  });

  it('100 件超は例外', async () => {
    const records = Array.from({ length: 101 }, () => ({ title: { value: 'x' } }));
    await expect(addRecords.callback({ app: '1', records }, { creds: CREDS })).rejects.toThrow(/max 100/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('kintone-update-record', () => {
  it('id 指定: PUT /k/v1/record.json + body = {app, id, record}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '5' }));

    await updateRecord.callback(
      { app: '1', id: '42', record: { status: { value: '完了' } } },
      { creds: CREDS },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ app: '1', id: '42', record: { status: { value: '完了' } } });
  });

  it('updateKey 指定: body に updateKey が入る', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '5' }));

    await updateRecord.callback(
      {
        app: '1',
        updateKey: { field: 'code', value: 'C-001' },
        record: { status: { value: '完了' } },
      },
      { creds: CREDS },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.updateKey).toEqual({ field: 'code', value: 'C-001' });
    expect(body.id).toBeUndefined();
  });

  it('revision 指定で楽観ロック', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '6' }));

    await updateRecord.callback(
      { app: '1', id: '42', record: { x: { value: 'y' } }, revision: '5' },
      { creds: CREDS },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.revision).toBe('5');
  });

  it('id と updateKey 両方指定は例外', async () => {
    await expect(
      updateRecord.callback(
        {
          app: '1',
          id: '42',
          updateKey: { field: 'code', value: 'x' },
          record: {},
        },
        { creds: CREDS },
      ),
    ).rejects.toThrow(/exclusive/);
  });

  it('id も updateKey も無いと例外', async () => {
    await expect(
      updateRecord.callback({ app: '1', record: {} }, { creds: CREDS }),
    ).rejects.toThrow(/required/);
  });
});

describe('kintone-update-records', () => {
  it('PUT /k/v1/records.json', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [{ id: '1', revision: '2' }] }));

    await updateRecords.callback(
      {
        app: '1',
        records: [{ id: '1', record: { x: { value: 'y' } } }],
      },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/records.json');
    expect(init.method).toBe('PUT');
  });

  it('id も updateKey も無いエントリがあれば例外', async () => {
    await expect(
      updateRecords.callback(
        {
          app: '1',
          records: [{ record: {} }],
        },
        { creds: CREDS },
      ),
    ).rejects.toThrow(/id or updateKey/);
  });

  it('100 件超は例外', async () => {
    const records = Array.from({ length: 101 }, (_, i) => ({
      id: String(i),
      record: { x: { value: 'y' } },
    }));
    await expect(updateRecords.callback({ app: '1', records }, { creds: CREDS })).rejects.toThrow(
      /max 100/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('id と updateKey 両方指定のエントリがあれば例外', async () => {
    await expect(
      updateRecords.callback(
        {
          app: '1',
          records: [
            {
              id: '1',
              updateKey: { field: 'code', value: 'ABC' },
              record: { x: { value: 'y' } },
            },
          ],
        },
        { creds: CREDS },
      ),
    ).rejects.toThrow(/exclusive/);
  });
});

describe('kintone-delete-records', () => {
  it('DELETE /k/v1/records.json + body = {app, ids}', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await deleteRecords.callback(
      { app: '1', ids: ['10', '20', '30'] },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/records.json');
    expect(init.method).toBe('DELETE');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ app: '1', ids: ['10', '20', '30'] });
    expect(result.structuredContent).toEqual({ deleted: 3 });
  });

  it('revisions 指定で楽観ロック', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteRecords.callback(
      { app: '1', ids: ['10', '20'], revisions: ['5', '3'] },
      { creds: CREDS },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.revisions).toEqual(['5', '3']);
  });

  it('ids 空は例外', async () => {
    await expect(deleteRecords.callback({ app: '1', ids: [] }, { creds: CREDS })).rejects.toThrow(
      /non-empty/,
    );
  });

  it('100 件超は例外', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i));
    await expect(deleteRecords.callback({ app: '1', ids }, { creds: CREDS })).rejects.toThrow(
      /max 100/,
    );
  });

  it('revisions 長さ不一致は例外', async () => {
    await expect(
      deleteRecords.callback({ app: '1', ids: ['1', '2'], revisions: ['5'] }, { creds: CREDS }),
    ).rejects.toThrow(/length/);
  });
});

describe('kintone-add-record-comment', () => {
  it('POST /k/v1/record/comment.json + body = {app, record, comment}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '99' }));

    const result = await addRecordComment.callback(
      {
        app: '1',
        record: '42',
        comment: { text: '確認しました' },
      },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/record/comment.json');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      app: '1',
      record: '42',
      comment: { text: '確認しました' },
    });
    expect(result.structuredContent).toEqual({ id: '99' });
  });

  it('mentions 付き', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: '100' }));

    await addRecordComment.callback(
      {
        app: '1',
        record: '42',
        comment: {
          text: '@sato 確認お願いします',
          mentions: [{ code: 'sato', type: 'USER' }],
        },
      },
      { creds: CREDS },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.comment.mentions).toEqual([{ code: 'sato', type: 'USER' }]);
  });
});
