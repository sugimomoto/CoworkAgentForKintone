import { describe, expect, it } from 'vitest';

import { signJwt, verifyJwt } from '../src/jwt';

const SECRET = 'test-secret-32-bytes-or-more-yes-yes';

describe('signJwt', () => {
  it('JWT 形式 (3 ドット区切り) を返す', async () => {
    const jwt = await signJwt({ sub: 'test', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
  });

  it('header は alg: HS256, typ: JWT を含む', async () => {
    const jwt = await signJwt({ sub: 'x' }, SECRET);
    const headerB64 = jwt.split('.')[0]!;
    const padded = headerB64 + '='.repeat((4 - (headerB64.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('別の secret では verify が失敗する', async () => {
    const jwt = await signJwt({ sub: 'x' }, SECRET);
    await expect(verifyJwt(jwt, 'different-secret')).rejects.toThrow(/signature/i);
  });
});

describe('verifyJwt', () => {
  it('正しい secret で payload が取り出せる', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = await signJwt({ sub: 'test', kintone: { domain: 'x.cybozu.com' }, exp }, SECRET);
    const payload = await verifyJwt<{ sub: string; kintone: { domain: string }; exp: number }>(
      jwt,
      SECRET,
    );
    expect(payload.sub).toBe('test');
    expect(payload.kintone.domain).toBe('x.cybozu.com');
    expect(payload.exp).toBe(exp);
  });

  it('不正な signature で例外', async () => {
    const jwt = await signJwt({ sub: 'x' }, SECRET);
    const tampered = `${jwt.slice(0, -5)}AAAAA`;
    await expect(verifyJwt(tampered, SECRET)).rejects.toThrow(/signature/i);
  });

  it('payload が改ざんされたら例外 (signature 不一致)', async () => {
    const jwt = await signJwt({ sub: 'good' }, SECRET);
    const [h, , s] = jwt.split('.');
    // 別 payload を埋め込む
    const evilPayload = btoa(JSON.stringify({ sub: 'evil' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const tampered = `${h}.${evilPayload}.${s}`;
    await expect(verifyJwt(tampered, SECRET)).rejects.toThrow(/signature/i);
  });

  it('exp 切れで例外', async () => {
    const expired = Math.floor(Date.now() / 1000) - 60;
    const jwt = await signJwt({ sub: 'x', exp: expired }, SECRET);
    await expect(verifyJwt(jwt, SECRET)).rejects.toThrow(/expired/i);
  });

  it('exp が無い場合は通る (アプリ側で要件として必須にする想定)', async () => {
    const jwt = await signJwt({ sub: 'x' }, SECRET);
    const payload = await verifyJwt<{ sub: string }>(jwt, SECRET);
    expect(payload.sub).toBe('x');
  });

  it('malformed JWT で例外', async () => {
    await expect(verifyJwt('not.a.jwt', SECRET)).rejects.toThrow();
    await expect(verifyJwt('only-one-part', SECRET)).rejects.toThrow(/malformed/i);
  });

  it('base64url の "+" "/" "=" 文字を含まない (URL safe)', async () => {
    // 多くの payload で base64 すると + / = が出やすい。URL safe チェック
    const big = await signJwt(
      { kintone: { domain: 'x.cybozu.com', login: 'user+name', password: '~p/p+p+++' } },
      SECRET,
    );
    expect(big).not.toMatch(/[+/=]/);
  });
});
