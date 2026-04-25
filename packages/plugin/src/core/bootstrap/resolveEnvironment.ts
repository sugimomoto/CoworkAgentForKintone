// Cowork Agent for kintone — Bootstrap Environment の解決
//
// Phase 1a 用の最小 Environment (kintone 接続なし) を解決・作成する。
// Phase 1b で `resolveUserEnvironment` (ユーザー専用、ヘルパーライブラリ + allowed_hosts 設定済) に置き換え予定。

import { METADATA_SOURCE } from '../constants';
import {
  createEnvironment,
  findByMetadata,
  listEnvironments,
  pickOldest,
} from '../managed-agents/resources';

import type { Environment } from '../managed-agents/types';

/** Bootstrap Environment の表示名 */
export const BOOTSTRAP_ENV_NAME = 'Cowork Agent - Bootstrap';

/** Bootstrap Environment 識別用 metadata.purpose 値 */
export const BOOTSTRAP_PURPOSE = 'bootstrap';

/**
 * Phase 1a 用の bootstrap Environment を取得する。なければ作成する。
 *
 * - kintone への外向き通信なし (`allowed_hosts: []`)
 * - パッケージなし (`packages: {}`)
 * - metadata: `{ source, purpose: 'bootstrap' }`
 */
export async function resolveBootstrapEnvironment(): Promise<Environment> {
  const matches = await findByMetadata<Environment>(
    (page) => listEnvironments({ page }),
    {
      source: METADATA_SOURCE,
      purpose: BOOTSTRAP_PURPOSE,
    },
  );
  // 別タブが race で重複作成した場合に備え、created_at 最古を採用 (決定論的選択)
  if (matches.length > 0) return pickOldest(matches);

  return await createEnvironment({
    name: BOOTSTRAP_ENV_NAME,
    config: {
      type: 'cloud',
      networking: {
        type: 'limited',
        allow_package_managers: false,
        allowed_hosts: [],
      },
      packages: {},
    },
    metadata: {
      source: METADATA_SOURCE,
      purpose: BOOTSTRAP_PURPOSE,
    },
  });
}
