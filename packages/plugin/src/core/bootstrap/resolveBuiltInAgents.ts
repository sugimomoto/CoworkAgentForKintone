// Cowork Agent for kintone — Built-in Agent 3 variant の解決 (Customizer wedge V1)
//
// resolveDefaultAgent (legacy) とは独立した解決パス。3 variant (業務 / Customizer Opus /
// Customizer Sonnet) を Promise.all で並行 ensure する。
//
// 各 variant は metadata.purpose で識別され、別々の Agent として workspace に
// 登録される (Anthropic API は Agent 定義に model を bind するため、model 違いは
// 別 Agent にせざるを得ない — design.md §3.1)。
//
// 仕様: requirements.md §6.3, §6.4.1 / design.md §3

import { AGENT_TYPE, METADATA_SOURCE } from '../constants';
import { ApiError } from '../managed-agents/client';
import {
  createAgent,
  findByMetadata,
  listAgents,
  pickOldest,
  retrieveAgent,
  updateAgent,
} from '../managed-agents/resources';

import {
  CREATE_ARTIFACT_TOOL,
  KINTONE_MCP_SERVER_NAME,
  PROPOSE_AGENT_TOOL,
  buildMcpServers,
} from './agentToolDefs';
import {
  BUILTIN_AGENT_SPECS,
  KINTONE_TOOL_NAMES as BUILTIN_KINTONE_TOOL_NAMES,
  DESTRUCTIVE_TOOL_NAMES as BUILTIN_DESTRUCTIVE_TOOL_NAMES,
} from './builtInAgents';

import type { AgentPurpose } from './agentTypes';
import type { BuiltInAgentSpec, KintoneToolName } from './builtInAgents';
import type { Agent } from '../managed-agents/types';

type BuiltInPurpose = Exclude<AgentPurpose, 'custom'>;

/** resolveBuiltInAgents の戻り値構造 (3 variant 同時) */
export interface BuiltInAgentSet {
  business: Agent;
  customizerOpus: Agent;
  customizerSonnet: Agent;
}

export interface ResolveBuiltInAgentsOptions {
  /** Worker URL。mcp_servers + mcp_toolset を含めるなら必須 */
  workerUrl: string;
  /** kintone ドメイン (例: tenant.cybozu.com)。workerUrl と組で `/mcp/<domain>` を構成 */
  kintoneDomain: string;
  /** Plugin 同期済 custom skill の id 一覧。各 variant の customSkillFilter で再 filter される */
  customSkillIds?: ReadonlyArray<string>;
}

/** purpose 単位の in-flight Promise (同一プロセス内のレース対策) */
const builtInInFlight = new Map<string, Promise<Agent>>();

/** テスト用: in-flight キャッシュをクリアする @internal */
export function _resetResolveBuiltInAgentsCache(): void {
  builtInInFlight.clear();
}

function findDefaultAgents(filter: Record<string, string>): Promise<Agent[]> {
  return findByMetadata<Agent>((page) => listAgents({ page }), filter);
}

/**
 * V1 で auto-ensure される 3 variant の Built-in Agent をまとめて取得する。
 *
 * - 既存があれば pickOldest を返す (別タブ / 別プロセスとの作成レース対策)
 * - 3 variant を Promise.all で並行 ensure (in-flight キャッシュは purpose 単位)
 * - metadata.purpose / promptVersion / kintoneDomain で variant 識別
 */
export async function resolveBuiltInAgents(
  options: ResolveBuiltInAgentsOptions,
): Promise<BuiltInAgentSet> {
  const [business, customizerOpus, customizerSonnet] = await Promise.all([
    resolveBuiltInOne('business', options),
    resolveBuiltInOne('customizer-opus', options),
    resolveBuiltInOne('customizer-sonnet', options),
  ]);
  return { business, customizerOpus, customizerSonnet };
}

async function resolveBuiltInOne(
  purpose: BuiltInPurpose,
  options: ResolveBuiltInAgentsOptions,
): Promise<Agent> {
  const spec = BUILTIN_AGENT_SPECS[purpose];
  const skillsKey = options.customSkillIds ? [...options.customSkillIds].sort().join(',') : '';
  const key = [purpose, options.workerUrl, options.kintoneDomain, spec.promptVersion, skillsKey].join(
    '|',
  );

  const cached = builtInInFlight.get(key);
  if (cached) return cached;

  const promise = doResolveBuiltIn(purpose, spec, options);
  builtInInFlight.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    builtInInFlight.delete(key);
    throw err;
  }
}

