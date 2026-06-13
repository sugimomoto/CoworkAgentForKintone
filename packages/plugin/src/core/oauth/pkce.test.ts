import { afterEach, describe, expect, it, beforeEach } from 'vitest';

import { clearPkce, generatePkce, loadPkce, savePkce } from './pkce';

describe('generatePkce', () => {
  it('codeVerifier / codeChallenge は base64url 文字列', async () => {
    const p = await generatePkce();
    expect(p.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(p.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // verifier は 43+ 文字 (32 bytes base64url = 43 chars)
    expect(p.codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  it('state は <random>.<base64url(origin)> 形式で、後半が現在の origin をエンコードしている', async () => {
    const p = await generatePkce();
    expect(p.state).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const originSegment = p.state.slice(p.state.indexOf('.') + 1);
    const b64 = originSegment.replace(/-/g, '+').replace(/_/g, '/');
    expect(atob(b64)).toBe(location.origin);
  });

  it('codeChallenge = SHA256(codeVerifier) base64url', async () => {
    const p = await generatePkce();
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p.codeVerifier));
    const expected = btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(p.codeChallenge).toBe(expected);
  });

  it('連続呼出で異なる値を返す', async () => {
    const a = await generatePkce();
    const b = await generatePkce();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.state).not.toBe(b.state);
  });
});

describe('save/load/clear PKCE', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it('save → load で同じ値', async () => {
    const p = await generatePkce();
    savePkce(p);
    const loaded = loadPkce();
    expect(loaded).toEqual(p);
  });

  it('未保存なら load が null', () => {
    expect(loadPkce()).toBeNull();
  });

  it('clear で消える', async () => {
    savePkce(await generatePkce());
    clearPkce();
    expect(loadPkce()).toBeNull();
  });

  it('壊れた sessionStorage 値は null として扱う', () => {
    sessionStorage.setItem('cowork-agent.oauth.pkce', 'not-json');
    expect(loadPkce()).toBeNull();
  });
});
