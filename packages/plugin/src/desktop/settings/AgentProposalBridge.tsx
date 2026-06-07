// AgentProposalBridge — #48 エージェントデザイナーの propose_agent 受信時に
// AgentDetailModal を `create-from-proposal` モードで開く軽量ブリッジ。
//
// ChatPanel が無条件 mount し、`chatStore.pendingAgentProposal` を購読する。
// 値が入っていれば modal を描画、null ならば何も描画しない。
//
// 保存時は `createCustomAgentFrom({ baseAgentId, draft })` を呼び、
// 新規 Custom Agent を builtInAgents に upsert + pendingAgentProposal を null に戻す。

import { useCallback, useMemo } from 'react';

import { agentToRecord } from '../../core/bootstrap/agentRecord';
import { createCustomAgentFrom } from '../../core/managed-agents/agentDetailApi';
import { retrieveAgent } from '../../core/managed-agents/resources';
import { useChatStore } from '../../store/chatStore';

import { AgentDetailModal, type AvailableSkill } from './AgentDetailModal';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../core/managed-agents/agentDetailApi';

/**
 * 提案モーダル用の最小 availableSkills。
 * Designer が出す `anthropicSkillIds` は xlsx/docx/pdf/pptx の 4 種に enum 限定されており、
 * bundled / custom skill は admin が後で「編集」画面から追加できるので、
 * Phase 1 では Anthropic 製 4 つだけ表示する。
 */
const PROPOSAL_AVAILABLE_SKILLS: readonly AvailableSkill[] = [
  { skillId: 'xlsx', type: 'anthropic', label: 'xlsx (Excel/CSV)' },
  { skillId: 'docx', type: 'anthropic', label: 'docx (Word)' },
  { skillId: 'pdf', type: 'anthropic', label: 'pdf (PDF 解析)' },
  { skillId: 'pptx', type: 'anthropic', label: 'pptx (PowerPoint)' },
];

export function AgentProposalBridge(): JSX.Element | null {
  const pending = useChatStore((s) => s.pendingAgentProposal);
  const setPending = useChatStore((s) => s.setPendingAgentProposal);
  const builtInAgents = useChatStore((s) => s.builtInAgents);
  const upsertAgent = useChatStore((s) => s.upsertAgent);

  const mode = useMemo(
    () =>
      pending
        ? ({
            kind: 'create-from-proposal',
            draft: pending.draft,
            rationale: pending.rationale,
            model: pending.model,
          } as const)
        : null,
    [pending],
  );

  const handleSave = useCallback(
    async (draft: AgentEditDraft, sourceAgent: AgentRecord) => {
      const created = await createCustomAgentFrom({ baseAgentId: sourceAgent.id, draft });
      upsertAgent(agentToRecord(created));
      setPending(null);
    },
    [upsertAgent, setPending],
  );

  const handleClose = useCallback(() => setPending(null), [setPending]);

  if (!mode) return null;

  return (
    <AgentDetailModal
      mode={mode}
      fetchAgent={retrieveAgent}
      onSave={handleSave}
      availableSkills={PROPOSAL_AVAILABLE_SKILLS}
      fallbackTemplates={builtInAgents}
      onClose={handleClose}
    />
  );
}
