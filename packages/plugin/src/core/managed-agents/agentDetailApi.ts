// Cowork Agent for kintone — Agent 詳細編集 / Custom Agent 追加 API ラッパ (#40)
//
// AgentDetailModal から呼ばれる 3 種の操作を提供する:
//   - applyAgentEdit: 既存 Agent (built-in / custom) を編集して update
//   - createCustomAgentFrom: 雛形 Agent から派生する新規 Custom Agent を作成
//   - archiveAgentById: Custom Agent をアーカイブ (built-in は UI で呼ばせない)
//
// metadata の構造は resolveAgent.ts のものを踏襲し、Anthropic Workspace 上で
// find filter (purpose / workerUrl / kintoneDomain 等) が壊れないようにする。

import {
  META_KEY_ALLOWED_GROUPS,
  META_KEY_ALLOWED_ORGANIZATIONS,
  META_KEY_ALLOWED_USERS,
  META_KEY_QUICK_ACTIONS,
} from '../bootstrap/agentTypes';
import { KINTONE_MCP_SERVER_NAME } from '../bootstrap/resolveAgent';
import { AGENT_TYPE, METADATA_SOURCE } from '../constants';

import { buildAgentTools } from './buildAgentTools';
import {
  archiveAgent as archiveAgentResource,
  createAgent,
  retrieveAgent,
  updateAgent,
} from './resources';

import type { Agent } from './types';
import type { AgentColor, AgentGlyph } from '../bootstrap/agentTypes';
import type { KintoneToolName } from '../bootstrap/builtInAgents';

/**
 * AgentDetailModal の編集状態 (form values)。
 * model / purpose / variantGroup は不変なので含めない (UI からも編集不可)。
 */
export interface AgentEditDraft {
  name: string;
  description: string;
  iconKind: AgentGlyph;
  iconColor: AgentColor;
  visibility: 'public' | 'private';
  isDefault: boolean;
  systemPrompt: string;
  /** 選択された Anthropic 製 skill ID (例: xlsx / docx / pdf / pptx) */
  anthropicSkillIds: readonly string[];
  /** 選択された custom skill ID (Anthropic Workspace の skill_id) */
  customSkillIds: readonly string[];
  /** ON にされた kintone MCP tool 名 */
  enabledTools: readonly KintoneToolName[];
  /**
   * クイックアクション (PresetAgentLanding で並ぶワンクリック実行ボタン)。
   * Custom Agent のみ admin が編集可能。Built-in は spec カタログ側で固定 (本フィールドは UI 上 disabled)。
   * 保存時に metadata.quickActions に JSON 配列文字列として永続化。
   */
  quickActions: readonly string[];
  /**
   * #47 公開先 ACL — 0 件 = 全員に公開、いずれか指定 = OR 結合。
   * 保存時に metadata.allowedUsers / allowedGroups / allowedOrganizations へ
   * それぞれ JSON 配列文字列として永続化。空配列なら key 自体を削除。
   */
  allowedUsers: readonly string[];
  allowedGroups: readonly string[];
  allowedOrganizations: readonly string[];
}

/** skill 配列を Anthropic API に渡す形式に変換 */
function buildAgentSkills(
  draft: Pick<AgentEditDraft, 'anthropicSkillIds' | 'customSkillIds'>,
): Array<{ type: 'anthropic' | 'custom'; skill_id: string }> {
  return [
    ...draft.anthropicSkillIds.map((id) => ({ type: 'anthropic' as const, skill_id: id })),
    ...draft.customSkillIds.map((id) => ({ type: 'custom' as const, skill_id: id })),
  ];
}

/**
 * Draft の UI 補助情報を既存 metadata に merge する。
 * 空配列の quickActions は key を含めず、merge 時に削除されたものとして扱う。
 */
function mergeMetadataPatch(
  existing: Record<string, string> | null | undefined,
  draft: AgentEditDraft,
): Record<string, string> {
  const merged: Record<string, string> = {
    ...(existing ?? {}),
    iconKind: draft.iconKind,
    iconColor: draft.iconColor,
    visibility: draft.visibility,
    isDefault: draft.isDefault ? '1' : '0',
  };
  setOrDeleteJsonArrayKey(merged, META_KEY_QUICK_ACTIONS, draft.quickActions);
  setOrDeleteJsonArrayKey(merged, META_KEY_ALLOWED_USERS, draft.allowedUsers);
  setOrDeleteJsonArrayKey(merged, META_KEY_ALLOWED_GROUPS, draft.allowedGroups);
  setOrDeleteJsonArrayKey(merged, META_KEY_ALLOWED_ORGANIZATIONS, draft.allowedOrganizations);
  return merged;
}

