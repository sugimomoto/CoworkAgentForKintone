// useIsAdmin / isAdminSync のテスト
//
// kintone runtime をモックし、administrator フラグの組み合わせで挙動を検証する。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isAdminSync } from './useIsAdmin';

type KintoneGlobal = { kintone?: { getLoginUser?: () => { administrator?: boolean } } };

const g = globalThis as KintoneGlobal;
let savedKintone: typeof g.kintone;

beforeEach(() => {
  savedKintone = g.kintone;
});

afterEach(() => {
  g.kintone = savedKintone;
});

describe('isAdminSync', () => {
  it('administrator: true で true', () => {
    g.kintone = { getLoginUser: () => ({ administrator: true }) };
    expect(isAdminSync()).toBe(true);
  });

  it('administrator: false で false', () => {
    g.kintone = { getLoginUser: () => ({ administrator: false }) };
    expect(isAdminSync()).toBe(false);
  });

  it('administrator フラグが無いオブジェクトでも false', () => {
    g.kintone = { getLoginUser: () => ({}) };
    expect(isAdminSync()).toBe(false);
  });

  it('kintone グローバルが無い (Vitest デフォルト環境) では false', () => {
    g.kintone = undefined;
    expect(isAdminSync()).toBe(false);
  });

  it('kintone.getLoginUser が関数でない場合は false', () => {
    g.kintone = {} as { getLoginUser?: () => { administrator?: boolean } };
    expect(isAdminSync()).toBe(false);
  });

  it('getLoginUser が throw しても false (例外を伝播しない)', () => {
    g.kintone = {
      getLoginUser: (): { administrator?: boolean } => {
        throw new Error('boom');
      },
    };
    expect(isAdminSync()).toBe(false);
  });
});
