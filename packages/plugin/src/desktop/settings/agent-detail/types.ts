import type { AgentRecord } from '../../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../../core/managed-agents/agentDetailApi';

export interface AvailableSkill {
  /** Anthropic Workspace の skill_id (custom skill では Anthropic 払出 ID) */
  skillId: string;
  /** Anthropic 製 skill (xlsx/docx/...) の場合 'anthropic'、Plugin/Custom なら 'custom' */
  type: 'anthropic' | 'custom';
  /** UI 表示用ラベル */
  label: string;
}

export type AgentDetailModalMode =
  | { kind: 'edit'; agent: AgentRecord }
  | { kind: 'create'; templates: readonly AgentRecord[] }
  | {
      // #48 Designer の propose_agent 受信時に開くモード。
      // 雛形プルダウンは出さず、draft で全項目初期化。「雛形から作り直す」リンクで
      // fallbackTemplates を使った通常の create モードに切替えられる。
      kind: 'create-from-proposal';
      draft: AgentEditDraft;
      rationale: string;
      /** 提案された model。base 雛形の選定に使う (AgentEditDraft には載せない) */
      model: 'opus' | 'sonnet';
    };
