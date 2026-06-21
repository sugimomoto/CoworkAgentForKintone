// プロセス管理 (ワークフロー) 系 3 ツールのテスト (#22)。
// URL / method / body の組立てと引数バリデーション・エラー伝播を検証。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updateRecordAssignees } from '../../src/tools/update-record-assignees';
import { updateRecordsStatuses } from '../../src/tools/update-records-statuses';
import { updateRecordStatus } from '../../src/tools/update-record-status';

import { TEST_CREDS as CREDS, jsonResponse } from './_helpers';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('kintone-update-record-status', () => {
  it('PUT /k/v1/record/status.json + body = {app, id, action}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '3' }));

    const result = await updateRecordStatus.callback(
      { app: '1', id: '12', action: '完了する' },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/record/status.json');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ app: '1', id: '12', action: '完了する' });
    expect(result.structuredContent).toEqual({ revision: '3' });
  });

  it('assignee / revision を渡すと body に含む', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '4' }));
    await updateRecordStatus.callback(
      { app: '1', id: '12', action: '対応開始', assignee: 'sato', revision: '3' },
      { creds: CREDS },
    );
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
      app: '1',
      id: '12',
      action: '対応開始',
      assignee: 'sato',
      revision: '3',
    });
  });

  it('action 欠落はバリデーションエラー', async () => {
    await expect(
      updateRecordStatus.callback({ app: '1', id: '12' } as never, { creds: CREDS }),
    ).rejects.toThrow(/action is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revision 競合 (409) は例外として伝播', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'conflict', code: 'GAIA_CO02' }, 409));
    await expect(
      updateRecordStatus.callback({ app: '1', id: '12', action: '完了' }, { creds: CREDS }),
    ).rejects.toThrow(/409/);
  });
});

describe('kintone-update-records-statuses', () => {
  it('PUT /k/v1/records/status.json + body = {app, records[]}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ records: [{ id: '1', revision: '2' }] }));

    await updateRecordsStatuses.callback(
      { app: '1', records: [{ id: '1', action: '完了する' }] },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/records/status.json');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      app: '1',
      records: [{ id: '1', action: '完了する' }],
    });
  });

  it('空 records はエラー', async () => {
    await expect(
      updateRecordsStatuses.callback({ app: '1', records: [] }, { creds: CREDS }),
    ).rejects.toThrow(/non-empty|must be/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('100 件超はエラー', async () => {
    const records = Array.from({ length: 101 }, (_, i) => ({ id: String(i), action: '完了' }));
    await expect(
      updateRecordsStatuses.callback({ app: '1', records }, { creds: CREDS }),
    ).rejects.toThrow(/max 100/);
  });

  it('entry の action 欠落はエラー', async () => {
    await expect(
      updateRecordsStatuses.callback(
        { app: '1', records: [{ id: '1' }] as never },
        { creds: CREDS },
      ),
    ).rejects.toThrow(/requires action/);
  });
});

describe('kintone-update-record-assignees', () => {
  it('PUT /k/v1/record/assignees.json + body = {app, id, assignees[]}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '5' }));

    const result = await updateRecordAssignees.callback(
      { app: '1', id: '12', assignees: ['sato', 'tanaka'] },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/record/assignees.json');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      app: '1',
      id: '12',
      assignees: ['sato', 'tanaka'],
    });
    expect(result.structuredContent).toEqual({ revision: '5' });
  });

  it('空配列 (全解除) も許容', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ revision: '6' }));
    await updateRecordAssignees.callback({ app: '1', id: '12', assignees: [] }, { creds: CREDS });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string).assignees).toEqual([]);
  });

  it('assignees が配列でないとエラー', async () => {
    await expect(
      updateRecordAssignees.callback({ app: '1', id: '12' } as never, { creds: CREDS }),
    ).rejects.toThrow(/assignees must be an array/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
