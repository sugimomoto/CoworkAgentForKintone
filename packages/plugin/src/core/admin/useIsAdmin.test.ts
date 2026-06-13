// useIsAdmin / resolveIsAdmin のテスト
//
// kintone.isUsersAndSystemAdministrator() を mock し、async 解決後に true/false が
// 反映されるかを検証。

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveIsAdmin, useIsAdmin } from './useIsAdmin';

type KintoneGlobal = {
  kintone?:
    | {
        isUsersAndSystemAdministrator?: () => Promise<boolean>;
      }
    | undefined;
};

const g = globalThis as KintoneGlobal;
let savedKintone: typeof g.kintone;

beforeEach(() => {
  savedKintone = g.kintone;
});

afterEach(() => {
  g.kintone = savedKintone;
});

describe('resolveIsAdmin', () => {
  it('isUsersAndSystemAdministrator() が true を resolve すると true', async () => {
    g.kintone = { isUsersAndSystemAdministrator: () => Promise.resolve(true) };
    await expect(resolveIsAdmin()).resolves.toBe(true);
  });

  it('false を resolve すると false', async () => {
    g.kintone = { isUsersAndSystemAdministrator: () => Promise.resolve(false) };
    await expect(resolveIsAdmin()).resolves.toBe(false);
  });

  it('kintone グローバルが無い (Vitest 等) と false', async () => {
    g.kintone = undefined;
    await expect(resolveIsAdmin()).resolves.toBe(false);
  });

  it('isUsersAndSystemAdministrator が関数でない場合は false', async () => {
    g.kintone = {} as { isUsersAndSystemAdministrator?: () => Promise<boolean> };
    await expect(resolveIsAdmin()).resolves.toBe(false);
  });

  it('reject しても false にフォールバック (例外を伝播しない)', async () => {
    g.kintone = {
      isUsersAndSystemAdministrator: () => Promise.reject(new Error('boom')),
    };
    await expect(resolveIsAdmin()).resolves.toBe(false);
  });

  it('true 以外の値 (truthy だが boolean でない) は false 扱い', async () => {
    g.kintone = {
      isUsersAndSystemAdministrator: () => Promise.resolve('yes' as unknown as boolean),
    };
    await expect(resolveIsAdmin()).resolves.toBe(false);
  });
});

describe('useIsAdmin', () => {
  it('mount 時は false、解決後に true に更新される', async () => {
    g.kintone = { isUsersAndSystemAdministrator: () => Promise.resolve(true) };
    const { result } = renderHook(() => useIsAdmin());
    // 初回は false
    expect(result.current).toBe(false);
    // async 解決後に true
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('false を resolve すると false のまま', async () => {
    g.kintone = { isUsersAndSystemAdministrator: () => Promise.resolve(false) };
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
    // 微小な遅延を入れて非変化を確認
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBe(false);
  });

  it('reject しても false のまま (UI が壊れない)', async () => {
    g.kintone = {
      isUsersAndSystemAdministrator: () => Promise.reject(new Error('403')),
    };
    const { result } = renderHook(() => useIsAdmin());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBe(false);
  });

  it('unmount 後に解決しても setState を呼ばない (cleanup)', async () => {
    let resolve!: (v: boolean) => void;
    g.kintone = {
      isUsersAndSystemAdministrator: () =>
        new Promise<boolean>((r) => {
          resolve = r;
        }),
    };
    const { result, unmount } = renderHook(() => useIsAdmin());
    unmount();
    resolve(true);
    await new Promise((r) => setTimeout(r, 10));
    // result.current は最後の render 時点 (false)
    expect(result.current).toBe(false);
  });
});
