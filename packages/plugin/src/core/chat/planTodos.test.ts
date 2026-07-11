import { describe, it, expect } from 'vitest';

import {
  parseUpdatePlanInput,
  planSummary,
  shouldGroupCompleted,
  todoLabel,
  type PlanTodo,
} from './planTodos';

const todo = (
  content: string,
  status: PlanTodo['status'],
  activeForm = content,
): PlanTodo => ({ content, status, activeForm });

describe('planSummary', () => {
  it('空配列は total/completed 0・activeIndex -1・allDone false・pct 0', () => {
    expect(planSummary([])).toEqual({
      total: 0,
      completed: 0,
      activeIndex: -1,
      active: null,
      allDone: false,
      pct: 0,
    });
  });

  it('進行中の集計と完了率 (整数丸め)', () => {
    const s = planSummary([
      todo('A', 'completed'),
      todo('B', 'in_progress', 'B 中'),
      todo('C', 'pending'),
    ]);
    expect(s.total).toBe(3);
    expect(s.completed).toBe(1);
    expect(s.activeIndex).toBe(1);
    expect(s.active?.content).toBe('B');
    expect(s.allDone).toBe(false);
    expect(s.pct).toBe(33); // 1/3 = 33.3 → 33
  });

  it('全完了で allDone true / pct 100', () => {
    const s = planSummary([todo('A', 'completed'), todo('B', 'completed')]);
    expect(s.allDone).toBe(true);
    expect(s.pct).toBe(100);
    expect(s.active).toBeNull();
  });
});

describe('todoLabel', () => {
  it('in_progress は activeForm、その他は content', () => {
    expect(todoLabel(todo('取得する', 'in_progress', '取得中'))).toBe('取得中');
    expect(todoLabel(todo('取得する', 'pending', '取得中'))).toBe('取得する');
    expect(todoLabel(todo('取得する', 'completed', '取得中'))).toBe('取得する');
  });
});

describe('shouldGroupCompleted', () => {
  it('6 件超 かつ 完了 2 件以上 でのみ true', () => {
    const many = (done: number, total: number): PlanTodo[] =>
      Array.from({ length: total }, (_, i) =>
        todo(`t${i}`, i < done ? 'completed' : 'pending'),
      );
    expect(shouldGroupCompleted(planSummary(many(2, 5)))).toBe(false); // total ちょうど 5
    expect(shouldGroupCompleted(planSummary(many(1, 8)))).toBe(false); // 完了 1 件
    expect(shouldGroupCompleted(planSummary(many(3, 8)))).toBe(true);
  });
});

describe('parseUpdatePlanInput', () => {
  it('正常な todos を PlanTodo[] に変換', () => {
    const out = parseUpdatePlanInput({
      todos: [
        { content: 'A', status: 'completed', activeForm: 'A 中' },
        { content: 'B', status: 'in_progress', activeForm: 'B 中' },
      ],
    });
    expect(out).toEqual([
      { content: 'A', status: 'completed', activeForm: 'A 中' },
      { content: 'B', status: 'in_progress', activeForm: 'B 中' },
    ]);
  });

  it('activeForm 欠落は content で代替 (厳格には落とさない)', () => {
    const out = parseUpdatePlanInput({ todos: [{ content: 'A', status: 'pending' }] });
    expect(out).toEqual([{ content: 'A', status: 'pending', activeForm: 'A' }]);
  });

  it('空 todos は空配列 (計画クリア扱い)', () => {
    expect(parseUpdatePlanInput({ todos: [] })).toEqual([]);
  });

  it('不正入力は null', () => {
    expect(parseUpdatePlanInput(null)).toBeNull();
    expect(parseUpdatePlanInput({})).toBeNull(); // todos 欠落
    expect(parseUpdatePlanInput({ todos: 'x' })).toBeNull(); // 配列でない
    expect(parseUpdatePlanInput({ todos: [{ status: 'pending', activeForm: 'x' }] })).toBeNull(); // content 欠落
    expect(parseUpdatePlanInput({ todos: [{ content: 'A', status: 'done' }] })).toBeNull(); // status enum 外
    expect(parseUpdatePlanInput({ todos: [{ content: '', status: 'pending' }] })).toBeNull(); // 空 content
  });
});
