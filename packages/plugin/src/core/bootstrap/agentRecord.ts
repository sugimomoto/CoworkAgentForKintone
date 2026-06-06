// Cowork Agent for kintone — Anthropic Agent → AgentRecord 変換ヘルパー
//
// metadata から UI 補助情報を読み、Plugin UI 用 AgentRecord に揃える。
// Built-in (purpose=business/customizer-*) は BUILTIN_AGENT_SPECS の値で
// 不在 metadata を補完する。Custom (purpose=custom) は metadata 100% 依存。

import { BUILTIN_AGENT_SPECS } from './builtInAgents';
import { META_KEY_QUICK_ACTIONS } from './agentTypes';

import type {
  AgentColor,
  AgentGlyph,
  AgentPurpose,
  AgentRecord,
  AgentVariantGroup,
} from './agentTypes';
import type { Agent } from '../managed-agents/types';

type BuiltInPurpose = Exclude<AgentPurpose, 'custom'>;

function isBuiltInPurpose(p: string): p is BuiltInPurpose {
  return p === 'business' || p === 'customizer-opus' || p === 'customizer-sonnet';
}

/**
 * Anthropic Agent オブジェクトを AgentRecord に変換する。
 *
 * 動作:
 *   - metadata.purpose を見て built-in / custom を判別
 *   - built-in なら BUILTIN_AGENT_SPECS から不在 metadata を補完
 *   - custom なら metadata に全部入っている前提 (作成時に必ず埋める)
 *
 * 不正な metadata でも UI が崩れないように、すべて optional + fallback。
 */
export function agentToRecord(agent: Agent): AgentRecord {
  const meta = (agent.metadata ?? {}) as Record<string, string>;
  const rawPurpose = meta.purpose ?? 'custom';

  if (isBuiltInPurpose(rawPurpose)) {
    const spec = BUILTIN_AGENT_SPECS[rawPurpose];
    return {
      id: agent.id,
      name: agent.name ?? spec.name,
      model: spec.modelKind,
      modelLabel: spec.modelLabel,
      description: agent.description ?? spec.description,
      purpose: rawPurpose,
      iconKind: (meta.iconKind as AgentGlyph) ?? spec.iconKind,
      iconColor: (meta.iconColor as AgentColor) ?? spec.iconColor,
      visibility: meta.visibility === 'private' ? 'private' : 'public',
      isDefault: meta.isDefault === '1' || (meta.isDefault == null && spec.isDefault),
      ...(spec.variantGroup ? { variantGroup: spec.variantGroup } : {}),
      source: 'builtin',
      quickActions: spec.quickActions,
    };
  }

  // Custom Agent
  const model = parseModelKind(agent.model);
  return {
    id: agent.id,
    name: agent.name ?? 'カスタム エージェント',
    model: model.kind,
    modelLabel: model.label,
    description: agent.description ?? '',
    purpose: 'custom',
    iconKind: (meta.iconKind as AgentGlyph) ?? 'ai',
    iconColor: (meta.iconColor as AgentColor) ?? 'teal',
    visibility: meta.visibility === 'private' ? 'private' : 'public',
    isDefault: meta.isDefault === '1',
    ...(meta.variantGroup === 'customizer'
      ? { variantGroup: 'customizer' as AgentVariantGroup }
      : {}),
    source: 'custom',
    quickActions: parseQuickActions(meta[META_KEY_QUICK_ACTIONS]),
  };
}

/**
 * Anthropic Agent.metadata.quickActions (JSON 配列の文字列) を string[] に復元する。
 * 不正形式は無視して空配列を返す (UI 側は配列前提)。
 */
function parseQuickActions(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
    }
  } catch {
    // 不正 JSON は黙って捨てる
  }
  return [];
}

/**
 * Anthropic Agent.model (string | { id, speed }) を AgentRecord の model / modelLabel に変換。
 * 既知の opus / sonnet 以外は sonnet 扱い (UI 用フォールバック)。
 */
function parseModelKind(
  raw: Agent['model'] | string | undefined,
): { kind: 'opus' | 'sonnet'; label: 'OPUS' | 'SONNET' } {
  const id =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'id' in raw
        ? (raw as { id: string }).id
        : '';
  if (id.toLowerCase().includes('opus')) {
    return { kind: 'opus', label: 'OPUS' };
  }
  return { kind: 'sonnet', label: 'SONNET' };
}
