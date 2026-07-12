// Cowork Agent for kintone — Default Agent の解決 (legacy パス)
//
// metadata でフィルタした既存 Default Agent があればそれを返す。
// 無ければ新規作成する。
//
// workerUrl + kintoneDomain 指定時は mcp_servers (kintone MCP) と mcp_toolset を
// Agent に登録する。これらの値は metadata にも埋め込まれ、URL が変わると別 Agent と
// して新規作成される (旧 Agent は残置)。
//
// Built-in Agent 3 variant の解決は resolveBuiltInAgents.ts、共有のツール定義は
// agentToolDefs.ts に分離している (Phase 3 PR-A)。

import { AGENT_TYPE, METADATA_SOURCE } from '../constants';
import { createAgent, findByMetadata, listAgents, pickOldest } from '../managed-agents/resources';

import {
  CREATE_ARTIFACT_TOOL,
  DESTRUCTIVE_TOOL_NAMES,
  KINTONE_MCP_SERVER_NAME,
  KINTONE_TOOL_NAMES,
  UPDATE_PLAN_TOOL,
  buildMcpServers,
} from './agentToolDefs';
import {
  DEFAULT_BASE_SYSTEM_PROMPT,
  KINTONE_TOOLS_PROMPT,
  composeSystemPrompt,
} from './commonPrompts';

import type { Agent } from '../managed-agents/types';

/** Default Agent の表示名 (functional-design.md §3.1.3) */
export const DEFAULT_AGENT_NAME = 'Cowork Agent - Default';

/**
 * system プロンプトのリビジョン番号。プロンプト本文を変更したらこの値を上げる。
 * metadata に含めるので、旧プロンプトの Agent は別物として扱われ、新規 Agent が作成される。
 */
export const DEFAULT_AGENT_PROMPT_VERSION = 'v23';

/**
 * Default Agent に attach する Anthropic 製 Skills (Issue #18 Step 1)。
 * Skills は Agent がタスクに応じて自動ロードする再利用可能な知識単位。
 * - xlsx: Excel / CSV の読み書き (kintone への CSV 一括登録 / レポート出力で効く)
 * - docx: Word ドキュメント生成
 * - pdf: PDF からの表構造抽出 / 見積・申請書の取り込み
 * - pptx: PowerPoint プレゼン生成
 *
 * description は context に常駐するが本文 (SKILL.md) は呼ばれた時だけロードされる。
 * Max 20 skills/session の制限あり。
 */
export const DEFAULT_AGENT_SKILLS: ReadonlyArray<{ type: 'anthropic'; skill_id: string }> = [
  { type: 'anthropic', skill_id: 'xlsx' },
  { type: 'anthropic', skill_id: 'docx' },
  { type: 'anthropic', skill_id: 'pdf' },
  { type: 'anthropic', skill_id: 'pptx' },
];

/** Default Agent の system プロンプト */
const DEFAULT_AGENT_INTRO = 'あなたは kintone の業務支援エージェント Cowork Agent です。';

// #141: Default Agent の persona = エージェント固有部 (intro + kintone ツール)。
// 共通の作法/成果物/ファイル規約 (COMMON_BEHAVIOR + COMMON_GUARDRAILS) は commonPrompts の
// DEFAULT_BASE_SYSTEM_PROMPT に集約 (旧: ここへインライン複製していたのを撤去)。
export const DEFAULT_AGENT_PERSONA = composeSystemPrompt(DEFAULT_AGENT_INTRO, KINTONE_TOOLS_PROMPT);

export const DEFAULT_AGENT_SYSTEM_PROMPT = composeSystemPrompt(
  DEFAULT_BASE_SYSTEM_PROMPT,
  DEFAULT_AGENT_PERSONA,
);

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
    // Plugin 側で処理する Custom Tool (Anthropic 側の実行ではない)
    CREATE_ARTIFACT_TOOL as unknown as Record<string, unknown>,
    UPDATE_PLAN_TOOL as unknown as Record<string, unknown>, // #128
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
        permission_policy: {
          type: DESTRUCTIVE_TOOL_NAMES.has(name)
            ? ('always_ask' as const)
            : ('always_allow' as const),
        },
      })),
    });
  }
  return tools;
}

// ----- in-flight Promise 共有 ------------------------------------------------

const inFlightByKey = new Map<string, Promise<Agent>>();

/** テスト用: in-flight キャッシュをクリアする。プロダクションコードから呼ばないこと @internal */
export function _resetResolveDefaultAgentCache(): void {
  inFlightByKey.clear();
}

// ----- 本体 -----------------------------------------------------------------

export interface ResolveDefaultAgentOptions {
  /** Worker URL。指定すると mcp_servers + mcp_toolset を含む Agent を解決する */
  workerUrl?: string;
  /** kintone ドメイン (例: tenant.cybozu.com)。workerUrl と組で `/mcp/<domain>` を構成 */
  kintoneDomain?: string;
  /**
   * Issue #30: 同期済 custom skill の id 一覧。あれば DEFAULT_AGENT_SKILLS (Anthropic 製)
   * に追加で attach される。永続化は Anthropic Workspace に集約しており、bootstrap 側で
   * `/v1/skills?source=custom` を fetch して解決する (Plugin Config には保存しない)。
   */
  customSkillIds?: ReadonlyArray<string>;
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
  // customSkillIds (sorted) も in-flight キーに含める (skill 入替時の Promise 分離)
  const skillsKey = options.customSkillIds ? [...options.customSkillIds].sort().join(',') : '';
  const key = `${options.workerUrl ?? ''}|${skillsKey}`;
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
  //    Anthropic 製 skills (DEFAULT_AGENT_SKILLS) + Plugin 同期済 custom skill を attach
  const skills: Array<{ type: 'anthropic' | 'custom'; skill_id: string }> = [
    ...DEFAULT_AGENT_SKILLS.map((s) => ({ ...s })),
  ];
  if (options.customSkillIds && options.customSkillIds.length > 0) {
    for (const id of options.customSkillIds) {
      skills.push({ type: 'custom', skill_id: id });
    }
  }
  const createParams: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    name: DEFAULT_AGENT_NAME,
    // #141: persona のみ焼き込む (base は session override で注入)。二重 base 回避 +
    // 編集済み persona を session 側が焼き込み system から読めるようにするため。
    system: DEFAULT_AGENT_PERSONA,
    tools: buildAgentTools(includeMcp),
    skills,
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

function findDefaultAgents(filter: Record<string, string>): Promise<Agent[]> {
  return findByMetadata<Agent>((page) => listAgents({ page }), filter);
}
