// Cowork Agent for kintone — 共通定数

/** プラグインを識別する metadata の値 */
export const METADATA_SOURCE = 'cowork-agent-for-kintone' as const;

/** Managed Agents API のベース URL */
export const ANTHROPIC_API_BASE = 'https://api.anthropic.com' as const;

/** Anthropic 基本バージョン */
export const ANTHROPIC_VERSION = '2023-06-01' as const;

/** Managed Agents Beta ヘッダ値 */
export const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01' as const;

/** ポーリング間隔 (ms) */
export const POLLING_INTERVAL_MS = {
  initial: 2000,
  max: 10000,
  steps: [2000, 3000, 5000, 10000],
} as const;

/** リソース識別 metadata キー名 */
export const METADATA_KEYS = {
  source: 'source',
  type: 'type',
  kintoneDomain: 'kintoneDomain',
  kintoneUserCode: 'kintoneUserCode',
  agentId: 'agentId',
  helperVersion: 'helperVersion',
  purpose: 'purpose',
} as const;

/** Agent type metadata 値 */
export const AGENT_TYPE = {
  default: 'default',
  custom: 'custom',
} as const;

// ----- kintone ヘルパーライブラリ -------------------------------------------
//
// Phase 1b-1 で Python パッケージ (cowork-agent-kintone) を helper-v* タグで配布したが、
// Phase 1b-2 (改訂) では Remote MCP (Cloudflare Workers) 方式に切替えたため、
// Environment への pip install は廃止。helper パッケージは Pattern A 用途で残置。
// 関連定数 (HELPER_PACKAGE_NAME / HELPER_VERSION / HELPER_WHEEL_URL / HELPER_DOWNLOAD_HOSTS)
// は Phase 1b-2 改訂で削除。Phase 1c 以降で必要になれば復活させる。
