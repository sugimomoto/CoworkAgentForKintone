import { describe, expect, it } from 'vitest';

import {
  KINTONE_HOST_RE,
  KINTONE_HOST_SUFFIXES,
  KINTONE_ORIGIN_RE,
  mcpPathPattern,
} from '../src/kintone-domains';

describe('kintone-domains — 許可リストの一貫性', () => {
  // MCP ルーティングと OAuth callback の targetOrigin 検証が同一の suffix 群を使うことを保証する。
  // (片方だけ拡張して許可リストがズレる事故を防ぐ)
  const validHosts = KINTONE_HOST_SUFFIXES.map((s) => `tenant.${s}`);
  const invalidHosts = ['evil.example', 'cybozu.com.evil.example', 'notkintone.org'];

  it('MCP path とオリジン検証が同じホストを許可/拒否する', () => {
    for (const host of validHosts) {
      expect(mcpPathPattern().test(`/mcp/${host}`)).toBe(true);
      expect(KINTONE_HOST_RE.test(host)).toBe(true);
      expect(KINTONE_ORIGIN_RE.test(`https://${host}`)).toBe(true);
    }
    for (const host of invalidHosts) {
      expect(mcpPathPattern().test(`/mcp/${host}`)).toBe(false);
      expect(KINTONE_ORIGIN_RE.test(`https://${host}`)).toBe(false);
    }
  });

  it('オリジン検証は https のみ許可する', () => {
    expect(KINTONE_ORIGIN_RE.test('http://tenant.cybozu.com')).toBe(false);
    expect(KINTONE_ORIGIN_RE.test('https://tenant.cybozu.com')).toBe(true);
  });
});
