// Cowork Agent for kintone — Settings View / 🤖 エージェント (V1 P2.3)
//
// chatStore.builtInAgents を一覧表示し、各 Agent の公開トグル (visibility) を変更可能。
// V1 では 「カスタム エージェント」セクションは V3 機能のため empty placeholder で出す。
//
// 公開トグル切替時は POST /v1/agents/{id} で metadata.visibility を更新
// (Agent ID 安定化のため update、find filter には visibility を含めない設計)。
//
// 仕様: requirements.md §15.4 / design.md §4.5 / handoff wedge-settings.jsx (AgentListRow)

import { useState } from 'react';

import {
  BUILTIN_AGENT_SPECS,
  KINTONE_TOOL_NAMES,
  type KintoneToolName,
} from '../../core/bootstrap/builtInAgents';
import { SKILL_BUNDLES } from '../../generated/skills-bundle';
import {
  accessValueOf,
  formatAccessFull,
  formatAccessSummary,
} from '../../core/access/accessControl';
import { useChatStore } from '../../store/chatStore';

import { AgentIcon } from '../components/AgentIcon';
import { ModelBadge } from '../components/ModelBadge';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

export interface AgentsListPaneProps {
  /**
   * 公開トグル切替 callback。Anthropic API 呼出は SettingsViewBound 側で wire される。
   */
  onToggleVisibility?: (agent: AgentRecord, next: 'public' | 'private') => Promise<void>;
  /** 編集ボタンクリック (#40) — SettingsViewBound が AgentDetailModal を open する */
  onEditAgent?: (agent: AgentRecord) => void;
  /** 新規 Custom Agent 追加ボタンクリック (#40) */
  onCreateAgent?: () => void;
}

