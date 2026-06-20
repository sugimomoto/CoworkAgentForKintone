// Cowork Agent for kintone — Anthropic Agent → AgentRecord 変換ヘルパー
//
// metadata から UI 補助情報を読み、Plugin UI 用 AgentRecord に揃える。
// Built-in (purpose=business/customizer-*) は BUILTIN_AGENT_SPECS の値で
// 不在 metadata を補完する。Custom (purpose=custom) は metadata 100% 依存。

import {
  META_KEY_ALLOWED_GROUPS,
  META_KEY_ALLOWED_ORGANIZATIONS,
  META_KEY_ALLOWED_USERS,
  META_KEY_QUICK_ACTIONS,
} from './agentTypes';
import { BUILTIN_AGENT_SPECS } from './builtInAgents';
import { readNotifyRecordFields } from './notifyRegistration';

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
      // #75: quickActions / ACL は built-in でも metadata に保存されるので、読込側も
      // metadata を優先する (未設定時のみ spec / 空配列にフォールバック)。
      ...readBuiltInEditableFields(meta, spec.quickActions),
      ...readNotifyRecordFields(meta),
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
    quickActions: parseJsonStringArray(meta[META_KEY_QUICK_ACTIONS]),
    allowedUsers: parseJsonStringArray(meta[META_KEY_ALLOWED_USERS]),
    allowedGroups: parseJsonStringArray(meta[META_KEY_ALLOWED_GROUPS]),
    allowedOrganizations: parseJsonStringArray(meta[META_KEY_ALLOWED_ORGANIZATIONS]),
    ...readNotifyRecordFields(meta),
  };
}

/**
 * built-in Agent の編集可能フィールド (quickActions / 公開先 ACL) を metadata から復元する (#75)。
 *
 * 書き込みは built-in / custom 共通で metadata に入る (mergeMetadataPatch) のに、従来 built-in の
 * 読込は spec 固定 / ACL 空配列で metadata を無視していたため「保存しても反映されない」状態だった。
 * metadata を優先し、未設定のときだけ spec.quickActions / 空配列にフォールバックする。
 *
 * 注: 空配列の保存は write 側 (setOrDeleteJsonArrayKey) で key 削除されるため、built-in の
 * quickActions を「意図的に空」にはできず spec 値に戻る (ACL は空=全員公開なので問題ない)。
 *
 * bootstrap 経路 (initializeSession の built-in 変換) と保存後リフレッシュ経路 (本ファイル) の
 * 両方から呼び、読込ロジックの二重化 (= 本バグの再発) を防ぐ。
 */
export function readBuiltInEditableFields(
  meta: Record<string, string>,
  specQuickActions: readonly string[],
): Pick<AgentRecord, 'quickActions' | 'allowedUsers' | 'allowedGroups' | 'allowedOrganizations'> {
  const rawQuick = meta[META_KEY_QUICK_ACTIONS];
  return {
    quickActions: rawQuick !== undefined ? parseJsonStringArray(rawQuick) : specQuickActions,
    allowedUsers: parseJsonStringArray(meta[META_KEY_ALLOWED_USERS]),
    allowedGroups: parseJsonStringArray(meta[META_KEY_ALLOWED_GROUPS]),
    allowedOrganizations: parseJsonStringArray(meta[META_KEY_ALLOWED_ORGANIZATIONS]),
  };
}

/**
 * Anthropic Agent.metadata 上の JSON 配列文字列 (quickActions / allowedUsers 等) を
 * string[] に復元する。不正形式・空文字列・配列以外は silent fallback で空配列を返す。
 */
function parseJsonStringArray(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
    }
  } catch {
    /* 不正 JSON は黙って捨てる (= UI 起動を最優先) */
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
