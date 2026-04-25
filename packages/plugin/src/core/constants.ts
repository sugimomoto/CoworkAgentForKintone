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
