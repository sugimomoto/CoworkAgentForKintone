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

/** kintone OAuth scope のデフォルト推奨。ConfigScreen 初期値 + connect 時 fallback。 */
export const DEFAULT_KINTONE_OAUTH_SCOPE =
  'k:app_record:read k:app_record:write k:app_settings:read k:file:read k:file:write';

/** Cloudflare Workers script 名 (固定)。Worker URL の subdomain にも使われる。 */
export const CLOUDFLARE_WORKER_SCRIPT_NAME = 'cowork-agent-kintone-mcp';

/** OAuth callback の postMessage source 識別子 (popup ↔ opener)。
 *  Worker /oauth/callback と Plugin core/oauth/popup の両側で照合する。 */
export const OAUTH_POSTMESSAGE_SOURCE = 'cowork-agent-kintone-mcp';
