// Cowork Agent for kintone — Customizer wedge Workflow Footer (V1 P4.2)
//
// Customizer Agent が生成した kintone-customize-js artifact の **フッター**に表示する
// ステップ式 workflow バー。5 状態 (ready / previewed / applying / applied /
// rolled-back) に応じて step bar + status line + primary action ボタンが切り替わる。
//
// 仕様: requirements.md §15.5 / design.md §6.5
// 参考: docs/design-handoff/customizer-wedge/project/wedge-workflow.jsx

import { useApplyWorkflow } from './useApplyWorkflow';

import type { WorkflowCallbacks, WorkflowState, ApplyWorkflowApi } from './useApplyWorkflow';

export interface WorkflowFooterProps {
  /** 対象 artifact の ID (workflowHistory のキーとして使う) */
  artifactId: string;
  /** kintone アプリ名 (status line の "{appName} に適用済" 表示用) */
  appName?: string;
  /** I/O コールバック (preview / apply / rollback の実装) */
  callbacks: WorkflowCallbacks;
  /** 初期状態 (画面再表示時の復元用)。default: 'ready' */
  initialState?: WorkflowState;
}

export function WorkflowFooter({
  artifactId,
  appName = 'アプリ',
  callbacks,
  initialState = 'ready',
}: WorkflowFooterProps): JSX.Element {
  const wf = useApplyWorkflow({ artifactId, initialState, callbacks });
  const statusLine = makeStatusLine(wf.state, appName);

  return (
    <div
      data-testid="workflow-footer"
      data-state={wf.state}
      className="shrink-0 border-t border-border bg-panel px-[14px] pb-[12px] pt-[10px] backdrop-blur-[12px]"
    >
      {/* Step bar */}
      <div className="mb-[9px] flex items-stretch gap-0">
        <Step n={1} def={STEP_DEFS.preview} status={stepStatus('preview', wf.state)} />
        <StepConnector done={isStepActiveOrDone('apply', wf.state)} />
        <Step n={2} def={STEP_DEFS.apply} status={stepStatus('apply', wf.state)} />
        <StepConnector done={isStepActiveOrDone('rollback', wf.state)} />
        <Step n={3} def={STEP_DEFS.rollback} status={stepStatus('rollback', wf.state)} />
      </div>

      {/* Status line + primary action */}
      <div className="flex items-center gap-[10px] rounded-[10px] border border-card-border bg-card px-[12px] py-[7px]">
        <StatusDot tone={statusLine.tone} />
        <div
          data-testid="workflow-status-line"
          className="flex-1 text-[11.5px] leading-[1.4] text-text"
        >
          {wf.errorMessage ? (
            <span className="text-warn">⚠ {wf.errorMessage}</span>
          ) : (
            statusLine.label
          )}
        </div>
        <WorkflowAction wf={wf} />
      </div>

      {/* ヒント */}
      <div className="mt-[6px] flex items-center gap-[10px] pl-[2px] text-[10px] text-subtle">
        <span>変更したい場合はチャットに新しい指示を入力してください</span>
      </div>
    </div>
  );
}

// ─── 各 step (preview / apply / rollback) ──────────────────────────────────

type StepKey = 'preview' | 'apply' | 'rollback';

interface StepDef {
  key: StepKey;
  label: string;
  desc: string;
  icon: 'eye' | 'upload' | 'undo';
}

const STEP_DEFS: Record<StepKey, StepDef> = {
  preview: {
    key: 'preview',
    label: 'プレビュー',
    desc: '本番に影響なくサンドボックスで実行',
    icon: 'eye',
  },
  apply: {
    key: 'apply',
    label: '適用',
    desc: 'kintone preview → deploy で本番反映',
    icon: 'upload',
  },
  rollback: {
    key: 'rollback',
    label: 'ロールバック',
    desc: '直前のカスタマイズ状態に戻す',
    icon: 'undo',
  },
};

type StepStatus = 'locked' | 'current' | 'inprogress' | 'done';

