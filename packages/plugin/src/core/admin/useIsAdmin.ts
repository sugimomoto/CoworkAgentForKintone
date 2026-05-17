// Cowork Agent for kintone — admin 判定 hook
//
// kintone の cybozu.com 共通管理者かどうかを返す。Settings View / Header ⚙ の
// 表示制御に使う。
//
// V1 では `kintone.getLoginUser().administrator` の真偽値だけで判定。
// V4 でアプリ管理者にも開放する場合はここを async + REST 化する。
//
// 詳細仕様: .steering/20260517-customizer-wedge-design/design.md §4.2

import { useMemo } from 'react';

/**
 * 現在のログインユーザーが kintone 共通管理者 (administrator フラグ true) かどうかを返す。
 *
 * - kintone runtime ではない環境 (Vitest 等) では `kintone` が undefined のため false にフォールバック
 * - admin 判定はマウント時に一度だけ評価 (kintone API は同期、ユーザー切替も発生しない前提)
 *
 * @returns admin (= cybozu.com 共通管理者) なら true
 */
export function useIsAdmin(): boolean {
  return useMemo(() => isAdminSync(), []);
}

/**
 * hook を経由せずに admin 判定だけしたいユースケース向け (テストやコンポーネント外のロジック)。
 * `useIsAdmin` の内部実装でもこれを呼ぶ。
 */
export function isAdminSync(): boolean {
  const k = (globalThis as { kintone?: { getLoginUser?: () => { administrator?: boolean } } })
    .kintone;
  if (!k || typeof k.getLoginUser !== 'function') return false;
  try {
    const user = k.getLoginUser();
    return user?.administrator === true;
  } catch {
    return false;
  }
}
