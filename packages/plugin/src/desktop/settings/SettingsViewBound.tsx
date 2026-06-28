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

import { useCallback, useEffect, useMemo, useState } from 'react';

import { agentToRecord } from '../../core/bootstrap/agentRecord';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import {
  applyAgentEdit,
  archiveAgentById,
  createCustomAgentFrom,
  reconcileAgentWebhook,
} from '../../core/managed-agents/agentDetailApi';
import { setAgentVisibility } from '../../core/managed-agents/agentVisibility';
import { retrieveAgent } from '../../core/managed-agents/resources';
import {
  deleteCustomSkillFromChatPanel,
  editCustomSkillFromChatPanel,
  syncBundledSkillsFromChatPanel,
  syncCustomSkillFromChatPanel,
} from '../../core/skills/chatPanelSkillsSync';
import { resolveSkillSet } from '../../core/skills/resolveBundledSkillIds';
import { SKILL_BUNDLES } from '../../generated/skills-bundle';
import { useChatStore } from '../../store/chatStore';

import { AgentDetailModal, type AvailableSkill } from './AgentDetailModal';
import { SettingsView } from './SettingsView';

import type { WebhookConfig } from './notify/webhookPlatform';
import type { CustomSkillInput } from './SkillAddModal';
import type { BundledSkillEntry } from './SkillsPane';
import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../core/managed-agents/agentDetailApi';

export interface SettingsViewBoundProps {
  /** Settings View を閉じる (Conversation View に戻る) */
  onClose: () => void;
  /** Plugin Config 画面を開く (kintone admin 画面、SettingsView Nav 下部リンク) */
  onPluginConfigClick?: () => void;
  /** 定期実行の run セッションを会話ビューで開く (#81) */
  onOpenSession?: (sessionId: string) => void;
}

export function SettingsViewBound({
  onClose,
  onPluginConfigClick,
  onOpenSession,
}: SettingsViewBoundProps): JSX.Element {
  const builtInAgents = useChatStore((s) => s.builtInAgents);
  const setBuiltInAgents = useChatStore((s) => s.setBuiltInAgents);
  const pluginId = useChatStore((s) => s.pluginId);
  const isAdmin = useChatStore((s) => s.isAdmin) === true;

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

  // ─── Agent 詳細編集 / 追加 (#40) ──────────────────────────────────────────
  const upsertAgent = useChatStore((s) => s.upsertAgent);
  const removeAgent = useChatStore((s) => s.removeAgent);

  const [modalState, setModalState] = useState<
    | { kind: 'edit'; agent: AgentRecord }
    | { kind: 'create'; templates: readonly AgentRecord[] }
    | null
  >(null);

  // AgentDetailModal の skill 一覧 (Anthropic 製 4 + bundled + custom 同期済)
  const availableSkills = useMemo<readonly AvailableSkill[]>(() => {
    const out: AvailableSkill[] = [
      { skillId: 'xlsx', type: 'anthropic', label: 'xlsx (Excel/CSV)' },
      { skillId: 'docx', type: 'anthropic', label: 'docx (Word)' },
      { skillId: 'pdf', type: 'anthropic', label: 'pdf (PDF 解析)' },
      { skillId: 'pptx', type: 'anthropic', label: 'pptx (PowerPoint)' },
    ];
    for (const b of bundledSkills) {
      if (b.skillId) {
        out.push({ skillId: b.skillId, type: 'custom', label: b.name });
      }
    }
    for (const c of customSkills) {
      if (c.skillId) {
        out.push({ skillId: c.skillId, type: 'custom', label: c.name });
      }
    }
    return out;
  }, [bundledSkills, customSkills]);

  const handleEditAgent = useCallback((agent: AgentRecord) => {
    setModalState({ kind: 'edit', agent });
  }, []);

  const handleCreateAgent = useCallback(() => {
    setModalState({ kind: 'create', templates: builtInAgents });
  }, [builtInAgents]);

  const handleSaveAgent = useCallback(
    async (draft: AgentEditDraft, sourceAgent: AgentRecord, webhook: WebhookConfig | null) => {
      if (!modalState) return;
      // #42: 追加 MCP カタログ（attach の serverId→url 解決 + mcp_servers/toolset 構築に使う）。
      const mcpCatalog = pluginId ? getPluginConfig(pluginId).mcpServers : [];
      const saved =
        modalState.kind === 'edit'
          ? await applyAgentEdit(sourceAgent.id, draft, mcpCatalog)
          : await createCustomAgentFrom({ baseAgentId: sourceAgent.id, draft, mcpCatalog });

      // 通知 Webhook (#13): 保存後の Agent に対して登録/解除を反映 (metadata 更新を含む)。
      // workerUrl が無い環境 (未接続) では通知登録はスキップ (webhook 変更が無ければ実質 no-op)。
      let finalAgent = saved;
      if (pluginId && cfg.workerUrl) {
        finalAgent = await reconcileAgentWebhook(saved, webhook, {
          pluginId,
          workerUrl: cfg.workerUrl,
        });
      }
      upsertAgent(agentToRecord(finalAgent));
      setModalState(null);
    },
    [modalState, upsertAgent, pluginId, cfg.workerUrl],
  );

  const handleDeleteAgent = useCallback(
    async (agent: AgentRecord) => {
      if (agent.source !== 'custom') throw new Error('built-in Agent は削除できません');
      await archiveAgentById(agent.id);
      removeAgent(agent.id);
      setModalState(null);
    },
    [removeAgent],
  );

  return (
    <>
      <SettingsView
        onClose={onClose}
        isAdmin={isAdmin}
        pluginId={pluginId}
        {...(onOpenSession ? { onOpenSession } : {})}
        {...(onPluginConfigClick ? { onPluginConfigClick } : {})}
        bundledSkills={bundledSkills}
        customSkills={customSkills}
        onSyncBundled={handleSyncBundled}
        onAddCustomSkill={handleAddCustomSkill}
        onEditCustomSkill={handleEditCustomSkill}
        onDeleteCustomSkill={handleDeleteCustomSkill}
        onToggleVisibility={handleToggleVisibility}
        onEditAgent={handleEditAgent}
        onCreateAgent={handleCreateAgent}
      />
      {modalState && (
        <AgentDetailModal
          mode={modalState}
          fetchAgent={retrieveAgent}
          onSave={handleSaveAgent}
          onDelete={handleDeleteAgent}
          availableSkills={availableSkills}
          mcpServers={pluginId ? getPluginConfig(pluginId).mcpServers : []}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  );
}