function stepStatus(step: StepKey, state: WorkflowState): StepStatus {
  if (step === 'preview') {
    if (state === 'ready') return 'current';
    return 'done';
  }
  if (step === 'apply') {
    if (state === 'ready') return 'locked';
    if (state === 'previewed') return 'current';
    if (state === 'applying') return 'inprogress';
    return 'done';
  }
  // rollback
  if (state === 'applied') return 'current';
  if (state === 'rolled-back') return 'done';
  return 'locked';
}

function isStepActiveOrDone(step: StepKey, state: WorkflowState): boolean {
  const s = stepStatus(step, state);
  return s === 'current' || s === 'inprogress' || s === 'done';
}

interface StepProps {
  n: number;
  def: StepDef;
  status: StepStatus;
}

function Step({ n: _n, def, status }: StepProps): JSX.Element {
  const isDone = status === 'done';
  const isCurrent = status === 'current';
  const isInProgress = status === 'inprogress';
  const isLocked = status === 'locked';
  const isRollback = def.key === 'rollback';
  // rollback の current は warn 色で強調 (注意喚起)
  const warnRollback = isRollback && isCurrent;

  const ringClasses = isLocked
    ? 'bg-card-hi text-subtle border border-border'
    : warnRollback
      ? 'bg-warn-soft text-warn border-2 border-warn shadow-[0_0_0_4px_var(--cw-warn-soft)]'
      : isCurrent
        ? 'bg-accent-soft text-accent border-2 border-accent shadow-[0_0_0_4px_var(--cw-accent-soft)]'
        : isDone
          ? 'bg-accent text-white border border-accent'
          : 'bg-accent-soft text-accent border border-border';

  return (
    <div
      data-testid={`workflow-step-${def.key}`}
      data-status={status}
      className="flex min-w-0 flex-1 flex-col items-center text-center"
    >
      <div className={`mb-[4px] flex h-[28px] w-[28px] items-center justify-center rounded-full ${ringClasses}`}>
        {isDone ? (
          <CheckIcon />
        ) : isInProgress ? (
          <Spinner />
        ) : (
          <StepGlyph icon={def.icon} />
        )}
      </div>
      <div
        className={`text-[11px] font-semibold leading-tight ${isLocked ? 'text-subtle' : 'text-text'}`}
      >
        {def.label}
      </div>
      <div className="mt-[2px] px-[4px] text-[9.5px] leading-[1.35] text-subtle">{def.desc}</div>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }): JSX.Element {
  return (
    <div className="flex shrink-0 basis-[14px] items-center justify-center pb-[26px]">
      <div
        className="h-[1.5px] w-full rounded-[1px]"
        style={{ background: done ? 'var(--cw-accent)' : 'var(--cw-border)' }}
      />
    </div>
  );
}

// ─── Status line ────────────────────────────────────────────────────────

type StatusTone = 'neutral' | 'ok' | 'work' | 'warn';

interface StatusLineInfo {
  label: string;
  tone: StatusTone;
}

function makeStatusLine(state: WorkflowState, appName: string): StatusLineInfo {
  switch (state) {
    case 'ready':
      return { label: 'まだ実機で動かしていません', tone: 'neutral' };
    case 'previewed':
      return { label: 'プレビューで動作確認済 — 本番反映できます', tone: 'ok' };
    case 'applying':
      return { label: 'kintone preview → deploy を実行中…', tone: 'work' };
    case 'applied': {
      const time = new Date().toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return { label: `「${appName}」に適用済 · ${time}`, tone: 'ok' };
    }
    case 'rolled-back':
      return { label: 'ロールバック完了 — 直前のカスタマイズに戻しました', tone: 'warn' };
  }
}

function StatusDot({ tone }: { tone: StatusTone }): JSX.Element {
  const colorMap: Record<StatusTone, string> = {
    neutral: 'var(--cw-muted)',
    ok: 'var(--cw-ok)',
    work: 'var(--cw-accent)',
    warn: 'var(--cw-warn)',
  };
  const color = colorMap[tone];
  return (
    <span
      data-testid="workflow-status-dot"
      data-tone={tone}
      className="h-[8px] w-[8px] shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }}
      aria-hidden="true"
    />
  );
}

