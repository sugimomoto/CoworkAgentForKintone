import { describe, it, expect } from 'vitest';

import { formatRelative } from './format';

describe('formatRelative', () => {
  const NOW = new Date('2026-04-25T12:00:00Z');

  it('1 分未満は "今"', () => {
    expect(formatRelative('2026-04-25T11:59:30Z', NOW)).toBe('今');
  });

  it('数分前', () => {
    expect(formatRelative('2026-04-25T11:55:00Z', NOW)).toBe('5 分前');
  });

  it('数時間前 (24h 未満)', () => {
    expect(formatRelative('2026-04-25T09:00:00Z', NOW)).toBe('3 時間前');
  });

  it('24h〜48h は "昨日"', () => {
    expect(formatRelative('2026-04-24T10:00:00Z', NOW)).toBe('昨日');
  });

  it('48h 以上は YYYY-MM-DD HH:mm', () => {
    const result = formatRelative('2026-04-20T03:30:00Z', NOW);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('未来は "たった今"', () => {
    expect(formatRelative('2026-04-25T12:01:00Z', NOW)).toBe('たった今');
  });

  it('不正な ISO はそのまま返す', () => {
    expect(formatRelative('garbage', NOW)).toBe('garbage');
  });
});
