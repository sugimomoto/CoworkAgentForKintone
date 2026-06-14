import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type SessionActions = Pick<
  ChatState,
  | 'setSessionId'
  | 'setAgentId'
  | 'setPluginId'
  | 'setStatus'
  | 'setAgentRunning'
  | 'setLastEvent'
  | 'setSessionTerminated'
  | 'setView'
>;

export const createSessionSlice: StateCreator<ChatState, [], [], SessionActions> = (set) => ({
  setSessionId: (id) => set({ sessionId: id }),

  setAgentId: (id) => set({ agentId: id }),

  setPluginId: (id) => set({ pluginId: id }),

  setStatus: (status, error = null) => set({ status, error: status === 'error' ? error : null }),

  setAgentRunning: (running) =>
    set((s) => {
      // false → true への遷移でだけ開始時刻を記録 (true → true では更新しない)。
      // false に戻ったら null にリセット。あわせて進行 event 状態もクリアして
      // ProgressIndicator が確実に消えるようにする。
      if (running && !s.isAgentRunning) {
        return { isAgentRunning: true, agentRunningSince: Date.now() };
      }
      if (!running && s.isAgentRunning) {
        return { isAgentRunning: false, agentRunningSince: null, lastEvent: null };
      }
      return { isAgentRunning: running };
    }),

  setLastEvent: (snapshot) => set({ lastEvent: snapshot }),

  setSessionTerminated: (terminated) => set({ sessionTerminated: terminated }),

  setView: (view) => set({ view }),
});
