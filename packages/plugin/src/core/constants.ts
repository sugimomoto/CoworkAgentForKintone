// Cowork Agent for kintone — 共通定数

/** プラグインを識別する metadata の値 */
export const METADATA_SOURCE = 'cowork-agent-for-kintone' as const;

/** Managed Agents API のベース URL */
export const ANTHROPIC_API_BASE = 'https://api.anthropic.com' as const;

/** Anthropic 基本バージョン */
export const ANTHROPIC_VERSION = '2023-06-01' as const;

/** Managed Agents Beta ヘッダ値 */
export const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01' as const;

/**
 * Memory Store 系エンドポイント (`/v1/memory_stores/**`) 専用の Beta ヘッダ (#15)。
 * session attach は従来の MANAGED_AGENTS_BETA のまま。両者を同一リクエストに混在させると 400。
 * kintone proxy が comma 区切り beta を壊すため、memory 呼出は単独でこの値に置換して送る。
 */
export const MEMORY_AGENTS_BETA = 'agent-memory-2026-07-22' as const;

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

/**
 * kintone OAuth で要求する scope (固定)。
 * Plugin が叩くツールセット (kintone-* MCP ツール群) と Customizer wedge の
 * カスタマイズ適用 (PUT customize.json / POST deploy.json) で必要なものを全部含む。
 * ユーザー編集不可: 削れば壊れるし、足しても使われない。
 *
 * Scope 内訳:
 *   - k:app_record:read/write — レコード CRUD (MCP ツール群)
 *   - k:app_settings:read     — アプリ情報 / フィールド構造取得
 *   - k:app_settings:write    — Customizer wedge の customize.json PUT + deploy (#20 V2)
 *   - k:file:read/write       — レコード添付 + Customizer の file.json upload
 */
export const DEFAULT_KINTONE_OAUTH_SCOPE =
  'k:app_record:read k:app_record:write k:app_settings:read k:app_settings:write k:file:read k:file:write';

/** Cloudflare Workers script 名 (固定)。Worker URL の subdomain にも使われる。 */
export const CLOUDFLARE_WORKER_SCRIPT_NAME = 'cowork-agent-kintone-mcp';

/** OAuth callback の postMessage source 識別子 (popup ↔ opener)。
 *  Worker /oauth/callback と Plugin core/oauth/popup の両側で照合する。 */
export const OAUTH_POSTMESSAGE_SOURCE = 'cowork-agent-kintone-mcp';
