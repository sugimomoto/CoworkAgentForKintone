// Cowork Agent for kintone — 通知 Webhook 用 Vault の解決 (#13)
//
// ユーザー Vault (resolveUserVault) とは別に、テナント (= kintoneDomain) 単位で
// 1 つの「通知 Vault」を持つ。Agent ごとの Webhook URL を static_bearer 認証情報として
// この Vault に格納し、各 Agent のセッション/デプロイに vault_ids で紐付ける。
//
// ユーザー Vault と分ける理由:
//   - 通知先はテナント共有の管理対象 (管理者が登録、全ユーザーの実行で使う)
//   - kintone OAuth トークンとはライフサイクル・権限境界が異なる
//
// in-flight Promise 保護で連続呼出時の重複作成を防ぐ。

import { METADATA_KEYS, METADATA_SOURCE } from '../constants';
import {
  createVault,
  filterByMetadata,
  listVaults,
  pickOldest,
} from '../managed-agents/resources';

import type { Vault } from '../managed-agents/types';

/** 通知 Vault を識別する purpose metadata 値。 */
export const NOTIFY_VAULT_PURPOSE = 'notify' as const;

let inFlightResolve: Promise<Vault> | null = null;

/** テナント (kintoneDomain) 固有の通知 Vault を解決する。無ければ作成、あれば再利用。 */
export async function resolveNotifyVault(kintoneDomain: string): Promise<Vault> {
  if (inFlightResolve) return inFlightResolve;

  inFlightResolve = (async (): Promise<Vault> => {
    try {
      const list = await listVaults({ limit: 100 });
      const matches = filterByMetadata(list.data, {
        [METADATA_KEYS.source]: METADATA_SOURCE,
        [METADATA_KEYS.purpose]: NOTIFY_VAULT_PURPOSE,
        [METADATA_KEYS.kintoneDomain]: kintoneDomain,
      });
      if (matches.length > 0) return pickOldest(matches);

      return await createVault({
        display_name: `Cowork Agent Notify - ${kintoneDomain}`,
        metadata: {
          [METADATA_KEYS.source]: METADATA_SOURCE,
          [METADATA_KEYS.purpose]: NOTIFY_VAULT_PURPOSE,
          [METADATA_KEYS.kintoneDomain]: kintoneDomain,
        },
      });
    } finally {
      inFlightResolve = null;
    }
  })();

  return inFlightResolve;
}

/** テスト用に in-flight キャッシュを reset する。 */
export function _resetResolveNotifyVaultCache(): void {
  inFlightResolve = null;
}
