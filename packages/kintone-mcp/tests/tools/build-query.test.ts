import { describe, expect, it } from 'vitest';

import { buildQueryFromFilters } from '../../src/tools/utils/build-query';

describe('buildQueryFromFilters — フィルタ単体', () => {
  it('filter / orderBy / limit / offset すべて未指定 → undefined', () => {
    expect(buildQueryFromFilters({})).toBeUndefined();
  });

  it('textContains: field like "value"', () => {
    expect(
      buildQueryFromFilters({ filters: { textContains: [{ field: 'title', value: '見積' }] } }),
    ).toBe('title like "見積"');
  });

  it('equals: 文字列値はクォートで囲む', () => {
    expect(buildQueryFromFilters({ filters: { equals: [{ field: 'status', value: '完了' }] } })).toBe(
      'status = "完了"',
    );
  });

  it('equals: 数値はクォートしない', () => {
    expect(buildQueryFromFilters({ filters: { equals: [{ field: 'amount', value: 1000 }] } })).toBe(
      'amount = 1000',
    );
  });

  it('dateRange: from/to 両方', () => {
    expect(
      buildQueryFromFilters({
        filters: { dateRange: [{ field: 'created_time', from: '2026-01-01', to: '2026-12-31' }] },
      }),
    ).toBe('created_time >= "2026-01-01" and created_time <= "2026-12-31"');
  });

  it('dateRange: from のみ', () => {
    expect(
      buildQueryFromFilters({ filters: { dateRange: [{ field: 'd', from: '2026-01-01' }] } }),
    ).toBe('d >= "2026-01-01"');
  });

  it('numberRange: min/max', () => {
    expect(
      buildQueryFromFilters({
        filters: { numberRange: [{ field: 'amount', min: 100, max: 10000 }] },
      }),
    ).toBe('amount >= 100 and amount <= 10000');
  });

  it('inValues / notInValues', () => {
    expect(
      buildQueryFromFilters({
        filters: {
          inValues: [{ field: 'category', values: ['A', 'B'] }],
          notInValues: [{ field: 'tag', values: ['archived'] }],
        },
      }),
    ).toBe('category in ("A", "B") and tag not in ("archived")');
  });
});

describe('buildQueryFromFilters — orderBy / limit / offset', () => {
  it('orderBy のみ (filter 無し)', () => {
    expect(
      buildQueryFromFilters({
        orderBy: [
          { field: 'created_time', order: 'desc' },
          { field: 'title' },
        ],
      }),
    ).toBe('order by created_time desc, title asc');
  });

  it('filter + orderBy + limit + offset', () => {
    expect(
      buildQueryFromFilters({
        filters: { equals: [{ field: 'status', value: 'open' }] },
        orderBy: [{ field: 'created_time', order: 'desc' }],
        limit: 100,
        offset: 0,
      }),
    ).toBe('status = "open" order by created_time desc limit 100 offset 0');
  });

  it('limit のみ', () => {
    expect(buildQueryFromFilters({ limit: 50 })).toBe('limit 50');
  });

  it('offset のみ (filter 無し)', () => {
    expect(buildQueryFromFilters({ offset: 100 })).toBe('offset 100');
  });
});

describe('buildQueryFromFilters — 複合', () => {
  it('複数フィルタが AND で結合される', () => {
    expect(
      buildQueryFromFilters({
        filters: {
          textContains: [{ field: 'title', value: 'A' }],
          equals: [{ field: 'status', value: 'open' }],
          numberRange: [{ field: 'amount', min: 100 }],
        },
      }),
    ).toBe('title like "A" and status = "open" and amount >= 100');
  });
});

describe('buildQueryFromFilters — インジェクション対策', () => {
  it('値に含まれる " はエスケープされる', () => {
    expect(
      buildQueryFromFilters({
        filters: { equals: [{ field: 'status', value: 'a" or status = "b' }] },
      }),
    ).toBe('status = "a\\" or status = \\"b"');
  });

  it('値に含まれる \\ はエスケープされる', () => {
    expect(
      buildQueryFromFilters({ filters: { textContains: [{ field: 'path', value: 'C:\\temp' }] } }),
    ).toBe('path like "C:\\\\temp"');
  });

  it('inValues の各値もエスケープされる', () => {
    expect(
      buildQueryFromFilters({
        filters: { inValues: [{ field: 'tag', values: ['x"y', 'z'] }] },
      }),
    ).toBe('tag in ("x\\"y", "z")');
  });

  it('フィールド名に構文破壊文字 (引用符) を含むと throw する', () => {
    expect(() =>
      buildQueryFromFilters({
        filters: { equals: [{ field: 'status") or (1 = "1', value: 'x' }] },
      }),
    ).toThrow(/invalid field code/);
  });

  it('フィールド名に空白を含むと throw する', () => {
    expect(() =>
      buildQueryFromFilters({ filters: { textContains: [{ field: 'a or b', value: 'x' }] } }),
    ).toThrow(/invalid field code/);
  });

  it('orderBy のフィールド名経由のインジェクションも throw する', () => {
    expect(() =>
      buildQueryFromFilters({ orderBy: [{ field: 'created_time desc, (select', order: 'asc' }] }),
    ).toThrow(/invalid field code/);
  });

  it('日本語フィールドコードは通る (正常系)', () => {
    expect(
      buildQueryFromFilters({ filters: { equals: [{ field: '会社名', value: 'サイボウズ' }] } }),
    ).toBe('会社名 = "サイボウズ"');
  });

  it('非有限な数値は throw する', () => {
    expect(() =>
      buildQueryFromFilters({ filters: { numberRange: [{ field: 'amount', min: Infinity }] } }),
    ).toThrow(/invalid numeric value/);
  });
});
