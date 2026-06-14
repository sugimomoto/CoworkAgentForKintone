import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type FileActions = Pick<
  ChatState,
  'addAttachedFile' | 'updateAttachedFile' | 'removeAttachedFile' | 'clearAttachedFiles'
>;

export const createFileSlice: StateCreator<ChatState, [], [], FileActions> = (set) => ({
  addAttachedFile: (file) => set((s) => ({ attachedFiles: [...s.attachedFiles, file] })),

  updateAttachedFile: (localId, patch) =>
    set((s) => {
      const idx = s.attachedFiles.findIndex((f) => f.localId === localId);
      if (idx < 0) return s;
      const next = s.attachedFiles.slice();
      next[idx] = { ...next[idx]!, ...patch };
      return { attachedFiles: next };
    }),

  removeAttachedFile: (localId) =>
    set((s) => ({ attachedFiles: s.attachedFiles.filter((f) => f.localId !== localId) })),

  clearAttachedFiles: () => set({ attachedFiles: [] }),
});
