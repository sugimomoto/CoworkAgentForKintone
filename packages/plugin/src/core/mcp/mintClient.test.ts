import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mintKintoneJwt } from './mintClient';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  (globalThis as unknown as { kintone: unknown }).kintone = {
    plugin: { app: { proxy: proxyMock } },
  };
});

afterEach(() => {
  delete (globalThis as { kintone?: unknown }).kintone;
});

describe('mintKintoneJwt — Basic 認証', () => {
  it('Worker URL に末尾スラッシュがあっても /mint が 1 つだけ付く', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ jwt: 'xxx.yyy.zzz' }), 200]);

    await mintKintoneJwt('plugin_abc', {
      workerUrl: 'https://w.example.com/',
      kintone_domain: 'tenant.cybozu.com',
      kintone_login: 'sato',
      kintone_password: 'p',
    });

    expect(proxyMock).toHaveBeenCalledWith(
      'plugin_abc',
      'https://w.example.com/mint',
      'POST',
      {},
      expect.any(String),
    );
  });

  it('body に kintone_domain / login / password が含まれる', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ jwt: 'a.b.c' }), 200]);

    await mintKintoneJwt('plugin_abc', {
      workerUrl: 'https://w.example.com',
      kintone_domain: 'tenant.cybozu.com',
      kintone_login: 'sato',
      kintone_password: 'p4ss',
    });

    const body = JSON.parse(proxyMock.mock.calls[0]![4] as string);
    expect(body).toEqual({
      kintone_domain: 'tenant.cybozu.com',
      kintone_login: 'sato',
      kintone_password: 'p4ss',
    });
  });

  it('レスポンスから jwt を抽出して返す', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ jwt: 'expected-jwt' }), 200]);

    const jwt = await mintKintoneJwt('plugin_abc', {
      workerUrl: 'https://w.example.com',
      kintone_domain: 'x',
      kintone_login: 'y',
      kintone_password: 'z',
    });

    expect(jwt).toBe('expected-jwt');
  });
});

describe('mintKintoneJwt — API トークン認証', () => {
  it('body に kintone_api_token が含まれる (login/password は無し)', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ jwt: 'x' }), 200]);

    await mintKintoneJwt('plugin_abc', {
      workerUrl: 'https://w.example.com',
      kintone_domain: 'tenant.cybozu.com',
      kintone_api_token: 'tok-xxx',
    });

    const body = JSON.parse(proxyMock.mock.calls[0]![4] as string);
    expect(body).toEqual({
      kintone_domain: 'tenant.cybozu.com',
      kintone_api_token: 'tok-xxx',
    });
  });
});

describe('mintKintoneJwt — エラー処理', () => {
  it('non-2xx で例外', async () => {
    proxyMock.mockResolvedValue(['{"error":"unauthorized"}', 401]);

    await expect(
      mintKintoneJwt('plugin_abc', {
        workerUrl: 'https://w.example.com',
        kintone_domain: 'x',
        kintone_login: 'y',
        kintone_password: 'z',
      }),
    ).rejects.toThrow(/401/);
  });

  it('JSON でないレスポンスで例外', async () => {
    proxyMock.mockResolvedValue(['not json', 200]);

    await expect(
      mintKintoneJwt('plugin_abc', {
        workerUrl: 'https://w.example.com',
        kintone_domain: 'x',
        kintone_login: 'y',
        kintone_password: 'z',
      }),
    ).rejects.toThrow(/non-JSON/);
  });

  it('jwt フィールド欠落で例外', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ other: 'value' }), 200]);

    await expect(
      mintKintoneJwt('plugin_abc', {
        workerUrl: 'https://w.example.com',
        kintone_domain: 'x',
        kintone_login: 'y',
        kintone_password: 'z',
      }),
    ).rejects.toThrow(/jwt missing|invalid shape/);
  });

  it('kintone runtime 不在で例外', async () => {
    delete (globalThis as { kintone?: unknown }).kintone;

    await expect(
      mintKintoneJwt('plugin_abc', {
        workerUrl: 'https://w.example.com',
        kintone_domain: 'x',
        kintone_login: 'y',
        kintone_password: 'z',
      }),
    ).rejects.toThrow(/kintone JavaScript API/);
  });
});