export function AgentsListPane({
  onToggleVisibility,
  onEditAgent,
  onCreateAgent,
}: AgentsListPaneProps = {}): JSX.Element {
  const allAgents = useChatStore((s) => s.builtInAgents);
  const agents = allAgents.filter((a) => a.source === 'builtin');
  const customAgents = allAgents.filter((a) => a.source === 'custom');

  return (
    <div data-testid="agents-list-pane" className="p-[20px]">
      <div className="mb-[14px]">
        <h2 className="mb-[4px] text-[15px] font-semibold text-text">エージェント</h2>
        <p className="text-[11px] text-muted">
          ユーザーが Header から選択できるエージェントの一覧と公開設定。
        </p>
      </div>

      {/* Built-in */}
      <div className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.6px] text-subtle">
        Built-in (Plugin 同梱)
      </div>
      {agents.length === 0 ? (
        <div className="mb-[18px] rounded-[8px] border border-dashed border-border p-[16px] text-[12px] text-muted">
          エージェントを読み込み中…
        </div>
      ) : (
        <ul className="mb-[18px] flex flex-col gap-[8px]">
          {agents.map((a) => (
            <AgentRow
              key={a.id}
              agent={a}
              {...(onToggleVisibility ? { onToggleVisibility } : {})}
              {...(onEditAgent ? { onEdit: onEditAgent } : {})}
            />
          ))}
        </ul>
      )}

      {/* Custom Agents (#40) */}
      <div className="mb-[10px] flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-subtle">
          カスタム エージェント
        </div>
        {onCreateAgent && (
          <button
            type="button"
            data-testid="agent-create-btn"
            onClick={onCreateAgent}
            className="rounded-[7px] bg-accent px-[10px] py-[5px] text-[11px] font-semibold text-white hover:opacity-90"
          >
            + 追加
          </button>
        )}
      </div>
      {customAgents.length === 0 ? (
        <div
          data-testid="custom-agents-empty"
          className="mb-[12px] rounded-[12px] border border-dashed border-border bg-card-hi px-[18px] py-[18px] text-center text-[12px] text-muted"
        >
          カスタムエージェントはまだありません。「+ 追加」で雛形から複製できます。
        </div>
      ) : (
        <ul className="mb-[12px] flex flex-col gap-[8px]">
          {customAgents.map((a) => (
            <AgentRow
              key={a.id}
              agent={a}
              {...(onToggleVisibility ? { onToggleVisibility } : {})}
              {...(onEditAgent ? { onEdit: onEditAgent } : {})}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface AgentRowProps {
  agent: AgentRecord;
  onToggleVisibility?: (agent: AgentRecord, next: 'public' | 'private') => Promise<void>;
  onEdit?: (agent: AgentRecord) => void;
}

function AgentRow({ agent, onToggleVisibility, onEdit }: AgentRowProps): JSX.Element {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (next: 'public' | 'private'): Promise<void> => {
    if (!onToggleVisibility || updating) return;
    if (next === agent.visibility) return;
    setUpdating(true);
    setError(null);
    try {
      await onToggleVisibility(agent, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setUpdating(false);
    }
  };

  const isPublic = agent.visibility === 'public';
  const counts = getBuiltInCounts(agent);
  const variantId = `v_${agent.id.slice(-6)}`;

  return (
    <li
      data-testid={`agent-row-${agent.id}`}
      className="flex items-center gap-[12px] rounded-[10px] border border-card-border bg-card px-[14px] py-[12px]"
    >
      <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={36} />
      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex items-center gap-[6px] leading-tight">
          <span className="truncate text-[13px] font-semibold text-text">{agent.name}</span>
          <ModelBadge model={agent.model} size="lg" />
          {agent.isDefault && (
            <span className="rounded-[3px] bg-accent-soft px-[5px] py-[1px] text-[9px] font-semibold tracking-[0.4px] text-accent">
              既定
            </span>
          )}
        </div>
        <div className="text-[11px] leading-[1.4] text-muted">{agent.description}</div>
        {counts && (
          <div className="mt-[4px] flex items-center gap-[10px] text-[10px] text-subtle">
            <span>スキル {counts.skillCount}</span>
            <span>ツール {counts.toolCount}</span>
            <span className="font-mono">{variantId}</span>
            {(() => {
              const access = accessValueOf(agent);
              return (
                <span
                  data-testid={`agent-access-${agent.id}`}
                  title={formatAccessFull(access)}
                >
                  公開先: {formatAccessSummary(access)}
                </span>
              );
            })()}
          </div>
        )}
        {error && <div className="mt-[4px] text-[10.5px] text-warn">{error}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-[6px]">
        <PublishToggle
          on={isPublic}
          disabled={updating || !onToggleVisibility}
          agentId={agent.id}
          onToggle={handleToggle}
        />
        <button
          type="button"
          disabled={!onEdit}
          onClick={() => onEdit?.(agent)}
          data-testid={`agent-edit-${agent.id}`}
          className={`rounded-[7px] border border-border bg-transparent px-[10px] py-[6px] text-[11.5px] font-medium text-text ${
            onEdit ? 'cursor-pointer hover:bg-card-hi' : 'cursor-not-allowed opacity-50'
          }`}
        >
          編集 →
        </button>
      </div>
    </li>
  );
}

interface PublishToggleProps {
  on: boolean;
  disabled?: boolean;
  agentId: string;
  onToggle: (next: 'public' | 'private') => void | Promise<void>;
}

/** iOS スタイルの switch トグル (handoff の PublishToggle と同じ見た目) */
function PublishToggle({ on, disabled, agentId, onToggle }: PublishToggleProps): JSX.Element {
  return (
    <label
      className={`flex select-none items-center gap-[5px] ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={on}
        disabled={disabled}
        data-testid={`agent-visibility-${agentId}`}
        data-visibility={on ? 'public' : 'private'}
        onChange={() => onToggle(on ? 'private' : 'public')}
      />
      <span
        aria-hidden="true"
        className={`relative inline-block h-[17px] w-[30px] rounded-[9px] transition-colors duration-200 ${
          on ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-150 ${
            on ? 'left-[15px]' : 'left-[2px]'
          }`}
        />
      </span>
      <span className={`text-[10.5px] font-medium ${on ? 'text-text' : 'text-muted'}`}>
        {on ? '公開' : '非公開'}
      </span>
    </label>
  );
}

interface BuiltInCounts {
  skillCount: number;
  toolCount: number;
}

/**
 * Built-in Agent (purpose=business/customizer-*) の skill / tool 数を
 * BUILTIN_AGENT_SPECS から静的に計算する。Custom Agent (V3) は null を返す。
 */
function getBuiltInCounts(agent: AgentRecord): BuiltInCounts | null {
  if (agent.purpose === 'custom') return null;
  const spec = BUILTIN_AGENT_SPECS[agent.purpose];
  const customSkillCount = SKILL_BUNDLES.filter((b) => spec.customSkillFilter(b.name)).length;
  const skillCount = spec.anthropicSkillIds.length + customSkillCount;
  const toolCount = KINTONE_TOOL_NAMES.filter((name: KintoneToolName) =>
    spec.mcpToolFilter(name),
  ).length;
  return { skillCount, toolCount };
}
