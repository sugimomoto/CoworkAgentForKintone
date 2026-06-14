// 定期実行の作成 / 編集モーダル。controlled draft を編集し onSave で確定。
// フィールド: 名前 / 対象エージェント / 初回メッセージ / スケジュール (SchedulePicker)。

import { useMemo, useState } from 'react';

import { buildCron, fmtRun, nextRuns } from '../../../core/deployments/schedule';
import { AgentIcon } from '../../components/AgentIcon';
import { ModelBadge } from '../../components/ModelBadge';

import { buildDeploymentDraft } from './buildDraft';
import { SchedulePicker } from './SchedulePicker';

import type { DeploymentModalMode } from './types';
import type { AgentRecord } from '../../../core/bootstrap/agentTypes';
import type { DeploymentDraft } from '../../../core/deployments/view';

export interface DeploymentDetailModalProps {
  mode: DeploymentModalMode;
  agents: readonly AgentRecord[];
  onSave: (draft: DeploymentDraft, mode: DeploymentModalMode) => Promise<void>;
  onClose: () => void;
}

export function DeploymentDetailModal({
  mode,
  agents,
  onSave,
  onClose,
}: DeploymentDetailModalProps): JSX.Element {
  const defaultAgentId = agents[0]?.id ?? '';
  const [draft, setDraft] = useState<DeploymentDraft>(() => buildDeploymentDraft(mode, defaultAgentId));
  const [agentOpen, setAgentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cron = buildCron(draft.schedule);
  const nextRun = useMemo(() => nextRuns(cron, new Date(), 1)[0], [cron]);
  const cronValid = nextRun !== undefined;
  const canSave =
    !saving && cronValid && draft.name.trim() !== '' && draft.initialMessage.trim() !== '';

  const selectedAgent = agents.find((a) => a.id === draft.agentId) ?? agents[0];
  const isEdit = mode.kind === 'edit';

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="deployment-modal"
      className="absolute inset-0 z-30 flex items-stretch justify-center overflow-y-auto bg-black/45 p-0 sm:items-center sm:p-4"
    >
      <div className="flex max-h-full w-full max-w-[560px] flex-col rounded-none bg-card shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:rounded-[14px]">
        {/* ヘッダ */}
        <div className="flex shrink-0 items-center gap-[10px] border-b border-border px-[18px] py-[14px]">
          <div className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-accent-soft text-accent">
            <ClockIcon />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-bold text-text">
              定期実行を{isEdit ? '編集' : '作成'}
            </div>
            <div className="text-[10.5px] text-muted">
              {isEdit ? '変更は次回の実行から反映されます' : 'スケジュールと初回メッセージを決めるだけ'}
            </div>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-muted hover:bg-accent-soft hover:text-accent"
          >
            <CloseIcon />
          </button>
        </div>

        {/* body */}
        <div className="flex flex-col gap-[16px] overflow-y-auto px-[18px] py-[16px]">
          <Field label="名前">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="例：毎朝の未対応集計"
              data-testid="deployment-name"
              className="w-full rounded-[7px] border border-border bg-card px-[10px] py-[8px] text-[12.5px] text-text outline-none focus:border-accent"
            />
          </Field>

          <Field label="対象エージェント">
            <div className="relative">
              <button
                type="button"
                data-testid="deployment-agent-toggle"
                onClick={() => setAgentOpen((v) => !v)}
                className="flex w-full items-center gap-[8px] rounded-[7px] border border-border bg-card px-[10px] py-[7px] text-left"
              >
                {selectedAgent ? (
                  <AgentMini agent={selectedAgent} />
                ) : (
                  <span className="text-[12px] text-subtle">エージェントがありません</span>
                )}
                <span className="ml-auto text-subtle">⌄</span>
              </button>
              {agentOpen && (
                <div className="absolute z-10 mt-[4px] max-h-[220px] w-full overflow-y-auto rounded-[8px] border border-border bg-card shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      data-testid={`deployment-agent-option-${a.id}`}
                      onClick={() => {
                        setDraft({ ...draft, agentId: a.id });
                        setAgentOpen(false);
                      }}
                      className="flex w-full items-center gap-[8px] px-[10px] py-[7px] text-left hover:bg-card-hi"
                    >
                      <AgentMini agent={a} />
                      {a.id === draft.agentId && <span className="ml-auto text-accent">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field
            label="初回メッセージ"
            hint="実行時にエージェントへ最初に送る指示。1通の依頼として書きます。"
          >
            <textarea
              value={draft.initialMessage}
              onChange={(e) => setDraft({ ...draft, initialMessage: e.target.value })}
              placeholder="例：未対応の問い合わせを集計して、担当者ごとに通知して"
              data-testid="deployment-message"
              className="min-h-[64px] w-full resize-y rounded-[7px] border border-border bg-card px-[10px] py-[8px] text-[12.5px] leading-[1.5] text-text outline-none focus:border-accent"
            />
          </Field>

          <Field label="スケジュール">
            <SchedulePicker
              value={draft.schedule}
              onChange={(schedule) => setDraft({ ...draft, schedule })}
            />
          </Field>

          {error && <div className="text-[11px] text-warn">{error}</div>}
        </div>

        {/* フッタ */}
        <div className="flex shrink-0 items-center gap-[10px] border-t border-border bg-card-hi px-[18px] py-[12px]">
          <div className="flex-1 text-[10.5px] text-muted">
            {nextRun ? (
              <span>
                次回 <span className="font-medium text-accent">{fmtRun(nextRun)}</span> に実行
              </span>
            ) : (
              <span className="text-[#dc2626]">スケジュールを確認してください</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[7px] px-[12px] py-[7px] text-[12px] text-muted hover:bg-card hover:text-text"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-testid="deployment-save"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className={`rounded-[7px] px-[14px] py-[7px] text-[12px] font-semibold ${
              canSave
                ? 'cursor-pointer bg-accent text-white'
                : 'cursor-not-allowed bg-accent-soft text-accent opacity-60'
            }`}
          >
            {saving ? '保存中…' : isEdit ? '変更を保存' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentMini({ agent }: { agent: AgentRecord }): JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-[6px]">
      <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={20} />
      <span className="truncate text-[11.5px] font-semibold text-text">{agent.name}</span>
      <ModelBadge model={agent.model} size="sm" />
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[11.5px] font-semibold text-text">{label}</span>
      {children}
      {hint && <span className="text-[10.5px] text-muted">{hint}</span>}
    </label>
  );
}

function ClockIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
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
