// アプリ管理系 18 ツール (Phase C, #24) のテスト。
// path / method / body / preview 切替 / バリデーション / エラー伝播を検証。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppAcl, getAppPlugins, updateAppAcl, updateAppPlugins } from '../../src/tools/management-acl';
import { createApp, getProcessManagement, updateProcessManagement } from '../../src/tools/management-app';
import {
  deployApp,
  getAppDeployStatus,
  getCustomize,
  updateCustomize,
} from '../../src/tools/management-customize';
import {
  addFormFields,
  deleteFormFields,
  getFormLayout,
  getViews,
  updateFormFields,
  updateFormLayout,
  updateViews,
} from '../../src/tools/management-form';

import { TEST_CREDS as CREDS, jsonResponse } from './_helpers';

const BASE = 'https://tenant.cybozu.com';
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  // 1 テスト内で複数回 fetch する場合に備え、呼び出しごとに新しい Response を返す
  // (Response の body は 1 度しか読めないため、同一インスタンスを使い回すと 2 回目が失敗する)。
  fetchMock = vi.fn(async () => jsonResponse({ revision: '2' }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const call = (n = 0) => fetchMock.mock.calls[n]!;
const sentUrl = (n = 0) => String(call(n)[0]);
const sentMethod = (n = 0) => call(n)[1].method as string;
const sentBody = (n = 0) => JSON.parse((call(n)[1].body as string) ?? '{}');

describe('customize / deploy', () => {
  it('get-customize: GET live customize.json (preview 既定 false)', async () => {
    await getCustomize.callback({ app: '5' }, { creds: CREDS });
    expect(sentUrl()).toBe(`${BASE}/k/v1/app/customize.json?app=5`);
    expect(sentMethod()).toBe('GET');
  });
  it('get-customize: preview=true で preview パス', async () => {
    await getCustomize.callback({ app: '5', preview: true }, { creds: CREDS });
    expect(sentUrl()).toBe(`${BASE}/k/v1/preview/app/customize.json?app=5`);
  });
  it('update-customize: PUT preview + body', async () => {
    await updateCustomize.callback(
      { app: '5', desktop: { js: [{ type: 'URL', url: 'https://x/a.js' }] } },
      { creds: CREDS },
    );
    expect(sentUrl()).toBe(`${BASE}/k/v1/preview/app/customize.json`);
    expect(sentMethod()).toBe('PUT');
    expect(sentBody()).toEqual({ app: '5', desktop: { js: [{ type: 'URL', url: 'https://x/a.js' }] } });
  });
  it('deploy-app: POST deploy.json + apps/revert', async () => {
    await deployApp.callback({ apps: [{ app: '5' }], revert: false }, { creds: CREDS });
    expect(sentUrl()).toBe(`${BASE}/k/v1/preview/app/deploy.json`);
    expect(sentMethod()).toBe('POST');
    expect(sentBody()).toEqual({ apps: [{ app: '5' }], revert: false });
  });
  it('deploy-app: 空 apps はエラー', async () => {
    await expect(deployApp.callback({ apps: [] }, { creds: CREDS })).rejects.toThrow(/non-empty/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('get-app-deploy-status: GET deploy.json + indexed apps クエリ', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ apps: [{ app: '5', status: 'SUCCESS' }] }));
    await getAppDeployStatus.callback({ apps: ['5', '6'] }, { creds: CREDS });
    expect(sentUrl()).toContain('/k/v1/preview/app/deploy.json');
    expect(sentUrl()).toContain('apps%5B0%5D=5');
    expect(sentUrl()).toContain('apps%5B1%5D=6');
  });
});

describe('form design', () => {
  it('get-views / update-views', async () => {
    await getViews.callback({ app: '5', preview: true }, { creds: CREDS });
    await updateViews.callback({ app: '5', views: { 一覧: { type: 'LIST' } } }, { creds: CREDS });
    expect(sentUrl(0)).toBe(`${BASE}/k/v1/preview/app/views.json?app=5`);
    expect(sentUrl(1)).toBe(`${BASE}/k/v1/preview/app/views.json`);
    expect(sentMethod(1)).toBe('PUT');
    expect(sentBody(1)).toEqual({ app: '5', views: { 一覧: { type: 'LIST' } } });
  });
  it('get-form-layout / update-form-layout', async () => {
    await getFormLayout.callback({ app: '5' }, { creds: CREDS });
    await updateFormLayout.callback({ app: '5', layout: [{ type: 'ROW' }] }, { creds: CREDS });
    expect(sentUrl(0)).toBe(`${BASE}/k/v1/app/form/layout.json?app=5`);
    expect(sentUrl(1)).toBe(`${BASE}/k/v1/preview/app/form/layout.json`);
    expect(sentBody(1).layout).toEqual([{ type: 'ROW' }]);
  });
  it('add/update/delete-form-fields の path/method', async () => {
    await addFormFields.callback({ app: '5', properties: { p: { type: 'NUMBER' } } }, { creds: CREDS });
    await updateFormFields.callback({ app: '5', properties: { p: { label: 'x' } } }, { creds: CREDS });
    await deleteFormFields.callback({ app: '5', fields: ['p'] }, { creds: CREDS });
    expect([sentUrl(0), sentMethod(0)]).toEqual([`${BASE}/k/v1/preview/app/form/fields.json`, 'POST']);
    expect(sentMethod(1)).toBe('PUT');
    expect([sentUrl(2), sentMethod(2)]).toEqual([`${BASE}/k/v1/preview/app/form/fields.json`, 'DELETE']);
    expect(sentBody(2)).toEqual({ app: '5', fields: ['p'] });
  });
  it('delete-form-fields: 空 fields はエラー', async () => {
    await expect(deleteFormFields.callback({ app: '5', fields: [] }, { creds: CREDS })).rejects.toThrow(
      /non-empty/,
    );
  });
});

describe('app / process', () => {
  it('create-app: POST preview/app.json', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ app: '99', revision: '1' }));
    const r = await createApp.callback({ name: '問い合わせ管理' }, { creds: CREDS });
    expect(sentUrl()).toBe(`${BASE}/k/v1/preview/app.json`);
    expect(sentMethod()).toBe('POST');
    expect(sentBody()).toEqual({ name: '問い合わせ管理' });
    expect(r.structuredContent).toEqual({ app: '99', revision: '1' });
  });
  it('create-app: name 必須', async () => {
    await expect(createApp.callback({} as never, { creds: CREDS })).rejects.toThrow(/name is required/);
  });
  it('get/update-process-management', async () => {
    await getProcessManagement.callback({ app: '5' }, { creds: CREDS });
    await updateProcessManagement.callback({ app: '5', enable: true }, { creds: CREDS });
    expect(sentUrl(0)).toBe(`${BASE}/k/v1/app/status.json?app=5`);
    expect(sentUrl(1)).toBe(`${BASE}/k/v1/preview/app/status.json`);
    expect(sentBody(1)).toEqual({ app: '5', enable: true });
  });
});

