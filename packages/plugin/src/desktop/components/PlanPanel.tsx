// Cowork Agent for kintone — 進捗チェックリスト帯 (#128 タスク機構)
//
// Chat Panel の「メッセージ一覧の下・Composer の上」に置くピン留め帯。
// 会話スクロールの外側 (flex-none) に兄弟要素として配置し、スクロール追従 (#133) と
// 干渉させない。todos の更新は agent の `update_plan` custom tool 経由 (表示専用)。
//
// 配色は CSS 変数トークン (--cw-*) を Tailwind arbitrary value で参照 (styles/tokens.css)。
// 出所: docs/design-handoff/task-mechanism/PlanPanel.tsx (Claude Design ハンドオフ)。

import { useEffect, useRef, useState } from 'react';

import { planSummary, shouldGroupCompleted, todoLabel } from '../../core/chat/planTodos';

import type { PlanTodo } from '../../core/chat/planTodos';

interface Props {
  todos: PlanTodo[];
  /**
   * エージェントが実際に稼働中か (isAgentRunning)。false のときは in_progress の
   * スピナー/…/実行中バッジを止め、静止表示にする (停止・中断・ターン終了で回り続けないように)。
   * 既定 true (表示専用のデモ/テストは従来どおりアニメーション)。
   */
  running?: boolean;
  /** 初期の開閉状態。既定は「全完了なら畳む / それ以外は開く」。 */
  defaultCollapsed?: boolean;
}

// ── 行の状態アイコン (18px スロット) ──────────────────
function StatusIcon({
  status,
  running,
}: {
  status: PlanTodo['status'];
  running: boolean;
}): JSX.Element {
  if (status === 'completed') {
    return (
      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--cw-accent-soft)] text-[var(--cw-accent)]">
          <CheckIcon className="h-2.5 w-2.5" thin />
        </span>
      </span>
    );
  }
  if (status === 'in_progress') {
    // 稼働中はスピナー、停止中は回転を止めた静止リング (accent の中抜き丸)。
    return (
      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">
        {running ? (
          <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-[var(--cw-accent)]/20 border-t-[var(--cw-accent)]" />
        ) : (
          <span className="h-[15px] w-[15px] rounded-full border-2 border-[var(--cw-accent)]/45" />
        )}
      </span>
    );
  }
  // pending
  return (
    <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">
      <span className="h-[13px] w-[13px] rounded-full border-[1.5px] border-[var(--cw-border)]" />
    </span>
  );
}

// ── サブタスク 1 行 ─────────────────────────────────
function PlanRow({ todo, running }: { todo: PlanTodo; running: boolean }): JSX.Element {
  const active = todo.status === 'in_progress';
  const done = todo.status === 'completed';
  return (
    <div
      className={[
        'flex items-center gap-[9px] rounded-lg px-2 py-[5px] text-[12.5px] leading-[1.4] transition-colors',
        active
          ? 'bg-[var(--cw-accent-soft)] font-semibold text-[var(--cw-text)]'
          : done
            ? 'text-[var(--cw-muted)]'
            : 'text-[var(--cw-subtle)]',
      ].join(' ')}
    >
      <StatusIcon status={todo.status} running={running} />
      <span className="min-w-0 flex-1 truncate">
        {todoLabel(todo)}
        {active && running && <span className="text-[var(--cw-accent)]">…</span>}
      </span>
      {active && (
        <span className="flex-none rounded-full border border-[var(--cw-accent)]/20 bg-[var(--cw-card)] px-1.5 py-px font-mono text-[9.5px] font-semibold text-[var(--cw-accent)]">
          {running ? '実行中' : '中断'}
        </span>
      )}
    </div>
  );
}

// ── 完了行のたたみ込みサマリ (長い plan 用) ───────────
function CompletedGroup({ count, onOpen }: { count: number; onOpen: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-[9px] rounded-lg px-2 py-[5px] text-left text-[var(--cw-muted)] transition-colors"
    >
      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--cw-accent-soft)] text-[var(--cw-accent)]">
          <CheckIcon className="h-2.5 w-2.5" thin />
        </span>
      </span>
      <span className="flex-1 text-xs">{count} 件完了</span>
      <ChevronIcon className="h-3 w-3 -rotate-90 text-[var(--cw-subtle)]" />
    </button>
  );
}