/** 値あり → JSON 化して set / 空配列 → key 自体を削除。 */
function setOrDeleteJsonArrayKey(
  merged: Record<string, string>,
  key: string,
  arr: readonly string[],
): void {
  if (arr.length > 0) {
    merged[key] = JSON.stringify(arr);
  } else {
    delete merged[key];
  }
}

/**
 * 既存 Agent (built-in / custom 両方) を編集して update。
 *
 * 動作:
 *   1. retrieveAgent(id) で最新 metadata を取得 (find filter 列の維持に必要)
 *   2. mergeMetadataPatch で UI 補助情報を上書き
 *   3. updateAgent(id, { name, description, system, tools, skills, metadata })
 */
export async function applyAgentEdit(
  agentId: string,
  draft: AgentEditDraft,
): Promise<Agent> {
  const existing = await retrieveAgent(agentId);
  return updateAgent(agentId, {
    version: existing.version,
    name: draft.name,
    description: draft.description,
    system: draft.systemPrompt,
    tools: buildAgentTools(draft.enabledTools),
    skills: buildAgentSkills(draft),
    metadata: mergeMetadataPatch((existing.metadata ?? null) as Record<string, string> | null, draft),
  });
}

/**
 * 雛形 Agent をベースに新規 Custom Agent を作成。
 *
 * 動作:
 *   1. retrieveAgent(baseAgentId) で base の model / metadata / mcp_servers を取得
 *   2. metadata は base の find filter 列 (workerUrl / kintoneDomain / promptVersion) を
 *      引き継ぎつつ、purpose='custom' に上書き
 *   3. createAgent({ model: base.model, name: draft.name, ... })
 *
 * 注意: variantGroup は引き継がない (custom は独立 Agent 扱い)。
 */
export async function createCustomAgentFrom(args: {
  baseAgentId: string;
  draft: AgentEditDraft;
}): Promise<Agent> {
  const base = await retrieveAgent(args.baseAgentId);
  const baseMeta = (base.metadata ?? {}) as Record<string, string>;

  // find filter 列 (再 bootstrap で重複検知させる用) を base から引き継ぎつつ
  // mergeMetadataPatch で UI 補助情報を上書きする (空 quickActions = key 不在)。
  const carriedBase: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
    purpose: 'custom',
    ...(baseMeta.workerUrl ? { workerUrl: baseMeta.workerUrl } : {}),
    ...(baseMeta.kintoneDomain ? { kintoneDomain: baseMeta.kintoneDomain } : {}),
    ...(baseMeta.promptVersion ? { promptVersion: baseMeta.promptVersion } : {}),
  };
  // Custom は variantGroup なし (built-in 専用) — base からも明示的に拾わない。
  const metadata = mergeMetadataPatch(carriedBase, args.draft);

  return createAgent({
    model: base.model,
    name: args.draft.name,
    description: args.draft.description,
    system: args.draft.systemPrompt,
    tools: buildAgentTools(args.draft.enabledTools),
    skills: buildAgentSkills(args.draft),
    mcp_servers: extractMcpServers(base),
    metadata,
  });
}

/**
 * Custom Agent をアーカイブ (Anthropic 仕様で論理削除)。
 * built-in は UI 側でガード (呼ばれない)。本関数自体は purpose 判定をしないので、
 * 誤って built-in に対して呼ばないこと。
 */
export async function archiveAgentById(agentId: string): Promise<void> {
  await archiveAgentResource(agentId);
}

/**
 * Agent から mcp_servers 設定を取り出す (新 Custom Agent に同じ MCP を attach するため)。
 * Anthropic の Agent.mcp_servers は API レスポンスに含まれない可能性があるので、
 * 取れなければ空配列を返す (= MCP 無し Custom Agent)。
 */
function extractMcpServers(agent: Agent): unknown[] {
  const raw = (agent as unknown as { mcp_servers?: unknown }).mcp_servers;
  if (Array.isArray(raw) && raw.length > 0) return raw as unknown[];
  // フォールバック: metadata から workerUrl / kintoneDomain を読んで再構築
  const meta = (agent.metadata ?? {}) as Record<string, string>;
  if (meta.workerUrl && meta.kintoneDomain) {
    const url = `${meta.workerUrl.replace(/\/$/, '')}/mcp/${meta.kintoneDomain}`;
    return [{ type: 'url', name: KINTONE_MCP_SERVER_NAME, url }];
  }
  return [];
}
