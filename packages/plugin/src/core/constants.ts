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
// Managed Agents の Environment コンテナにインストールする Python パッケージ。
// alpha 段階では GitHub Release 添付 wheel を直接 URL 指定で pip install する
// (リポジトリが Public なため認証不要)。

/** kintone ヘルパー Python パッケージ名 */
export const HELPER_PACKAGE_NAME = 'cowork-agent-kintone' as const;

/** ヘルパーパッケージのバージョン (helper-v* タグと連動) */
export const HELPER_VERSION = '0.1.0a3' as const;

/**
 * Environment 構築時に `packages.pip` に渡す wheel URL。
 * pip は wheel URL を package specifier として直接受け付けるので、
 * --extra-index-url 等の補助設定は不要。
 */
export const HELPER_WHEEL_URL =
  `https://github.com/sugimomoto/CoworkAgentForKintone/releases/download/helper-v${HELPER_VERSION}/cowork_agent_kintone-${HELPER_VERSION}-py3-none-any.whl` as const;

/**
 * pip が wheel をダウンロードする際にアクセスするホスト群。
 * `allowed_hosts` に kintone ドメインと併せて追加する。
 */
export const HELPER_DOWNLOAD_HOSTS = ['github.com', 'objects.githubusercontent.com'] as const;