// ─── Primary action ────────────────────────────────────────────────────

interface WorkflowActionProps {
  wf: ApplyWorkflowApi;
}

function WorkflowAction({ wf }: WorkflowActionProps): JSX.Element {
  if (wf.state === 'ready') {
    return (
      <PrimaryButton
        testId="workflow-action-preview"
        onClick={() => void wf.preview()}
        disabled={wf.inFlight !== null}
      >
        <PlayIcon /> プレビューを実行
      </PrimaryButton>
    );
  }
  if (wf.state === 'previewed') {
    return (
      <div className="flex items-center gap-[6px]">
        <GhostButton
          testId="workflow-action-preview-again"
          onClick={() => void wf.preview()}
          disabled={wf.inFlight !== null}
        >
          もう一度プレビュー
        </GhostButton>
        <PrimaryButton
          testId="workflow-action-apply"
          onClick={() => void wf.apply()}
          disabled={wf.inFlight !== null}
        >
          <UploadIcon /> kintone に適用
        </PrimaryButton>
      </div>
    );
  }
  if (wf.state === 'applying') {
    return (
      <PrimaryButton testId="workflow-action-applying" onClick={() => undefined} disabled>
        適用中…
      </PrimaryButton>
    );
  }
  if (wf.state === 'applied') {
    return (
      <div className="flex items-center gap-[6px]">
        <WarnButton
          testId="workflow-action-rollback"
          onClick={() => void wf.rollback()}
          disabled={wf.inFlight !== null}
        >
          <UndoIcon /> ロールバック
        </WarnButton>
      </div>
    );
  }
  // rolled-back
  return (
    <PrimaryButton
      testId="workflow-action-reapply"
      onClick={() => void wf.apply()}
      disabled={wf.inFlight !== null}
    >
      もう一度適用
    </PrimaryButton>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
}

function PrimaryButton({ children, onClick, disabled, testId }: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-[4px] rounded-[7px] bg-accent px-[12px] py-[6px] text-[11.5px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled, testId }: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-[4px] rounded-[7px] border border-border bg-transparent px-[11px] py-[6px] text-[11.5px] font-medium text-text hover:bg-card-hi disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function WarnButton({ children, onClick, disabled, testId }: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-[4px] rounded-[7px] bg-warn px-[12px] py-[6px] text-[11.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

// ─── icons ────────────────────────────────────────────────────────────

function CheckIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 7.5l3 3L12 3.5" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <span
      data-testid="workflow-step-spinner"
      className="block h-[14px] w-[14px] animate-spin rounded-full border-2 border-accent/40 border-t-accent"
      aria-hidden="true"
    />
  );
}

function StepGlyph({ icon }: { icon: StepDef['icon'] }): JSX.Element {
  const common = {
    width: 13,
    height: 13,
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (icon === 'eye') {
    return (
      <svg {...common}>
        <path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4S1 7 1 7z" />
        <circle cx="7" cy="7" r="1.6" />
      </svg>
    );
  }
  if (icon === 'upload') {
    return (
      <svg {...common}>
        <path d="M7 9V2M4 5l3-3 3 3" />
        <path d="M2 10v2h10v-2" />
      </svg>
    );
  }
  // undo
  return (
    <svg {...common}>
      <path d="M3 5a4 4 0 017 2.5" />
      <path d="M3 2v3h3" />
    </svg>
  );
}

function PlayIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M3 2l7 4-7 4z" />
    </svg>
  );
}

function UploadIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8V2M3.5 4.5L6 2l2.5 2.5" />
      <path d="M2 9v1h8V9" />
    </svg>
  );
}

function UndoIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5a4 4 0 017 2.5" />
      <path d="M3 2v3h3" />
    </svg>
  );
}
