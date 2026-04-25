// Cowork Agent for kintone — kintone JavaScript API ヘルパー
//
// kintone.getLoginUser() / location.hostname から
// 本プラグインで必要な user 情報と domain を取得する。

/** kintone グローバルが利用できないときの例外 */
export class KintoneNotAvailableError extends Error {
  constructor(message = 'kintone JavaScript API is not available in this context') {
    super(message);
    this.name = 'KintoneNotAvailableError';
  }
}

function getKintone(): KintoneGlobal {
  if (typeof kintone === 'undefined' || kintone === null) {
    throw new KintoneNotAvailableError();
  }
  return kintone;
}

/** ログインユーザーのユーザーコード (kintone のログイン名) */
export function getKintoneUserCode(): string {
  return getKintone().getLoginUser().code;
}

/** kintone ドメイン (例: "example.cybozu.com") */
export function getKintoneDomain(): string {
  return location.hostname;
}

/** Session の metadata に渡すコンテキスト情報 */
export interface KintoneSessionContext {
  kintoneUserCode: string;
  kintoneDomain: string;
}

/** 現在のユーザー / ドメインをまとめて返す */
export function getCurrentSessionContext(): KintoneSessionContext {
  return {
    kintoneUserCode: getKintoneUserCode(),
    kintoneDomain: getKintoneDomain(),
  };
}