// ── PlanPanel 本体 ──────────────────────────────────
export function PlanPanel({ todos, running = true, defaultCollapsed }: Props): JSX.Element | null {
  const s = planSummary(todos);
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? s.allDone);
  const [completedOpen, setCompletedOpen] = useState(false);

  // 完了済み plan (allDone) が新しい未完了 plan に置き換わったら開閉状態をリセットする。
  // 同一 session で update_plan が「完了 → 別の新規計画」を出したとき、前 plan の
  // 畳み込み (collapsed=true / completedOpen=true) が残って新 plan が畳まれたまま出るのを防ぐ。
  // 進行中の通常更新 (allDone のまま変わらない) では発火しないのでユーザーの手動開閉は尊重する。
  const prevAllDoneRef = useRef(s.allDone);
  useEffect(() => {
    if (prevAllDoneRef.current && !s.allDone) {
      setCollapsed(false);
      setCompletedOpen(false);
    }
    prevAllDoneRef.current = s.allDone;
  }, [s.allDone]);

  if (!todos || todos.length === 0) return null; // plan 無し → 帯ごと非表示

  const groupCompleted = shouldGroupCompleted(s) && !completedOpen;
  const rows = groupCompleted ? todos.filter((t) => t.status !== 'completed') : todos;

  // 稼働停止中に in_progress が残っている = 停止/中断/ターン終了で途中終了した状態。
  const stalled = !running && !s.allDone;
  const headTitle = s.allDone
    ? '作業が完了しました'
    : stalled
      ? '作業を一時停止中'
      : collapsed && s.active
        ? s.active.activeForm
        : '作業を実行中';

  return (
    <div
      data-testid="plan-panel"
      className="flex-none border-t border-[var(--cw-border)] bg-[var(--cw-panel)] backdrop-blur-md"
    >
      {/* ── ヘッダ (クリックで開閉) ── */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-[9px] px-3 py-[9px] text-left"
      >
        <ChevronIcon
          className={`h-3 w-3 flex-none text-[var(--cw-subtle)] transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
        {s.allDone ? (
          <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[var(--cw-accent)] text-[var(--cw-on-accent)]">
            <CheckIcon className="h-2.5 w-2.5" thin />
          </span>
        ) : stalled ? (
          <span className="h-4 w-4 flex-none rounded-full border-2 border-[var(--cw-accent)]/45" />
        ) : (
          <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-[var(--cw-accent)]/20 border-t-[var(--cw-accent)]" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--cw-text)]">
          {headTitle}
          {collapsed && s.active && running && <span className="text-[var(--cw-accent)]">…</span>}
        </span>
        <span className="flex-none font-mono text-[11px] font-semibold tabular-nums text-[var(--cw-muted)]">
          {s.completed} / {s.total}
        </span>
        <span className="h-1 w-11 flex-none overflow-hidden rounded-sm bg-[var(--cw-border)]">
          <span
            className="block h-full rounded-sm bg-[var(--cw-accent)] transition-[width] duration-300"
            style={{ width: `${s.pct}%` }}
          />
        </span>
      </button>

      {/* ── 行リスト ── */}
      {!collapsed && (
        <div className="flex max-h-[216px] flex-col gap-px overflow-y-auto px-2 pb-[9px]">
          {groupCompleted && (
            <CompletedGroup count={s.completed} onOpen={() => setCompletedOpen(true)} />
          )}
          {rows.map((t, i) => (
            <PlanRow key={i} todo={t} running={running} />
          ))}
          {shouldGroupCompleted(s) && completedOpen && (
            <button
              type="button"
              onClick={() => setCompletedOpen(false)}
              className="ml-[26px] mt-0.5 self-start px-1 py-0.5 text-[10.5px] text-[var(--cw-subtle)]"
            >
              完了分をたたむ
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── インライン SVG (外部アイコンフォント不可) ──────────
function CheckIcon({ className, thin }: { className?: string; thin?: boolean }): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={thin ? 1.7 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6.2l2.2 2.2L9.5 3.5" />
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

export default PlanPanel;
