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
