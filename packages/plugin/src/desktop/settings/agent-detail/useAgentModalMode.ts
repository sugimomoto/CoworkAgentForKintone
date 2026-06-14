// AgentDetailModal のモード状態管理 (localMode / templateId / sourceAgent 算出)。
//
// localMode: 親から渡された mode を同期しつつ「雛形から作り直す」(#48 提案 → create) の
// ローカル遷移を持つ。sourceAgent は現在 form で扱う base Agent を算出する。

import { useEffect, useMemo, useState } from 'react';

import type { AgentDetailModalMode } from './types';
import type { AgentRecord } from '../../../core/bootstrap/agentTypes';

export interface AgentModalMode {
  localMode: AgentDetailModalMode;
  setLocalMode: (next: AgentDetailModalMode) => void;
  isEdit: boolean;
  editAgent: AgentRecord | null;
  isCreateFromProposal: boolean;
  templateId: string;
  setTemplateId: (id: string) => void;
  sourceAgent: AgentRecord | null;
}

export function useAgentModalMode(
  mode: AgentDetailModalMode,
  fallbackTemplates: readonly AgentRecord[] | undefined,
): AgentModalMode {
  const [localMode, setLocalMode] = useState<AgentDetailModalMode>(mode);
  // 親から渡された mode が変わったら localMode も同期する。
  useEffect(() => {
    setLocalMode(mode);
  }, [mode]);

  const isEdit = localMode.kind === 'edit';
  const editAgent: AgentRecord | null = localMode.kind === 'edit' ? localMode.agent : null;
  const isCreateFromProposal = localMode.kind === 'create-from-proposal';

  // create モードでは雛形 ID を state で保持 (templates[0] を初期選択)
  const initialTemplateId = localMode.kind === 'create' ? localMode.templates[0]?.id ?? '' : '';
  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  // localMode が create に切替わったら templateId も初期化
  useEffect(() => {
    if (localMode.kind === 'create') {
      setTemplateId(localMode.templates[0]?.id ?? '');
    }
  }, [localMode]);

  // 現在 form で扱っている Agent。
  // - edit: mode.agent
  // - create: templateId で引いた template
  // - create-from-proposal: fallbackTemplates から Designer (= isDefault) を優先
  const sourceAgent: AgentRecord | null = useMemo(() => {
    if (localMode.kind === 'edit') return localMode.agent;
    if (localMode.kind === 'create') {
      return localMode.templates.find((t) => t.id === templateId) ?? null;
    }
    // create-from-proposal: base に使う Agent を fallbackTemplates から選ぶ。
    // Designer が提案した model に一致する built-in を優先 (= 新 Agent の model 継承)、
    // 無ければ isDefault → 先頭の順でフォールバック。
    const pool = fallbackTemplates ?? [];
    const wantModel = localMode.model;
    return (
      pool.find((t) => t.model === wantModel) ?? pool.find((t) => t.isDefault) ?? pool[0] ?? null
    );
  }, [localMode, templateId, fallbackTemplates]);

  return {
    localMode,
    setLocalMode,
    isEdit,
    editAgent,
    isCreateFromProposal,
    templateId,
    setTemplateId,
    sourceAgent,
  };
}
