import { describe, expect, it } from 'vitest';

import { verifyJwt } from '../src/jwt';
import { handleMint } from '../src/mint';

const ENV = {
  JWT_HMAC_SECRET: 'jwt-secret-32-bytes-or-more-please',
  MINT_API_KEY: 'mint-api-key-32-bytes-or-more-yes',
};

function mintRequest(body: unknown, init?: RequestInit): Request {
  return new Request('https://worker.example.com/mint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
    ...init,
  });
}

describe('handleMint — auth', () => {
  it('Authorization header が無いと 401', async () => {
    const req = mintRequest({ kintone_domain: 'x.cybozu.com', kintone_login: 'a', kintone_password: 'p' });
    const res = await handleMint(req, ENV);
    expect(res.status).toBe(401);
  });

  it('Bearer が間違っていると 401', async () => {
    const req = mintRequest(
      { kintone_domain: 'x.cybozu.com', kintone_login: 'a', kintone_password: 'p' },
      { headers: { Authorization: 'Bearer wrong-key' } },
    );
    const res = await handleMint(req, ENV);
    expect(res.status).toBe(401);
  });

  it('正しい Bearer で 200 + JWT 返却', async () => {
    const req = mintRequest(
      { kintone_domain: 'x.cybozu.com', kintone_login: 'a', kintone_password: 'p' },
      { headers: { Authorization: `Bearer ${ENV.MINT_API_KEY}` } },
    );
    const res = await handleMint(req, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jwt: string };
    expect(body.jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

describe('handleMint — body validation', () => {
  it('必須フィールドが欠けると 400', async () => {
    const req = mintRequest(
      { kintone_domain: 'x.cybozu.com' /* login/password missing */ },
      { headers: { Authorization: `Bearer ${ENV.MINT_API_KEY}` } },
    );
    const res = await handleMint(req, ENV);
    expect(res.status).toBe(400);
  });

  it('JSON body が不正だと 400', async () => {
    const req = new Request('https://worker.example.com/mint', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ENV.MINT_API_KEY}`, 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await handleMint(req, ENV);
    expect(res.status).toBe(400);
  });

  it('API token 認証パターンも受け付ける (login/password の代わりに kintone_api_token)', async () => {
    const req = mintRequest(
      { kintone_domain: 'x.cybozu.com', kintone_api_token: 'tok' },
      { headers: { Authorization: `Bearer ${ENV.MINT_API_KEY}` } },
    );
    const res = await handleMint(req, ENV);
    expect(res.status).toBe(200);
  });
});

describe('handleMint — JWT 内容', () => {
  it('payload に kintone creds と exp が含まれる', async () => {
    const req = mintRequest(
      { kintone_domain: 'x.cybozu.com', kintone_login: 'sato', kintone_password: 'p' },
      { headers: { Authorization: `Bearer ${ENV.MINT_API_KEY}` } },
    );
    const res = await handleMint(req, ENV);
    const { jwt } = (await res.json()) as { jwt: string };
    const payload = await verifyJwt<Record<string, unknown>>(jwt, ENV.JWT_HMAC_SECRET);

    expect(payload['kintone']).toMatchObject({
      domain: 'x.cybozu.com',
      auth_type: 'basic',
      login: 'sato',
      password: 'p',
    });
    expect(typeof payload['exp']).toBe('number');
    expect((payload['exp'] as number) > Math.floor(Date.now() / 1000)).toBe(true);
    // exp は 90 日 (= ~ 7,776,000 秒) 後
    const expectedExp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
    expect(Math.abs((payload['exp'] as number) - expectedExp)).toBeLessThan(60); // 1 分以内の誤差
  });

  it('API token 指定時は payload.kintone.auth_type=api_token', async () => {
    const req = mintRequest(
      { kintone_domain: 'x.cybozu.com', kintone_api_token: 'tok' },
      { headers: { Authorization: `Bearer ${ENV.MINT_API_KEY}` } },
    );
    const res = await handleMint(req, ENV);
    const { jwt } = (await res.json()) as { jwt: string };
    const payload = await verifyJwt<{ kintone: { auth_type: string; api_token: string } }>(
      jwt,
      ENV.JWT_HMAC_SECRET,
    );
    expect(payload.kintone.auth_type).toBe('api_token');
    expect(payload.kintone.api_token).toBe('tok');
  });
});
