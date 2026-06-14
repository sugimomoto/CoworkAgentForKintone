// AgentEditDraft 構築ヘルパー (純関数)。AgentDetailModal の fetch / 「初期値に戻す」で使う。

import { BUILTIN_AGENT_SPECS, KINTONE_TOOL_NAMES } from '../../../core/bootstrap/builtInAgents';
import { extractEnabledTools } from '../../../core/managed-agents/buildAgentTools';

import type { AvailableSkill } from './types';
import type { AgentPurpose, AgentRecord } from '../../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../../core/managed-agents/agentDetailApi';
import type { Agent } from '../../../core/managed-agents/types';

export function isBuiltInPurpose(p: AgentPurpose): p is Exclude<AgentPurpose, 'custom'> {
  return p === 'business' || p === 'customizer-opus' || p === 'customizer-sonnet';
}

/**
 * Anthropic Agent + AgentRecord + availableSkills から AgentEditDraft を構築。
 * `mode='create'` のときは name に「 のコピー」を suffix、isDefault=false に固定。
 */
export function buildDraftFromAgent(
  agent: Agent,
  record: AgentRecord,
  availableSkills: readonly AvailableSkill[],
  modeKind: 'edit' | 'create',
): AgentEditDraft {
  // tools[] から enabledTools を抽出
  const enabledTools = extractEnabledTools(agent.tools);

  // skills[] (Agent response) から Anthropic / custom を分離
  const rawSkills = (agent as unknown as { skills?: Array<{ type?: string; skill_id?: string }> })
    .skills;
  const anthropicSkillIds: string[] = [];
  const customSkillIds: string[] = [];
  if (Array.isArray(rawSkills)) {
    for (const s of rawSkills) {
      if (!s || typeof s.skill_id !== 'string') continue;
      if (s.type === 'anthropic') anthropicSkillIds.push(s.skill_id);
      else if (s.type === 'custom') customSkillIds.push(s.skill_id);
    }
  }

  const baseName = agent.name ?? record.name;
  const suffix = modeKind === 'create' ? ' のコピー' : '';

  return {
    name: `${baseName}${suffix}`,
    description: agent.description ?? record.description,
    iconKind: record.iconKind,
    iconColor: record.iconColor,
    visibility: record.visibility,
    isDefault: modeKind === 'create' ? false : record.isDefault,
    systemPrompt: agent.system ?? '',
    anthropicSkillIds,
    customSkillIds,
    enabledTools,
    quickActions: [...record.quickActions],
    allowedUsers: [...record.allowedUsers],
    allowedGroups: [...record.allowedGroups],
    allowedOrganizations: [...record.allowedOrganizations],
  };
}

/**
 * BUILTIN_AGENT_SPECS の出荷時 spec から AgentEditDraft を構築 (「初期値に戻す」用)。
 * Anthropic Workspace 上の custom skill ID は availableSkills.custom から名前で引き当てる。
 */
export function buildDraftFromSpec(
  spec: (typeof BUILTIN_AGENT_SPECS)[Exclude<AgentPurpose, 'custom'>],
  record: AgentRecord,
  availableSkills: readonly AvailableSkill[],
): AgentEditDraft {
  // custom skill: 名前 (availableSkills.label に skill name を入れている前提) で filter
  const customSkillIds = availableSkills
    .filter((s) => s.type === 'custom' && spec.customSkillFilter(s.label))
    .map((s) => s.skillId);
  return {
    name: spec.name,
    description: spec.description,
    iconKind: spec.iconKind,
    iconColor: spec.iconColor,
    visibility: record.visibility, // visibility は spec に無いので現状値を維持
    isDefault: spec.isDefault,
    systemPrompt: spec.systemPrompt,
    anthropicSkillIds: [...spec.anthropicSkillIds],
    customSkillIds,
    enabledTools: KINTONE_TOOL_NAMES.filter(spec.mcpToolFilter),
    quickActions: [...spec.quickActions],
    // 「初期値に戻す」は全員公開に戻す (built-in は ACL を持たない)
    allowedUsers: [],
    allowedGroups: [],
    allowedOrganizations: [],
  };
}
