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

/**
 * system プロンプトのリビジョン番号。プロンプト本文を変更したらこの値を上げる。
 * metadata に含めるので、旧プロンプトの Agent は別物として扱われ、新規 Agent が作成される。
 */
export const DEFAULT_AGENT_PROMPT_VERSION = 'v4';

/**
 * MCP toolset で公開するツール名一覧 (configs を per-tool で指定するため)。
 *
 * 真のソースは [packages/kintone-mcp/src/tools/index.ts](../../../../kintone-mcp/src/tools/index.ts) の
 * `TOOL_NAMES`。プラグインは別バンドルなので import せず手動同期する。ツール追加時は両方を更新すること。
 */
const KINTONE_TOOL_NAMES = [
  'kintone-get-apps',
  'kintone-get-app',
  'kintone-get-form-fields',
  'kintone-get-records',
  'kintone-add-record',
  'kintone-add-records',
  'kintone-update-record',
  'kintone-update-records',
  'kintone-delete-records',
  'kintone-add-record-comment',
] as const;

/** Default Agent の system プロンプト */
export const DEFAULT_AGENT_SYSTEM_PROMPT = [
  'あなたは kintone の業務支援エージェント Cowork Agent です。',
  '`kintone` MCP サーバーが提供する以下のツールを必要に応じて使い、ユーザーの問合せに答えてください。',
  '',
  '【参照系】',
  '  - kintone-get-apps: アプリ一覧',
  '  - kintone-get-app: アプリ単体',
  '  - kintone-get-form-fields: フィールド定義 (フィールドコード・型を確認したいとき)',
  '  - kintone-get-records: レコード取得 (filters / orderBy / limit / offset 対応)',
  '',
  '【追加・更新系】',
  '  - kintone-add-record / kintone-add-records: レコード追加 (バッチ最大 100 件)',
  '  - kintone-update-record / kintone-update-records: レコード更新 (id か updateKey 必須)',
  '  - kintone-add-record-comment: レコードへのコメント追加 (mentions 任意)',
  '',
  '【削除系】',
  '  - kintone-delete-records: レコード削除 (元に戻せない)',
  '',
  '【ガードレール】',
  '  - 更新・削除のような破壊的操作の前は、対象レコード ID と変更内容をユーザに必ず確認してから実行してください。',
  '  - 「全件削除」「全部更新」のような曖昧な指示には必ず一度確認を入れてください。',
  '  - フィールドコードや値型を間違えやすいので、迷ったら kintone-get-form-fields で型を確認してから書き込みツールを呼んでください。',
  '  - ツール呼出でエラーが返ったら、ユーザに分かりやすく状況を説明してください (例: 「レコードが見つかりません」「フィールド X は必須です」など)。',
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
    // Anthropic 側で MCP の write 系ツールが default_config の always_allow を伝播しない
    // ことがあるため、各ツールに per-tool で configs を明示する。
    // configs は { name, enabled, permission_policy } の配列形式 (object map ではない)。
    tools.push({
      type: 'mcp_toolset',
      mcp_server_name: KINTONE_MCP_SERVER_NAME,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
      configs: KINTONE_TOOL_NAMES.map((name) => ({
        name,
        enabled: true,
        permission_policy: { type: 'always_allow' as const },
      })),
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
    promptVersion: DEFAULT_AGENT_PROMPT_VERSION,
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