async function doResolveBuiltIn(
  purpose: BuiltInPurpose,
  spec: BuiltInAgentSpec,
  options: ResolveBuiltInAgentsOptions,
): Promise<Agent> {
  // tool 構成から導出する版数。tool を変えれば変化し、既存エージェントの reconcile を駆動する。
  const toolsVersion = computeToolsVersion(purpose, spec);

  // metadata は find filter にも create body にも同じ key で渡す (完全一致で再 list 可能)。
  // toolsVersion は filter には含めない (= エージェント identity は据え置き、tools だけ追従させる)。
  const filter: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
    purpose,
    promptVersion: spec.promptVersion,
    workerUrl: options.workerUrl,
    kintoneDomain: options.kintoneDomain,
  };

  // 1. 既存 Agent を探索 → 見つかれば tool ドリフトを reconcile して返す (ID 保持)
  const existing = await findDefaultAgents(filter);
  if (existing.length > 0) {
    return reconcileBuiltInAgentTools(pickOldest(existing), purpose, spec, toolsVersion);
  }

  // 2. 無ければ作成
  const skills: Array<{ type: 'anthropic' | 'custom'; skill_id: string }> = [
    ...spec.anthropicSkillIds.map((id) => ({ type: 'anthropic' as const, skill_id: id })),
  ];
  if (options.customSkillIds && options.customSkillIds.length > 0) {
    for (const id of options.customSkillIds) {
      if (spec.customSkillFilter(id)) {
        skills.push({ type: 'custom', skill_id: id });
      }
    }
  }

  // metadata には UI 補助情報 (iconKind / iconColor / variantGroup / isDefault / visibility) も含める
  // (find filter には影響しないが、再 list 時に Plugin がここから読む)
  const fullMetadata: Record<string, string> = {
    ...filter,
    toolsVersion,
    iconKind: spec.iconKind,
    iconColor: spec.iconColor,
    isDefault: spec.isDefault ? '1' : '0',
    visibility: 'public', // V1 既定 (admin が後で変更可能)
  };
  if (spec.variantGroup) {
    fullMetadata['variantGroup'] = spec.variantGroup;
  }

  const createParams: Record<string, unknown> = {
    model: spec.model,
    name: spec.name,
    system: spec.systemPrompt,
    tools: buildBuiltInAgentTools(purpose, spec),
    skills,
    metadata: fullMetadata,
    mcp_servers: buildMcpServers(options.workerUrl, options.kintoneDomain),
  };

  const created = await createAgent(createParams as unknown as Parameters<typeof createAgent>[0]);

  // 3. 作成直後に再 list して重複チェック (別タブ・別プロセスとのレース対策)
  const verified = await findDefaultAgents(filter);
  if (verified.length > 1) {
    return pickOldest(verified);
  }
  return created;
}

/**
 * Built-in Agent 用のツール構成。spec.mcpToolFilter で per-variant に kintone MCP
 * ツールを絞り込む。purpose='customizer-opus' (= エージェントデザイナー、#48) のみ
 * `propose_agent` Custom Tool を追加 attach する。
 */
function buildBuiltInAgentTools(
  purpose: BuiltInPurpose,
  spec: BuiltInAgentSpec,
): Array<Record<string, unknown>> {
  const filteredTools = BUILTIN_KINTONE_TOOL_NAMES.filter((name) => spec.mcpToolFilter(name));
  const baseTools: Array<Record<string, unknown>> = [
    {
      type: 'agent_toolset_20260401',
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
    },
    CREATE_ARTIFACT_TOOL as unknown as Record<string, unknown>,
  ];
  if (purpose === 'customizer-opus') {
    baseTools.push(PROPOSE_AGENT_TOOL as unknown as Record<string, unknown>);
  }
  return [
    ...baseTools,
    {
      type: 'mcp_toolset',
      mcp_server_name: KINTONE_MCP_SERVER_NAME,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
      configs: filteredTools.map((name: KintoneToolName) => ({
        name,
        enabled: true,
        permission_policy: {
          type: BUILTIN_DESTRUCTIVE_TOOL_NAMES.has(name)
            ? ('always_ask' as const)
            : ('always_allow' as const),
        },
      })),
    },
  ];
}

