// Cowork Agent for kintone — 現在の Agent の purpose 取得 hook (V1 P4.5.3)
//
// Customizer Artifact 判定 (kind=code + language=js + purpose=customizer) で
// WorkflowFooter / FileTree の表示可否を決める。

import { useChatStore } from '../../store/chatStore';

import type { AgentPurpose } from '../../core/bootstrap/agentTypes';

/**
 * 現在の Agent の purpose を返す。未 bootstrap (builtInAgents 空) の場合は null。
 */
export function useCurrentAgentPurpose(): AgentPurpose | null {
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const builtInAgents = useChatStore((s) => s.builtInAgents);

  if (!currentAgentId) return null;
  const current = builtInAgents.find((a) => a.id === currentAgentId);
  return current?.purpose ?? null;
}

/** purpose が customizer-* かどうかを判定するユーティリティ */
export function isCustomizerPurpose(purpose: AgentPurpose | null | undefined): boolean {
  if (!purpose) return false;
  return purpose === 'customizer-opus' || purpose === 'customizer-sonnet';
}
