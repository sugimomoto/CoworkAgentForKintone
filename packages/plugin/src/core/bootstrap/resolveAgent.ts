// Cowork Agent for kintone — Default Agent の解決
//
// metadata でフィルタした既存 Default Agent があればそれを返す。
// 無ければ新規作成する。
//
// workerUrl + kintoneDomain 指定時は mcp_servers (kintone MCP) と mcp_toolset を
// Agent に登録する。これらの値は metadata にも埋め込まれ、URL が変わると別 Agent と
// して新規作成される (旧 Agent は残置)。

import { AGENT_TYPE, METADATA_SOURCE } from '../constants';
import {
  createAgent,
  findByMetadata,
  listAgents,
  pickOldest,
} from '../managed-agents/resources';

import type { Agent } from '../managed-agents/types';

/** Default Agent の表示名 (functional-design.md §3.1.3) */
export const DEFAULT_AGENT_NAME = 'Cowork Agent - Default';

/** Default Agent の system プロンプト */
export const DEFAULT_AGENT_SYSTEM_PROMPT = [
  'あなたは kintone の業務支援エージェント Cowork Agent です。',
  '`kintone` MCP サーバーが提供する以下のツールを必要に応じて使い、ユーザーの問合せに答えてください:',
  '  - kintone-get-apps: アプリ一覧取得',
  '  - kintone-get-app: アプリ単体の取得',
  '  - kintone-get-form-fields: アプリのフィールド定義取得',
  '  - kintone-get-records: レコード取得 (filters / orderBy / limit / offset 対応)',
  'ツール呼出時にエラーが返ってきた場合は、ユーザに分かりやすく状況を説明してください。',
].join('\n');

/** kintone MCP server の name (mcp_servers と mcp_toolset で参照される識別子) */
export const KINTONE_MCP_SERVER_NAME = 'kintone';

/**
 * Default Agent に与える組込ツール構成。
 * - agent_toolset_20260401: bash/read/etc の基本ツール
 * - mcp_toolset (kintone): Worker /mcp 経由でツールを公開 (workerUrl 指定時のみ)
 */
function buildAgentTools(includeMcp: boolean): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = [
    {
      type: 'agent_toolset_20260401',
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
    },
  ];
  if (includeMcp) {
    tools.push({
      type: 'mcp_toolset',
      mcp_server_name: KINTONE_MCP_SERVER_NAME,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
    });
  }
  return tools;
}

function buildMcpServers(workerUrl: string, kintoneDomain: string): Array<Record<string, unknown>> {
  const url = `${workerUrl.replace(/\/$/, '')}/mcp/${kintoneDomain}`;
  return [
    {
      type: 'url',
      name: KINTONE_MCP_SERVER_NAME,
      url,
    },
  ];
}

// ----- in-flight Promise 共有 ------------------------------------------------

const inFlightByKey = new Map<string, Promise<Agent>>();

/** テスト用: in-flight キャッシュをクリアする。プロダクションコードから呼ばないこと */
export function _resetResolveDefaultAgentCache(): void {
  inFlightByKey.clear();
}

// ----- 本体 -----------------------------------------------------------------

export interface ResolveDefaultAgentOptions {
  /** Worker URL。指定すると mcp_servers + mcp_toolset を含む Agent を解決する */
  workerUrl?: string;
  /** kintone ドメイン (例: tenant.cybozu.com)。workerUrl と組で `/mcp/<domain>` を構成 */
  kintoneDomain?: string;
}

/**
 * プラグインが管理する Default Agent を取得する。なければ作成する。
 *
 * workerUrl 指定の有無で別 Agent として扱われる (metadata.workerUrl で分岐)。
 *
 * 並行呼び出しや別プロセスとのレース条件に対して:
 * - 同一プロセス内では (workerUrl 単位で) in-flight Promise を共有
 * - 別プロセス (別タブ) で重複作成された場合は created_at 最古を返す
 */
export async function resolveDefaultAgent(
  options: ResolveDefaultAgentOptions = {},
): Promise<Agent> {
  const key = options.workerUrl ?? '';
  const cached = inFlightByKey.get(key);
  if (cached) return cached;

  const promise = doResolve(options);
  inFlightByKey.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    inFlightByKey.delete(key); // 失敗時はキャッシュ破棄、次回再試行を許可
    throw err;
  }
}

async function doResolve(options: ResolveDefaultAgentOptions): Promise<Agent> {
  const includeMcp = Boolean(options.workerUrl && options.kintoneDomain);
  const filter: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
  };
  if (includeMcp) {
    filter['workerUrl'] = options.workerUrl!;
    filter['kintoneDomain'] = options.kintoneDomain!;
  }

  // 1. 既存 Agent を探索
  const existing = await findDefaultAgents(filter);
  if (existing.length > 0) {
    return pickOldest(existing);
  }

  // 2. 無ければ作成
  const createParams: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    name: DEFAULT_AGENT_NAME,
    system: DEFAULT_AGENT_SYSTEM_PROMPT,
    tools: buildAgentTools(includeMcp),
    metadata: filter,
  };
  if (includeMcp) {
    createParams['mcp_servers'] = buildMcpServers(options.workerUrl!, options.kintoneDomain!);
  }

  const created = await createAgent(createParams as unknown as Parameters<typeof createAgent>[0]);

  // 3. 作成直後に再 list して重複チェック。他プロセスが先行していれば最古を返す
  const verified = await findDefaultAgents(filter);
  if (verified.length > 1) {
    return pickOldest(verified);
  }
  return created;
}

async function findDefaultAgents(filter: Record<string, string>): Promise<Agent[]> {
  return findByMetadata<Agent>((page) => listAgents({ page }), filter);
}
