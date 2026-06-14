import { upsertInArray } from '../utils';

import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type AgentActions = Pick<
  ChatState,
  | 'setCurrentAgentId'
  | 'setBuiltInAgents'
  | 'upsertAgent'
  | 'removeAgent'
  | 'setMemoryEnabled'
  | 'saveWorkflowSnapshot'
  | 'clearWorkflowSnapshot'
  | 'setPendingAgentProposal'
  | 'setCurrentUserAccess'
  | 'setIsAdminResolved'
>;

export const createAgentSlice: StateCreator<ChatState, [], [], AgentActions> = (set) => ({
  setCurrentAgentId: (id) => set({ currentAgentId: id }),

  setBuiltInAgents: (agents) => set({ builtInAgents: agents }),

  upsertAgent: (record) =>
    set((s) => ({ builtInAgents: upsertInArray(s.builtInAgents, record, (a) => a.id) })),

  removeAgent: (agentId) =>
    set((s) => ({ builtInAgents: s.builtInAgents.filter((a) => a.id !== agentId) })),

  setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),

  saveWorkflowSnapshot: (artifactId, prevJs) =>
    set((s) => {
      // 既存スナップショットがあれば最古を保持 (= 上書きしない)
      if (s.workflowHistory.has(artifactId)) return s;
      const next = new Map(s.workflowHistory);
      next.set(artifactId, prevJs);
      return { workflowHistory: next };
    }),

  clearWorkflowSnapshot: (artifactId) =>
    set((s) => {
      if (!s.workflowHistory.has(artifactId)) return s;
      const next = new Map(s.workflowHistory);
      next.delete(artifactId);
      return { workflowHistory: next };
    }),

  setPendingAgentProposal: (next) => set({ pendingAgentProposal: next }),

  setCurrentUserAccess: (next) => set({ currentUserAccess: next }),

  setIsAdminResolved: (value) => set({ isAdmin: value }),
});
