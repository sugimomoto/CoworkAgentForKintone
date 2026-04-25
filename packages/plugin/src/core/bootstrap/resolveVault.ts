// Cowork Agent for kintone — ユーザー Vault の解決と認証情報書込み
//
// 1 ユーザー (= kintoneDomain × kintoneUserCode) あたり 1 つの Vault を持ち、
// kintone の Basic 認証情報 (KINTONE_DOMAIN / LOGIN / PASSWORD) を保管する。
//
// in-flight Promise 保護で連続呼出時の重複作成を防ぐ。
// 同時並行で別タブが作っていた場合は pickOldest で race-deterministic に最古を採用。

import { METADATA_SOURCE } from '../constants';
import {
  createVault,
  filterByMetadata,
  listVaults,
  pickOldest,
  setVaultKeys,
} from '../managed-agents/resources';

import type { Vault } from '../managed-agents/types';

export interface VaultContext {
  kintoneDomain: string;
  kintoneUserCode: string;
}

let inFlightResolve: Promise<Vault> | null = null;

/** ユーザー固有 Vault を解決する。無ければ作成、あれば再利用。 */
export async function resolveUserVault(ctx: VaultContext): Promise<Vault> {
  if (inFlightResolve) return inFlightResolve;

  inFlightResolve = (async (): Promise<Vault> => {
    try {
      const list = await listVaults({ limit: 100 });
      const matches = filterByMetadata(list.data, {
        source: METADATA_SOURCE,
        kintoneDomain: ctx.kintoneDomain,
        kintoneUserCode: ctx.kintoneUserCode,
      });
      if (matches.length > 0) return pickOldest(matches);

      return await createVault({
        display_name: `Cowork Agent - ${ctx.kintoneUserCode}@${ctx.kintoneDomain}`,
        metadata: {
          source: METADATA_SOURCE,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
        },
      });
    } finally {
      inFlightResolve = null;
    }
  })();

  return inFlightResolve;
}

/**
 * Vault に kintone の認証情報を upsert する (3 キー: DOMAIN/LOGIN/PASSWORD)。
 * 既存値がある場合は上書きされる (Vault の仕様)。
 */
export async function setVaultCredentials(
  vaultId: string,
  creds: { domain: string; login: string; password: string },
): Promise<void> {
  await setVaultKeys(vaultId, {
    KINTONE_DOMAIN: creds.domain,
    KINTONE_LOGIN: creds.login,
    KINTONE_PASSWORD: creds.password,
  });
}

/** テスト用に in-flight キャッシュを reset する。 */
export function _resetResolveUserVaultCache(): void {
  inFlightResolve = null;
}