/**
 * 既存 Built-in Agent の tool 構成を現行 spec に追従させる (#86 ツールドリフト修復)。
 *
 * find-or-create は promptVersion 等の identity で既存を再利用するだけで tools を更新しないため、
 * propose_agent 未配線の中間ビルドで作られたエージェント等で tools が古いまま固定されてしまう。
 * metadata.toolsVersion を現行値と突き合わせ、不一致なら updateAgent で tools を上書きする
 * (エージェント ID は保持 = 過去セッション参照・variantGroup 切替に影響しない)。
 *
 * 楽観ロック (Anthropic 仕様で updateAgent は version 必須) のため、409 衝突時は retrieve して再試行。
 * 別タブ/別プロセスが先に最新へ更新済みなら、それを採用して終了する。
 */
async function reconcileBuiltInAgentTools(
  agent: Agent,
  purpose: BuiltInPurpose,
  spec: BuiltInAgentSpec,
  toolsVersion: string,
): Promise<Agent> {
  if (agent.metadata['toolsVersion'] === toolsVersion) {
    return agent; // 最新 — 何もしない (通常パス)
  }

  const tools = buildBuiltInAgentTools(purpose, spec);
  let version = agent.version;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await updateAgent(agent.id, {
        version,
        tools,
        metadata: { ...agent.metadata, toolsVersion },
      });
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      if (!conflict || attempt === 2) throw err;
      // 別タブ/別プロセスが先に更新 → 最新を取り直して判定
      const fresh = await retrieveAgent(agent.id);
      if (fresh.metadata['toolsVersion'] === toolsVersion) return fresh;
      version = fresh.version;
    }
  }
  return agent; // 到達しない (ループ内で return/throw する)
}

/**
 * tool 構成の意味的シグネチャから安定した版数文字列を導出する。
 *
 * `buildBuiltInAgentTools` の生 JSON ではなく「tool の有無 + 破壊的ツールの権限ポリシー」だけを
 * ハッシュ対象にする (出力のキー順など見た目だけの変更で版数が動かないように)。env 依存値
 * (workerUrl / kintoneDomain) は find filter 側にあるためここには含めない。
 */
function computeToolsVersion(purpose: BuiltInPurpose, spec: BuiltInAgentSpec): string {
  const mcpSig = BUILTIN_KINTONE_TOOL_NAMES.filter((name) => spec.mcpToolFilter(name))
    .slice()
    .sort()
    .map((name) => (BUILTIN_DESTRUCTIVE_TOOL_NAMES.has(name) ? `${name}!` : name))
    .join(',');
  const parts = [
    'agent_toolset_20260401',
    'create_artifact',
    ...(purpose === 'customizer-opus' ? ['propose_agent'] : []),
    `mcp:${mcpSig}`,
  ];
  return `ts_${djb2(parts.join('|'))}`;
}

/** purpose に対応する現行 toolsVersion (テスト / 参照用)。 */
export function builtInToolsVersion(purpose: BuiltInPurpose): string {
  return computeToolsVersion(purpose, BUILTIN_AGENT_SPECS[purpose]);
}

/** 32bit djb2 → base36。決定的でプロセス間でも安定 (Math.random / Date 不使用)。 */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (((hash << 5) + hash) + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * テナント (kintoneDomain) に紐づく Custom Agent (purpose=custom) を全て取得する。
 *
 * bootstrap 時に built-in 3 variant と並列で呼ぶ。`initializeSession` でこれを
 * `agentToRecord` で変換して `chatStore.builtInAgents` に積めば、ページ再読込でも
 * Workspace 上の Custom Agent が UI に出続ける。
 *
 * Anthropic の archive 機構は API レスポンスに `archive_state` 等を含むことがあるが、
 * 念のため Plugin 側でも archived 相当のものを除外する (= null / 未設定のみ通す)。
 */
export async function listCustomAgents(options: {
  workerUrl: string;
  kintoneDomain: string;
}): Promise<Agent[]> {
  const filter: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
    purpose: 'custom',
    workerUrl: options.workerUrl,
    kintoneDomain: options.kintoneDomain,
  };
  const found = await findByMetadata<Agent>((page) => listAgents({ page }), filter);
  return found.filter((a) => !isArchivedAgent(a));
}

function isArchivedAgent(agent: Agent): boolean {
  const a = agent as unknown as { archive_state?: unknown; archived?: unknown };
  if (a.archive_state && a.archive_state !== 'active' && a.archive_state !== null) return true;
  if (a.archived === true) return true;
  return false;
}