describe('acl / plugins', () => {
  it('get/update-app-acl', async () => {
    await getAppAcl.callback({ app: '5', preview: true }, { creds: CREDS });
    await updateAppAcl.callback(
      { app: '5', rights: [{ entity: { type: 'GROUP', code: 'sales' } }] },
      { creds: CREDS },
    );
    expect(sentUrl(0)).toBe(`${BASE}/k/v1/preview/app/acl.json?app=5`);
    expect(sentUrl(1)).toBe(`${BASE}/k/v1/preview/app/acl.json`);
    expect(sentMethod(1)).toBe('PUT');
  });
  it('get/update-app-plugins', async () => {
    await getAppPlugins.callback({ app: '5' }, { creds: CREDS });
    await updateAppPlugins.callback({ app: '5', ids: ['abc'] }, { creds: CREDS });
    expect(sentUrl(0)).toBe(`${BASE}/k/v1/app/plugins.json?app=5`);
    expect(sentBody(1)).toEqual({ app: '5', ids: ['abc'] });
  });
});

describe('共通', () => {
  it('app 必須チェック (get-views)', async () => {
    await expect(getViews.callback({ app: '' }, { creds: CREDS })).rejects.toThrow(/app is required/);
  });
  it('kintone エラーは伝播 (403)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'no permission', code: 'CB_NO02' }, 403));
    await expect(getAppAcl.callback({ app: '5' }, { creds: CREDS })).rejects.toThrow(/403/);
  });

  it('CB_VA01 の errors 詳細 (フィールド単位の理由) がエラー文言に含まれる', async () => {
    // 汎用 message だけでなく、kintone が返す errors (例: 予約語) を LLM に見せる
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: 'CB_VA01',
          message: '入力内容が正しくありません。',
          errors: { 'properties[ステータス]': { messages: ['予約語のため使用できません。'] } },
        },
        400,
      ),
    );
    await expect(
      addFormFields.callback({ app: '5', properties: { ステータス: { type: 'DROP_DOWN' } } }, { creds: CREDS }),
    ).rejects.toThrow(/予約語のため使用できません/);
  });
});
