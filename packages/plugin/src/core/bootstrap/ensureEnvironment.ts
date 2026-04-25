// Cowork Agent for kintone — ユーザー専用 Environment の解決
//
// 1 ユーザー (= kintoneDomain × kintoneUserCode) ごとに 1 つの Environment を持ち、
// 中に kintone ヘルパーライブラリ (cowork-agent-kintone) を pip install しておく。
// `allowed_hosts` には kintone ドメイン + GitHub Release ダウンロード先を含める。
//
// Phase 1a の `resolveBootstrapEnvironment` (purpose: 'bootstrap') とは独立。
// metadata の userCode/domain で識別し、bootstrap 環境は除外される。

import { HELPER_DOWNLOAD_HOSTS, HELPER_VERSION, HELPER_WHEEL_URL, METADATA_SOURCE } from '../constants';
import {
  createEnvironment,
  filterByMetadata,
  listEnvironments,
  pickOldest,
} from '../managed-agents/resources';

import type { Environment } from '../managed-agents/types';

export interface UserEnvironmentContext {
  agentId: string;
  kintoneDomain: string;
  kintoneUserCode: string;
}

let inFlightResolve: Promise<Environment> | null = null;

/** ユーザー専用 Environment を解決する。無ければ作成、あれば再利用。 */
export async function ensureUserEnvironment(
  ctx: UserEnvironmentContext,
): Promise<Environment> {
  if (inFlightResolve) return inFlightResolve;

  inFlightResolve = (async (): Promise<Environment> => {
    try {
      const list = await listEnvironments({ limit: 100 });
      const matches = filterByMetadata(list.data, {
        source: METADATA_SOURCE,
        kintoneDomain: ctx.kintoneDomain,
        kintoneUserCode: ctx.kintoneUserCode,
      });
      if (matches.length > 0) return pickOldest(matches);

      return await createEnvironment({
        name: `Cowork Agent - ${ctx.kintoneUserCode}@${ctx.kintoneDomain}`,
        config: {
          type: 'cloud',
          networking: {
            type: 'limited',
            allow_package_managers: true,
            allowed_hosts: [ctx.kintoneDomain, ...HELPER_DOWNLOAD_HOSTS],
          },
          packages: {
            pip: [HELPER_WHEEL_URL],
          },
        },
        metadata: {
          source: METADATA_SOURCE,
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
          agentId: ctx.agentId,
          helperVersion: HELPER_VERSION,
        },
      });
    } finally {
      inFlightResolve = null;
    }
  })();

  return inFlightResolve;
}

/** テスト用に in-flight キャッシュを reset する。 */
export function _resetEnsureUserEnvironmentCache(): void {
  inFlightResolve = null;
}
