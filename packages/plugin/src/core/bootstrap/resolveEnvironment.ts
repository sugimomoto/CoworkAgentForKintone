// Cowork Agent for kintone — Bootstrap Environment の解決
//
// MCP server へのアクセスを許可するため Environment は `networking.allow_mcp_servers = true`
// が必須。旧 Environment にはこの設定が無いので、metadata `mcpEnabled: 'true'` で
// 識別して MCP 対応世代だけを返す (旧世代は残置)。

import { METADATA_SOURCE } from '../constants';
import {
  createEnvironment,
  findByMetadata,
  listEnvironments,
  pickOldest,
} from '../managed-agents/resources';

import type { Environment } from '../managed-agents/types';

/** Bootstrap Environment の表示名 */
export const BOOTSTRAP_ENV_NAME = 'Cowork Agent - Bootstrap (MCP)';

/** Bootstrap Environment 識別用 metadata.purpose 値 */
export const BOOTSTRAP_PURPOSE = 'bootstrap';

/** MCP 対応世代を識別する metadata key/value */
const MCP_ENABLED_KEY = 'mcpEnabled';
const MCP_ENABLED_VALUE = 'true';

/**
 * Bootstrap Environment を取得する。なければ作成する。
 *
 * - `networking.allow_mcp_servers = true` (MCP server エンドポイントへの通信許可)
 * - パッケージなし
 * - metadata: `{ source, purpose: 'bootstrap', mcpEnabled: 'true' }`
 */
export async function resolveBootstrapEnvironment(): Promise<Environment> {
  const matches = await findByMetadata<Environment>(
    (page) => listEnvironments({ page }),
    {
      source: METADATA_SOURCE,
      purpose: BOOTSTRAP_PURPOSE,
      [MCP_ENABLED_KEY]: MCP_ENABLED_VALUE,
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
        allow_mcp_servers: true,
        allow_package_managers: false,
        allowed_hosts: [],
      },
      packages: {},
    },
    metadata: {
      source: METADATA_SOURCE,
      purpose: BOOTSTRAP_PURPOSE,
      [MCP_ENABLED_KEY]: MCP_ENABLED_VALUE,
    },
  });
}
