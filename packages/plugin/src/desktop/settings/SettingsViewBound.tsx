// Cowork Agent for kintone — SettingsView と chatStore / Anthropic API のアダプタ
//
// ChatPanel.tsx から渡される onClose / onPluginConfigClick を受け取り、SkillsPane と
// AgentsListPane に必要なハンドラ (同期 / 公開トグル等) を bind する container component。
//
// 責務:
//   - chatStore.builtInAgents の購読 + 公開トグル更新後の反映
//   - Plugin Config 経由で bundledSkills の同期状態を算出
//   - syncBundledSkillsFromChatPanel / syncCustomSkillFromChatPanel の呼出
//   - setAgentVisibility の呼出 (visibility 更新)

import { useCallback } from 'react';

import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { setAgentVisibility } from '../../core/managed-agents/agentVisibility';
import {
  syncBundledSkillsFromChatPanel,
  syncCustomSkillFromChatPanel,
} from '../../core/skills/chatPanelSkillsSync';
import { SKILL_BUNDLES, SKILLS_VERSION } from '../../generated/skills-bundle';
import { useChatStore } from '../../store/chatStore';

import { SettingsView } from './SettingsView';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { CustomSkillInput } from './SkillAddModal';
import type { BundledSkillEntry } from './SkillsPane';

export interface SettingsViewBoundProps {
  /** Settings View を閉じる (Conversation View に戻る) */
  onClose: () => void;
  /** Plugin Config 画面を開く (kintone admin 画面、SettingsView Nav 下部リンク) */
  onPluginConfigClick?: () => void;
}

export function SettingsViewBound({
  onClose,
  onPluginConfigClick,
}: SettingsViewBoundProps): JSX.Element {
  const builtInAgents = useChatStore((s) => s.builtInAgents);
  const setBuiltInAgents = useChatStore((s) => s.setBuiltInAgents);
  const pluginId = useChatStore((s) => s.pluginId);

  const cfg = pluginId
    ? getPluginConfig(pluginId)
    : { workerUrl: null, skillsMapping: {}, skillsVersion: null };

  const bundledSkills = makeBundledSkillEntries(cfg);

  const handleSyncBundled = useCallback(async () => {
    if (!pluginId) throw new Error('Plugin ID が未取得です');
    if (!cfg.workerUrl) throw new Error('Worker URL が未設定です');
    await syncBundledSkillsFromChatPanel({ pluginId, workerUrl: cfg.workerUrl });
  }, [pluginId, cfg.workerUrl]);

  const handleAddCustomSkill = useCallback(
    async (input: CustomSkillInput) => {
      if (!pluginId) throw new Error('Plugin ID が未取得です');
      if (!cfg.workerUrl) throw new Error('Worker URL が未設定です');
      await syncCustomSkillFromChatPanel({
        pluginId,
        workerUrl: cfg.workerUrl,
        input,
      });
    },
    [pluginId, cfg.workerUrl],
  );

  const handleToggleVisibility = useCallback(
    async (agent: AgentRecord, next: 'public' | 'private') => {
      await setAgentVisibility(agent.id, next);
      const updated = builtInAgents.map((a) =>
        a.id === agent.id ? { ...a, visibility: next } : a,
      );
      setBuiltInAgents(updated);
    },
    [builtInAgents, setBuiltInAgents],
  );

  return (
    <SettingsView
      onClose={onClose}
      {...(onPluginConfigClick ? { onPluginConfigClick } : {})}
      bundledSkills={bundledSkills}
      onSyncBundled={handleSyncBundled}
      onAddCustomSkill={handleAddCustomSkill}
      onToggleVisibility={handleToggleVisibility}
    />
  );
}

interface PluginConfigShape {
  workerUrl: string | null;
  skillsMapping?: Record<string, { skillId: string; version: string }>;
  skillsVersion: string | null;
}

function makeBundledSkillEntries(cfg: PluginConfigShape): BundledSkillEntry[] {
  const isLatest = cfg.skillsVersion === SKILLS_VERSION;
  return SKILL_BUNDLES.map((b) => {
    const mapped = cfg.skillsMapping?.[b.name];
    return {
      name: b.name,
      displayTitle: b.displayTitle,
      skillId: mapped?.skillId ?? null,
      version: mapped?.version ?? null,
      status: mapped?.skillId ? (isLatest ? 'synced' : 'updated') : 'pending',
    };
  });
}
