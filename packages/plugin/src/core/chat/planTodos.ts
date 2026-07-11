// planTodos.ts — タスク機構(#128) の Plan データ形状 + 派生ヘルパー（フレームワーク非依存）
//
// エージェントが `update_plan` custom tool でサブタスク一覧を宣言・更新する。
// PlanPanel は現在の todos[] を表示するだけ（更新は必ず update_plan 経由）。
// 出所: docs/design-handoff/task-mechanism/planTodos.ts（Claude Design ハンドオフ）。

export type PlanStatus = 'pending' | 'in_progress' | 'completed';

export interface PlanTodo {
  /** 命令形・短文。completed / pending 表示に使う（例「案件データを取得する」）。 */
  content: string;
  /** 実行状態。in_progress は原則 1 つ。 */
  status: PlanStatus;
  /** 現在進行形ラベル。in_progress 表示に使う（例「案件データを取得中」）。 */
  activeForm: string;
}

export interface PlanSummary {
  total: number;
  completed: number;
  /** 最初の in_progress の index（無ければ -1）。 */
  activeIndex: number;
  active: PlanTodo | null;
  allDone: boolean;
  /** 完了率 0–100（整数）。 */
  pct: number;
}

/** todos[] から表示に必要な派生値を計算する。 */
export function planSummary(todos: PlanTodo[]): PlanSummary {
  const total = todos.length;
  const completed = todos.filter((t) => t.status === 'completed').length;
  const activeIndex = todos.findIndex((t) => t.status === 'in_progress');
  const active = activeIndex >= 0 ? (todos[activeIndex] ?? null) : null;
  const allDone = total > 0 && completed === total;
  return {
    total,
    completed,
    activeIndex,
    active,
    allDone,
    pct: total ? Math.round((completed / total) * 100) : 0,
  };
}

/** 行に表示するラベル。in_progress は activeForm、それ以外は content。 */
export function todoLabel(t: PlanTodo): string {
  return t.status === 'in_progress' ? t.activeForm : t.content;
}

/**
 * 完了行をたたみ込むかどうか（縦を食い過ぎない工夫）。
 * plan が長く（> 6 件）、完了が 2 件以上あるときだけ true。
 */
export function shouldGroupCompleted(s: PlanSummary): boolean {
  return s.total > 6 && s.completed >= 2;
}

const PLAN_STATUSES: readonly PlanStatus[] = ['pending', 'in_progress', 'completed'];

/**
 * update_plan ツール入力（{ todos: PlanTodo[] }）を検証して PlanTodo[] を返す。
 * 不正（配列でない / status enum 外 / content・activeForm 欠落）は null。
 */
export function parseUpdatePlanInput(input: unknown): PlanTodo[] | null {
  if (!input || typeof input !== 'object') return null;
  const raw = (input as { todos?: unknown }).todos;
  if (!Array.isArray(raw)) return null;
  const out: PlanTodo[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') return null;
    const content = (t as { content?: unknown }).content;
    const status = (t as { status?: unknown }).status;
    const activeForm = (t as { activeForm?: unknown }).activeForm;
    if (typeof content !== 'string' || !content) return null;
    if (typeof status !== 'string' || !PLAN_STATUSES.includes(status as PlanStatus)) return null;
    // activeForm は in_progress 表示用。欠落時は content で代替（厳格には落とさない）。
    const af = typeof activeForm === 'string' && activeForm ? activeForm : content;
    out.push({ content, status: status as PlanStatus, activeForm: af });
  }
  return out;
}
