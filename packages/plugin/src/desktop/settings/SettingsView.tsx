// Cowork Agent for kintone — Settings View shell (V1 P2.2)
//
// admin 専用設定画面。Artifact ペインを置き換える形で Side-by-Side で開く。
// 左 192px nav + 右 detail の 2-pane。V1 サブセクション: 🤖 エージェント / 🧠 スキル
// (🔌 MCP は V1 では disabled)。
//
// 仕様: requirements.md §15.4 / design.md §4

import { useState } from 'react';

import { AgentsListPane } from './AgentsListPane';
import { SettingsNav } from './SettingsNav';
import { SkillsPane } from './SkillsPane';

import type { SettingsSection } from './SettingsNav';
import type { CustomSkillInput } from './SkillAddModal';
import type { BundledSkillEntry } from './SkillsPane';
import type { AgentRecord } from '../../core/bootstrap/agentTypes';

export interface SettingsViewProps {
  /** Settings を閉じる (Conversation View に戻る) */
  onClose: () => void;
  /** Plugin Config (kintone admin 画面) を新タブで開く */
  onPluginConfigClick?: () => void;
  /** Plugin 同梱 skill 一覧 (Anthropic Workspace から resolve して渡す) */
  bundledSkills?: BundledSkillEntry[];
  /** admin が SkillAddModal から追加した custom skill 一覧 (Anthropic から resolve) */
  customSkills?: BundledSkillEntry[];
  /** Plugin 同梱 skill を Anthropic に同期 */
  onSyncBundled?: () => Promise<void>;
  /** カスタム skill 追加 (admin が SkillAddModal で投入) */
  onAddCustomSkill?: (input: CustomSkillInput) => Promise<void>;
  /** カスタム skill 編集 (V2 #30、新 version 作成) */
  onEditCustomSkill?: (input: CustomSkillInput) => Promise<void>;
  /** カスタム skill 削除 (V2 #30、DELETE /v1/skills/{id}) */
  onDeleteCustomSkill?: (skill: BundledSkillEntry) => Promise<void>;
  /** Agent 公開トグル切替 (Anthropic POST /v1/agents/{id} で metadata.visibility 更新) */
  onToggleVisibility?: (agent: AgentRecord, next: 'public' | 'private') => Promise<void>;
  /** Agent 編集ボタンクリック (#40 V2) */
  onEditAgent?: (agent: AgentRecord) => void;
  /** Custom Agent 追加ボタンクリック (#40 V2) */
  onCreateAgent?: () => void;
}

export function SettingsView({
  onClose,
  onPluginConfigClick,
  bundledSkills,
  customSkills,
  onSyncBundled,
  onAddCustomSkill,
  onEditCustomSkill,
  onDeleteCustomSkill,
  onToggleVisibility,
  onEditAgent,
  onCreateAgent,
}: SettingsViewProps): JSX.Element {
  const [section, setSection] = useState<SettingsSection>('agents');

  return (
    <div
      data-testid="settings-view"
      className="flex h-full flex-1 flex-col border-l border-border bg-bg text-text"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-[10px] border-b border-border bg-panel px-[18px] py-[12px] backdrop-blur-[12px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-accent-soft text-accent">
          <GearIcon />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-text">設定</div>
          <div className="text-[10.5px] text-muted">管理者専用 · 変更は新規セッションから反映</div>
        </div>
        <button
          type="button"
          data-testid="settings-close"
          aria-label="閉じる"
          title="閉じる"
          onClick={onClose}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-muted hover:bg-accent-soft hover:text-accent"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Body: 2-pane */}
      <div className="flex min-h-0 flex-1">
        <SettingsNav
          section={section}
          onSection={setSection}
          onPluginConfigClick={onPluginConfigClick}
        />
        <div className="min-w-0 flex-1 overflow-y-auto">
          {section === 'agents' && (
            <AgentsListPane
              {...(onToggleVisibility ? { onToggleVisibility } : {})}
              {...(onEditAgent ? { onEditAgent } : {})}
              {...(onCreateAgent ? { onCreateAgent } : {})}
            />
          )}
          {section === 'skills' && (
            <SkillsPane
              {...(bundledSkills ? { bundledSkills } : {})}
              {...(customSkills ? { customSkills } : {})}
              {...(onSyncBundled ? { onSyncBundled } : {})}
              {...(onAddCustomSkill ? { onAddCustomSkill } : {})}
              {...(onEditCustomSkill ? { onEditCustomSkill } : {})}
              {...(onDeleteCustomSkill ? { onDeleteCustomSkill } : {})}
            />
          )}
          {section === 'mcp' && <MCPPanePlaceholder />}
        </div>
      </div>
    </div>
  );
}

/**
 * V1 では disabled なので、ここに到達しない (Nav 側で click 不可) が、
 * 万一の事故防止に簡素な placeholder を出す。
 */
function MCPPanePlaceholder(): JSX.Element {
  return (
    <div className="p-[24px] text-[12px] text-muted" data-testid="mcp-pane-placeholder">
      MCP サーバー管理は V2 で提供されます。
    </div>
  );
}

function GearIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}
