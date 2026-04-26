import { describe, expect, it } from 'vitest';

import { buildMcpServerUrl, joinUrl, sleep, toErrorMessage } from './utils';

describe('sleep', () => {
  it('指定 ms 後に resolve する (大体)', async () => {
    const t0 = Date.now();
    await sleep(20);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(15);
  });
});

describe('toErrorMessage', () => {
  it('Error は message を返す', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });
  it('文字列はそのまま', () => {
    expect(toErrorMessage('msg')).toBe('msg');
  });
  it('null/undefined は空文字', () => {
    expect(toErrorMessage(null)).toBe('');
    expect(toErrorMessage(undefined)).toBe('');
  });
});

describe('joinUrl', () => {
  it('末尾スラッシュ + 先頭スラッシュを正規化', () => {
    expect(joinUrl('https://x.com/', '/foo')).toBe('https://x.com/foo');
    expect(joinUrl('https://x.com', 'foo')).toBe('https://x.com/foo');
    expect(joinUrl('https://x.com//', '//foo')).toBe('https://x.com/foo');
  });
  it('path が空ならベース URL のみ', () => {
    expect(joinUrl('https://x.com/', '')).toBe('https://x.com');
  });
});

describe('buildMcpServerUrl', () => {
  it('/mcp/<domain> 形式', () => {
    expect(buildMcpServerUrl('https://w.example.com', 'tenant.cybozu.com')).toBe(
      'https://w.example.com/mcp/tenant.cybozu.com',
    );
    expect(buildMcpServerUrl('https://w.example.com/', 'tenant.cybozu.com')).toBe(
      'https://w.example.com/mcp/tenant.cybozu.com',
    );
  });
});
