// Cowork Agent for kintone — Settings View / 🤖 エージェント (V1 P2.3)
//
// chatStore.builtInAgents を一覧表示し、各 Agent の公開トグル (visibility) を変更可能。
// V1 では 「組織のデフォルト」セクションは作らない (requirements.md §15.4)。
//
// 公開トグル切替時は POST /v1/agents/{id} で metadata.visibility を更新
// (Agent ID 安定化のため update、find filter には visibility を含めない設計)。
//
// 仕様: requirements.md §15.4 / design.md §4.5

import { useState } from 'react';

import { useChatStore } from '../../store/chatStore';

import { AgentIcon } from '../components/AgentIcon';
import { ModelBadge } from '../components/ModelBadge';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

export interface AgentsListPaneProps {
  /**
   * 公開トグル切替 callback。
   * V1 では Anthropic API (updateAgent) を呼ぶラッパが別タスク (#39 / 後続) で実装される。
   * 本コンポーネントは UI 状態を chatStore に反映するのみ。
   */
  onToggleVisibility?: (agent: AgentRecord, next: 'public' | 'private') => Promise<void>;
}

export function AgentsListPane({ onToggleVisibility }: AgentsListPaneProps = {}): JSX.Element {
  const agents = useChatStore((s) => s.builtInAgents);

  return (
    <div data-testid="agents-list-pane" className="p-[20px]">
      <div className="mb-[14px]">
        <h2 className="mb-[4px] text-[15px] font-semibold text-text">エージェント</h2>
        <p className="text-[11px] text-muted">
          Plugin が同梱する Built-in エージェント 3 種類。公開トグルで end user の選択肢を制御できます。
          詳細編集 (skill / tool / system prompt) は V2 で対応予定です。
        </p>
      </div>

      <div className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.6px] text-subtle">
        Built-in
      </div>
      {agents.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-border p-[16px] text-[12px] text-muted">
          エージェントを読み込み中…
        </div>
      ) : (
        <ul className="flex flex-col gap-[8px]">
          {agents.map((a) => (
            <AgentRow key={a.id} agent={a} onToggleVisibility={onToggleVisibility} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface AgentRowProps {
  agent: AgentRecord;
  onToggleVisibility?: (agent: AgentRecord, next: 'public' | 'private') => Promise<void>;
}

function AgentRow({ agent, onToggleVisibility }: AgentRowProps): JSX.Element {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (): Promise<void> => {
    if (!onToggleVisibility || updating) return;
    const next: 'public' | 'private' = agent.visibility === 'public' ? 'private' : 'public';
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

  return (
    <li
      data-testid={`agent-row-${agent.id}`}
      className="flex items-center gap-[12px] rounded-[10px] border border-border bg-card px-[14px] py-[12px]"
    >
      <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[6px] leading-tight">
          <span className="truncate text-[13px] font-semibold text-text">{agent.name}</span>
          <ModelBadge model={agent.model} size="sm" />
          {agent.isDefault && (
            <span className="rounded-[3px] border border-border px-[4px] text-[8.5px] font-semibold tracking-[0.4px] text-muted">
              既定
            </span>
          )}
        </div>
        <div className="mt-[2px] truncate text-[11px] text-muted">{agent.description}</div>
        {error && (
          <div className="mt-[4px] text-[10.5px] text-warn">{error}</div>
        )}
      </div>
      <button
        type="button"
        data-testid={`agent-visibility-${agent.id}`}
        data-visibility={agent.visibility}
        disabled={updating || !onToggleVisibility}
        onClick={handleToggle}
        title={isPublic ? '公開中: end user のプルダウンに出ます' : '非公開: end user に出ません'}
        className={[
          'flex shrink-0 items-center gap-[6px] rounded-[7px] border px-[10px] py-[5px] text-[11.5px] font-medium',
          isPublic
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-border bg-card-hi text-muted',
          updating || !onToggleVisibility ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80',
        ].join(' ')}
      >
        {isPublic ? <EyeIcon /> : <EyeOffIcon />}
        <span>{isPublic ? '公開' : '非公開'}</span>
      </button>
    </li>
  );
}

function EyeIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4S1 7 1 7z" />
      <circle cx="7" cy="7" r="1.6" />
    </svg>
  );
}

function EyeOffIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 1l12 12" />
      <path d="M5.5 5.5a1.6 1.6 0 002.2 2.2M3 4c-1 1-2 3-2 3s2 4 6 4c1.2 0 2.2-.3 3-.7M11 9.6c1-.7 1.7-1.8 2-2.6 0 0-2-4-6-4-.6 0-1.2.1-1.7.3" />
    </svg>
  );
}
