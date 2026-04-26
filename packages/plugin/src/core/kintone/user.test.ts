import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  KintoneNotAvailableError,
  getCurrentSessionContext,
  getKintoneDomain,
  getKintoneUserCode,
} from './user';

function makeKintoneStub(overrides: Partial<KintoneLoginUser> = {}): KintoneGlobal {
  const user: KintoneLoginUser = {
    id: '100',
    code: 'sato',
    name: '佐藤 太郎',
    email: 'sato@example.com',
    url: '',
    employeeNumber: '',
    phone: '',
    mobilePhone: '',
    extensionNumber: '',
    timezone: 'Asia/Tokyo',
    language: 'ja',
    isGuest: false,
    type: 'user',
    ...overrides,
  };
  return {
    getLoginUser: () => user,
    app: { getId: () => 42 },
    events: { on: () => {} },
    plugin: {
      app: {
        getConfig: () => ({}),
        setConfig: () => {},
        proxy: (() => Promise.resolve(['', 200, {}])) as unknown as KintonePluginAppProxy,
        setProxyConfig: () => {},
      },
    },
    api: () => Promise.resolve({}),
    proxy: () => Promise.resolve(['', 200, {}] as [string, number, Record<string, string>]),
  };
}

beforeEach(() => {
  vi.stubGlobal('kintone', makeKintoneStub());
  vi.stubGlobal('location', { hostname: 'example.cybozu.com' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getKintoneUserCode', () => {
  it('kintone.getLoginUser().code を返す', () => {
    expect(getKintoneUserCode()).toBe('sato');
  });

  it('kintone が undefined のとき KintoneNotAvailableError を throw する', () => {
    vi.stubGlobal('kintone', undefined);
    expect(() => getKintoneUserCode()).toThrow(KintoneNotAvailableError);
  });
});

describe('getKintoneDomain', () => {
  it('location.hostname を返す', () => {
    expect(getKintoneDomain()).toBe('example.cybozu.com');
  });

  it('カスタムドメインも素直に返す', () => {
    vi.stubGlobal('location', { hostname: 'kintone.example.com' });
    expect(getKintoneDomain()).toBe('kintone.example.com');
  });
});

describe('getCurrentSessionContext', () => {
  it('userCode と domain をまとめて返す', () => {
    const ctx = getCurrentSessionContext();
    expect(ctx).toEqual({
      kintoneUserCode: 'sato',
      kintoneDomain: 'example.cybozu.com',
    });
  });
});
