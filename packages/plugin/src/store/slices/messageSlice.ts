import type { ToolMessage } from '../../core/chat/types';
import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type MessageActions = Pick<
  ChatState,
  'addMessage' | 'mergeMessage' | 'replaceMessage' | 'removeMessage' | 'updateTool'
>;

export const createMessageSlice: StateCreator<ChatState, [], [], MessageActions> = (set) => ({
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  mergeMessage: (msg) =>
    set((s) => {
      if (s.messages.some((m) => m.id === msg.id)) return s;
      if (msg.kind === 'user') {
        const idx = s.messages.findIndex(
          (m) => m.kind === 'user' && m.text === msg.text && m.id.startsWith('user-'),
        );
        if (idx >= 0) {
          const messages = s.messages.slice();
          messages[idx] = msg;
          return { messages };
        }
      }
      return { messages: [...s.messages, msg] };
    }),

  replaceMessage: (id, next) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id);
      if (idx < 0) return s;
      const messages = s.messages.slice();
      messages[idx] = next;
      return { messages };
    }),

  removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

  updateTool: (toolUseId, patch) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === toolUseId && m.kind === 'tool');
      if (idx < 0) return s;
      const messages = s.messages.slice();
      messages[idx] = { ...(messages[idx] as ToolMessage), ...patch };
      return { messages };
    }),
});
