// Cowork Agent for kintone — タスク計画スライス (#128)
//
// Agent が `update_plan` custom tool を呼ぶたびに現在の全サブタスク一覧で置き換える
// (TodoWrite 正典準拠 / full-replace)。session スコープ — 履歴選択・新規会話・reset で
// クリアされる (chatStore.ts の resetConversation / startNewConversation / reset)。
// 空配列は「計画なし」とみなし null に正規化して PlanPanel を非表示にする。

import type { PlanTodo } from '../../core/chat/planTodos';
import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type PlanActions = Pick<ChatState, 'setPlan' | 'clearPlan'>;

export const createPlanSlice: StateCreator<ChatState, [], [], PlanActions> = (set) => ({
  setPlan: (todos) => set({ plan: todos.length > 0 ? todos : null }),
  clearPlan: () => set({ plan: null }),
});

export type { PlanTodo };
