// Cowork Agent for kintone — admin 判定 hook
//
// 公式 API `kintone.isUsersAndSystemAdministrator()` (cybozu.com 共通管理者判定) を
// 使う。Promise を返す async API なので、内部で useState + useEffect で fetch し、
// 解決後に React state を更新する。
//
// なお `kintone.getLoginUser()` の戻り値には `administrator` プロパティは **無い**
// (公式仕様)。以前の同期判定実装は誤りだったので本 hook で訂正した。
//
// 利用できない画面 (公式仕様):
//   - 検索画面 / アプリストア / プラグイン設定画面
//   ※ Chat Panel はレコード一覧画面で動くので問題なし
//
// 詳細仕様: .steering/20260517-customizer-wedge-design/design.md §4.2

import { useEffect, useState } from 'react';

type KintoneAdminCheck = {
  isUsersAndSystemAdministrator?: () => Promise<boolean>;
};

/**
 * 現在のログインユーザーが cybozu.com 共通管理者かどうかを返す。
 *
 * - 初回レンダリングは `false` (= Gear 非表示)、解決後に `true` になると Gear が出る
 * - kintone runtime 不在 (Vitest 等) では false を返す
 * - API が reject しても false にフォールバック (例外は伝播させない)
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveIsAdmin().then((result) => {
      if (!cancelled) setIsAdmin(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}

/**
 * hook を経由せずに admin 判定だけしたいユースケース向け (テストやコンポーネント外の
 * ロジック)。Promise を返す async 関数なので呼出側で `await` 必要。
 */
export async function resolveIsAdmin(): Promise<boolean> {
  const k = (globalThis as { kintone?: KintoneAdminCheck }).kintone;
  if (!k || typeof k.isUsersAndSystemAdministrator !== 'function') return false;
  try {
    const result = await k.isUsersAndSystemAdministrator();
    return result === true;
  } catch {
    return false;
  }
}
