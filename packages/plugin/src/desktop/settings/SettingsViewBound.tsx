// Cowork Agent for kintone — SettingsView と chatStore / Anthropic API のアダプタ
//
// 永続化は Anthropic Workspace に集約する設計 (Plugin Config の skillsMapping は廃止)。
// 同期状態は SettingsView 開いた時に `/v1/skills?source=custom` を 1 回叩いて
// display_title で照合し、Anthropic 側に同名 skill があれば 'synced'、無ければ 'pending'
// として SkillsPane に渡す。
//
// 責務:
//   - chatStore.builtInAgents の購読 + 公開トグル更新後の反映
//   - resolveBundledSkillIds で Plugin 同梱 skill の Anthropic 側 status を取得
//   - syncBundledSkillsFromChatPanel / syncCustomSkillFromChatPanel の呼出
//   - setAgentVisibility の呼出 (visibility 更新)

import { useCallback, useEffect, useState } from 'react';

import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { setAgentVisibility } from '../../core/managed-agents/agentVisibility';
import { resolveSkillSet } from '../../core/skills/resolveBundledSkillIds';
import {
  deleteCustomSkillFromChatPanel,
  editCustomSkillFromChatPanel,
  syncBundledSkillsFromChatPanel,
  syncCustomSkillFromChatPanel,
} from '../../core/skills/chatPanelSkillsSync';
import { SKILL_BUNDLES } from '../../generated/skills-bundle';
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

  const cfg = pluginId ? getPluginConfig(pluginId) : { workerUrl: null };

  // SettingsView が開いた時点で 1 回 fetch、同期成功時に再 fetch (依存 trigger 用 nonce)
  const [refetchNonce, setRefetchNonce] = useState(0);
  const [bundledSkills, setBundledSkills] = useState<BundledSkillEntry[]>(() =>
    SKILL_BUNDLES.map((b) => ({
      name: b.name,
      displayTitle: b.displayTitle,
      skillId: null,
      version: null,
      status: 'pending',
    })),
  );
  const [customSkills, setCustomSkills] = useState<BundledSkillEntry[]>([]);

  useEffect(() => {
    if (!pluginId || !cfg.workerUrl) return;
    let cancelled = false;
    void resolveSkillSet()
      .then(({ bundled, custom }) => {
        if (cancelled) return;
        setBundledSkills(
          bundled.map((r) => ({
            name: r.name,
            displayTitle: r.displayTitle,
            skillId: r.skillId,
            version: r.latestVersion,
            status: r.skillId ? 'synced' : 'pending',
          })),
        );
        setCustomSkills(
          custom.map((r) => ({
            name: r.name,
            displayTitle: r.displayTitle,
            skillId: r.skillId,
            version: r.latestVersion,
            status: 'synced',
          })),
        );
      })
      .catch((err) => {
        // 取得失敗時は 'pending' のままにする (admin が同期ボタンを押せば再取得される)
        console.warn('[cowork-agent] resolveSkillSet failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [pluginId, cfg.workerUrl, refetchNonce]);

  const handleSyncBundled = useCallback(async () => {
    if (!pluginId) throw new Error('Plugin ID が未取得です');
    if (!cfg.workerUrl) throw new Error('Worker URL が未設定です');
    await syncBundledSkillsFromChatPanel({ pluginId, workerUrl: cfg.workerUrl });
    // Anthropic 側の eventual consistency 待ちで少し遅延を入れてから refetch。
    // すぐ叩くと list レスポンスに直前の create/update が反映されないことがある。
    await new Promise((r) => setTimeout(r, 800));
    setRefetchNonce((n) => n + 1);
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
      setRefetchNonce((n) => n + 1);
    },
    [pluginId, cfg.workerUrl],
  );

  // V2 #30: 編集 (= 同 name で /skills/sync を呼ぶ = display_title マッチで Worker が
  // 新 version を作成する経路を流用)
  const handleEditCustomSkill = useCallback(
    async (input: CustomSkillInput) => {
      if (!pluginId) throw new Error('Plugin ID が未取得です');
      if (!cfg.workerUrl) throw new Error('Worker URL が未設定です');
      await editCustomSkillFromChatPanel({
        pluginId,
        workerUrl: cfg.workerUrl,
        input,
      });
      await new Promise((r) => setTimeout(r, 800)); // eventual consistency
      setRefetchNonce((n) => n + 1);
    },
    [pluginId, cfg.workerUrl],
  );

  // V2 #30: 削除 (Anthropic `DELETE /v1/skills/{id}` を passthrough 経由)
  const handleDeleteCustomSkill = useCallback(
    async (skill: { skillId: string | null }) => {
      if (!skill.skillId) throw new Error('skillId が未設定 (まだ同期されていません)');
      await deleteCustomSkillFromChatPanel({ skillId: skill.skillId });
      await new Promise((r) => setTimeout(r, 800));
      setRefetchNonce((n) => n + 1);
    },
    [],
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
      customSkills={customSkills}
      onSyncBundled={handleSyncBundled}
      onAddCustomSkill={handleAddCustomSkill}
      onEditCustomSkill={handleEditCustomSkill}
      onDeleteCustomSkill={handleDeleteCustomSkill}
      onToggleVisibility={handleToggleVisibility}
    />
  );
}
