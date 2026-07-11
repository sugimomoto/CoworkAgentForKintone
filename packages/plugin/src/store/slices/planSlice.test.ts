import { describe, it, expect, beforeEach } from 'vitest';

import { useChatStore } from '../chatStore';

import type { PlanTodo } from '../../core/chat/planTodos';

const plan: PlanTodo[] = [
  { content: 'A', status: 'in_progress', activeForm: 'A 中' },
  { content: 'B', status: 'pending', activeForm: 'B 中' },
];

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('planSlice (#128)', () => {
  it('初期状態は plan が null', () => {
    expect(useChatStore.getState().plan).toBeNull();
  });

  it('setPlan で現在のリストを保持する', () => {
    useChatStore.getState().setPlan(plan);
    expect(useChatStore.getState().plan).toEqual(plan);
  });

  it('setPlan は呼ぶたびに全置換する (full-replace)', () => {
    useChatStore.getState().setPlan(plan);
    const next: PlanTodo[] = [{ content: 'C', status: 'completed', activeForm: 'C 中' }];
    useChatStore.getState().setPlan(next);
    expect(useChatStore.getState().plan).toEqual(next);
  });

  it('空配列は null に正規化して PlanPanel を非表示にする', () => {
    useChatStore.getState().setPlan(plan);
    useChatStore.getState().setPlan([]);
    expect(useChatStore.getState().plan).toBeNull();
  });

  it('clearPlan で null に戻す', () => {
    useChatStore.getState().setPlan(plan);
    useChatStore.getState().clearPlan();
    expect(useChatStore.getState().plan).toBeNull();
  });

  it('resetConversation (履歴選択) で plan をクリアする', () => {
    useChatStore.getState().setPlan(plan);
    useChatStore.getState().resetConversation();
    expect(useChatStore.getState().plan).toBeNull();
  });

  it('startNewConversation で plan をクリアする', () => {
    useChatStore.getState().setPlan(plan);
    useChatStore.getState().startNewConversation();
    expect(useChatStore.getState().plan).toBeNull();
  });
});
