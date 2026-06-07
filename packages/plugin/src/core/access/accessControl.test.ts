// accessControl のサマリヘルパー / userLabel の単体テスト (#47)

import { describe, expect, it } from 'vitest';

import {
  accessCounts,
  EMPTY_ACCESS,
  formatAccessFull,
  formatAccessSummary,
  userLabel,
} from './accessControl';

const open = EMPTY_ACCESS;

describe('accessCounts', () => {
  it('空 → isOpen=true', () => {
    expect(accessCounts(open)).toEqual({ u: 0, g: 0, o: 0, total: 0, isOpen: true });
  });
  it('混在', () => {
    expect(
      accessCounts({
        allowedUsers: ['a', 'b'],
        allowedGroups: ['g'],
        allowedOrganizations: [],
      }),
    ).toEqual({ u: 2, g: 1, o: 0, total: 3, isOpen: false });
  });
});

describe('formatAccessSummary (採用案 1)', () => {
  it('全 0 → 全員', () => {
    expect(formatAccessSummary(open)).toBe('全員');
  });
  it('user のみ → N人', () => {
    expect(
      formatAccessSummary({
        allowedUsers: ['a', 'b', 'c'],
        allowedGroups: [],
        allowedOrganizations: [],
      }),
    ).toBe('3人');
  });
  it('group のみ → Nグループ', () => {
    expect(
      formatAccessSummary({
        allowedUsers: [],
        allowedGroups: ['x', 'y'],
        allowedOrganizations: [],
      }),
    ).toBe('2グループ');
  });
  it('複数軸 → 最大軸 + 余り (+N)', () => {
    expect(
      formatAccessSummary({
        allowedUsers: ['a', 'b', 'c', 'd', 'e'],
        allowedGroups: ['g1', 'g2'],
        allowedOrganizations: [],
      }),
    ).toBe('5人 +2');
  });
  it('完全に同数の場合は user 軸が優先 (ord=0)', () => {
    expect(
      formatAccessSummary({
        allowedUsers: ['a'],
        allowedGroups: ['g'],
        allowedOrganizations: ['o'],
      }),
    ).toBe('1人 +2');
  });
});

describe('formatAccessFull (採用案 2)', () => {
  it('全 0 → 全員に公開', () => {
    expect(formatAccessFull(open)).toBe('全員に公開');
  });
  it('混在 → ・ 区切り', () => {
    expect(
      formatAccessFull({
        allowedUsers: ['a', 'b'],
        allowedGroups: ['g'],
        allowedOrganizations: ['o'],
      }),
    ).toBe('2人・1グループ・1組織');
  });
});

describe('userLabel', () => {
  it('code あり → 「name（code）」', () => {
    expect(userLabel({ code: 'sato@example.com', name: '佐藤太郎' })).toBe(
      '佐藤太郎（sato@example.com）',
    );
  });
  it('code 空 → name のみ', () => {
    expect(userLabel({ code: '', name: 'guest' })).toBe('guest');
  });
});
