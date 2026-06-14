// 定期実行 (Deployments) 一覧ペイン。行 / 空状態 / admin スコープ pill / 所有者列 /
// アーカイブ確認 / 手動実行トーストを内包する。

import { useState } from 'react';

import { fmtRun, relDay, scheduleSummary } from '../../core/deployments/schedule';
import { RUN_ERRORS } from '../../core/deployments/view';
import { AgentIcon } from '../components/AgentIcon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ModelBadge } from '../components/ModelBadge';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { DeploymentView } from '../../core/deployments/view';

export interface DeploymentsListPaneProps {
  deployments: readonly DeploymentView[];
  agents: readonly AgentRecord[];
  isAdmin: boolean;
  currentUser: string;
  /** admin のスコープ pill */
  scope: 'all' | 'mine';
  onScopeChange: (scope: 'all' | 'mine') => void;
  scopeCounts: { all: number; mine: number };
  onCreate: () => void;
  onEdit: (d: DeploymentView) => void;
  onRun: (d: DeploymentView) => Promise<void>;
  onToggleStatus: (d: DeploymentView) => Promise<void>;
  onArchive: (d: DeploymentView) => Promise<void>;
  onOpenHistory: (d: DeploymentView) => void;
}

export function DeploymentsListPane(props: DeploymentsListPaneProps): JSX.Element {
  const { deployments, isAdmin, scope, onScopeChange, scopeCounts, onCreate } = props;
  const [toast, setToast] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<DeploymentView | null>(null);
  const [archiving, setArchiving] = useState(false);

  const handleRun = async (d: DeploymentView): Promise<void> => {
    await props.onRun(d);
    setToast(d.name);
    setTimeout(() => setToast(null), 6000);
  };

  const handleArchiveConfirm = async (): Promise<void> => {
    if (!confirmArchive) return;
    setArchiving(true);
    try {
      await props.onArchive(confirmArchive);
      setConfirmArchive(null);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="relative h-full" data-testid="deployments-pane">
      <div className="px-[26px] pb-[36px] pt-[22px]">
        {/* PaneHeading */}
        <div className="mb-[14px] flex items-start gap-[12px]">
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-text">定期実行</h2>
            <p className="mt-[2px] text-[11.5px] text-muted">
              エージェントを cron スケジュールで自律起動します。
            </p>
          </div>
          <button
            type="button"
            data-testid="deployment-create-btn"
            onClick={onCreate}
            className="shrink-0 rounded-[7px] bg-accent px-[12px] py-[7px] text-[12px] font-semibold text-white"
          >
            + 新規作成
          </button>
        </div>

        {/* admin: スコープ pill */}
        {isAdmin && (
          <div className="mb-[14px] flex items-center gap-[8px]">
            <div className="inline-flex rounded-[8px] border border-border bg-card p-[2px]">
              {(['all', 'mine'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  data-testid={`deployment-scope-${sc}`}
                  onClick={() => onScopeChange(sc)}
                  className={`rounded-[6px] px-[10px] py-[4px] text-[11px] ${
                    scope === sc ? 'bg-accent-soft font-semibold text-accent' : 'text-muted'
                  }`}
                >
                  {sc === 'all' ? '全員' : '自分のみ'} {scopeCounts[sc]}
                </button>
              ))}
            </div>
          </div>
        )}

        {deployments.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div className="flex flex-col gap-[8px]">
            {deployments.map((d) => (
              <DeploymentRow
                key={d.id}
                d={d}
                agent={props.agents.find((a) => a.id === d.agentId)}
                isAdmin={isAdmin}
                onEdit={() => props.onEdit(d)}
                onRun={() => handleRun(d)}
                onToggleStatus={() => props.onToggleStatus(d)}
                onArchive={() => setConfirmArchive(d)}
                onOpenHistory={() => props.onOpenHistory(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* アーカイブ確認 (不可逆) */}
      {confirmArchive && (
        <ConfirmDialog
          testId="deployment-archive-confirm"
          confirmTestId="deployment-archive-confirm-btn"
          title="定期実行をアーカイブ"
          confirmLabel="アーカイブする"
          busyLabel="アーカイブ中…"
          submitting={archiving}
          message={
            <>
              「{confirmArchive.name}」をアーカイブします。以降スケジュールは実行されなくなります。
              <span className="mt-[8px] block rounded-[6px] border border-[#f0c98a] bg-warn-soft px-[8px] py-[6px] text-warn">
                アーカイブは取り消せません。同じ設定で動かすには新しい定期実行を作り直す必要があります（実行履歴は残ります）。
              </span>
            </>
          }
          onCancel={() => setConfirmArchive(null)}
          onConfirm={handleArchiveConfirm}
        />
      )}

      {/* 手動実行トースト */}
      {toast && (
        <div
          data-testid="deployment-run-toast"
          className="absolute inset-x-[26px] bottom-[18px] flex items-center gap-[10px] rounded-[10px] bg-text px-[14px] py-[12px] text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
        >
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/15 text-[#6ee7b7]">
            <CheckIcon />
          </span>
          <div className="flex-1 text-[12.5px]">
            <div className="font-semibold">テスト実行を開始しました</div>
            <div className="text-white/75">「{toast}」を今すぐ実行中。結果は実行履歴で確認できます。</div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-[6px] border border-white/25 px-[8px] py-[4px] text-[11px]"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  d: DeploymentView;
  agent: AgentRecord | undefined;
  isAdmin: boolean;
  onEdit: () => void;
  onRun: () => void | Promise<void>;
  onToggleStatus: () => void | Promise<void>;
  onArchive: () => void;
  onOpenHistory: () => void;
}

function DeploymentRow({
  d,
  agent,
  isAdmin,
  onEdit,
  onRun,
  onToggleStatus,
  onArchive,
  onOpenHistory,
}: RowProps): JSX.Element {
  const active = d.status === 'active';
  const nextIso = d.upcomingRunsAt[0];
  return (
    <div
      data-testid={`deployment-row-${d.id}`}
      className={`rounded-[10px] border border-card-border bg-card px-[14px] py-[12px] ${active ? '' : 'opacity-80'}`}
    >
      <div className="flex items-start gap-[12px]">
        <div
          className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[9px] ${
            active ? 'bg-accent-soft text-accent' : 'bg-black/5 text-subtle'
          }`}
        >
          <ClockIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[6px]">
            <span className="truncate text-[13px] font-semibold text-text">{d.name}</span>
            <StatusBadge active={active} />
          </div>

          {agent && (
            <div className="mt-[3px] flex items-center gap-[5px]">
              <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={20} />
              <span className="truncate text-[11.5px] font-semibold text-text">{agent.name}</span>
              <ModelBadge model={agent.model} size="sm" />
            </div>
          )}

          <div className="mt-[5px] flex flex-wrap items-center gap-[6px] text-[11px]">
            <ClockMini />
            <span className="font-medium text-text">{scheduleSummary(d.cron)}</span>
            <span className="rounded-[3px] bg-black/[0.04] px-[5px] py-px font-mono text-[10px] text-muted">
              {d.cron || '—'}
            </span>
            <span className="text-subtle">· {d.tz}</span>
          </div>

          {active ? (
            <div className="mt-[5px] text-[10.5px] text-subtle">
              {nextIso ? (
                <>
                  次回{' '}
                  <span className="font-medium text-text">{fmtRun(new Date(nextIso))}</span>{' '}
                  <span className="text-accent">{relDay(new Date(nextIso), new Date())}</span>
                </>
              ) : (
                '次回予定なし'
              )}
            </div>
          ) : (
            <div className="mt-[5px] rounded-[6px] bg-warn-soft px-[8px] py-[4px] text-[10.5px] text-warn">
              一時停止中{d.pausedReason ? `：${d.pausedReason}` : ''}
            </div>
          )}

          <div className="mt-[6px] flex items-center gap-[10px] text-[10.5px]">
            <span className="text-subtle">直近</span>
            <LastRunBadge d={d} />
            <button
              type="button"
              onClick={onOpenHistory}
              className="text-[10.5px] text-accent"
              data-testid={`deployment-history-${d.id}`}
            >
              実行履歴 →
            </button>
            {isAdmin && (
              <span className="ml-auto font-mono text-[9.5px] text-subtle">{d.owner || '—'}</span>
            )}
          </div>
        </div>
      </div>

      {/* アクション */}
      <div className="mt-[11px] flex items-center gap-[7px] border-t border-border pt-[11px]">
        <button
          type="button"
          data-testid={`deployment-run-${d.id}`}
          onClick={() => void onRun()}
          className="flex items-center gap-[4px] rounded-[7px] border border-accent-soft bg-accent-soft px-[10px] py-[5px] text-[11px] font-medium text-accent"
        >
          ▶ 今すぐ実行
        </button>
        <button
          type="button"
          data-testid={`deployment-toggle-${d.id}`}
          onClick={() => void onToggleStatus()}
          className="flex items-center gap-[5px] text-[10.5px] font-medium text-muted"
        >
          <span
            className={`relative inline-block h-[17px] w-[30px] rounded-full transition-colors ${active ? 'bg-accent' : 'bg-border'}`}
          >
            <span
              className={`absolute top-[2px] h-[13px] w-[13px] rounded-full bg-white transition-[left] ${active ? 'left-[15px]' : 'left-[2px]'}`}
            />
          </span>
          {active ? '実行中' : '停止中'}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          aria-label="編集"
          data-testid={`deployment-edit-${d.id}`}
          onClick={onEdit}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-muted hover:bg-card-hi hover:text-text"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          aria-label="アーカイブ"
          data-testid={`deployment-archive-${d.id}`}
          onClick={onArchive}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-warn hover:bg-warn-soft"
        >
          <ArchiveIcon />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-[4px] rounded-full px-[8px] py-[2px] pl-[6px] text-[10.5px] font-semibold ${
        active ? 'bg-accent-soft text-accent' : 'bg-black/5 text-muted'
      }`}
    >
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ background: active ? '#22c55e' : '#a89d85' }}
      />
      {active ? '実行中' : '一時停止'}
    </span>
  );
}

function LastRunBadge({ d }: { d: DeploymentView }): JSX.Element {
  if (!d.last) return <span className="text-subtle">未実行</span>;
  if (d.last.ok) {
    return (
      <span className="font-semibold text-[#047857]">
        ✓ 成功 <span className="ml-[4px] font-mono font-normal text-subtle">{fmtRun(new Date(d.last.at))}</span>
      </span>
    );
  }
  const label = d.last.err ? RUN_ERRORS[d.last.err].label : '失敗';
  return (
    <span className="rounded-[3px] bg-[#fee2e2] px-[7px] py-px font-semibold text-[#dc2626]">
      失敗 · {label}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }): JSX.Element {
  const cases = [
    { title: '日次通知', cron: '毎日 9:00', desc: '毎朝9時に未対応レコードを集計して、担当者に通知' },
    { title: '週次サマリ', cron: '毎週 月 8:00', desc: '毎週月曜の朝、先週の受注を Excel サマリにまとめて共有' },
    { title: '月次品質チェック', cron: '毎月 1日 10:00', desc: '毎月1日に先月のデータ品質を点検して改善提案を作成' },
  ];
  return (
    <div data-testid="deployments-empty">
      <div className="rounded-[14px] border border-dashed border-[rgba(35,18,0,0.18)] bg-card-hi px-[26px] py-[30px] text-center">
        <div className="mx-auto mb-[12px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent-soft text-accent">
          <ClockIcon size={26} />
        </div>
        <div className="text-[15px] font-bold text-text">定期実行はまだありません</div>
        <p className="mx-auto mt-[6px] max-w-[360px] text-[12px] leading-[1.7] text-muted">
          エージェントを cron スケジュールで自律起動できます。
          <br />
          毎朝の集計や週次サマリなど、繰り返しのタスクを自動化しましょう。
        </p>
        <button
          type="button"
          onClick={onCreate}
          data-testid="deployment-empty-create"
          className="mt-[14px] rounded-[7px] bg-accent px-[14px] py-[8px] text-[12px] font-semibold text-white"
        >
          最初の定期実行を作成
        </button>
      </div>

      <div className="mt-[18px]">
        <div className="mb-[8px] text-[11px] font-bold text-muted">こんな使い方ができます</div>
        <div className="flex flex-col gap-[8px]">
          {cases.map((c) => (
            <div
              key={c.title}
              className="flex items-center gap-[10px] rounded-[10px] border border-card-border bg-card px-[14px] py-[12px]"
            >
              <div className="text-[13px] font-semibold text-text">{c.title}</div>
              <span className="rounded-[3px] bg-accent-soft px-[6px] py-px font-mono text-[10px] text-accent">
                {c.cron}
              </span>
              <span className="text-[11px] text-muted">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── icons ──────────────────────────────────────────────────────────────────
function ClockIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}
function ClockMini(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--cw-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}
function PencilIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" />
    </svg>
  );
}
function ArchiveIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <path d="M3 6v7h10V6M6.5 9h3" />
    </svg>
  );
}
function CheckIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}
