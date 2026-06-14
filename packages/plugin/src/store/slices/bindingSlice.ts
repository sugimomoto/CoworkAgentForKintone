import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type BindingActions = Pick<ChatState, 'setVaultId' | 'setCredentialId' | 'setBindingStatus'>;

export const createBindingSlice: StateCreator<ChatState, [], [], BindingActions> = (set) => ({
  setVaultId: (id) => set({ vaultId: id }),

  setCredentialId: (id) => set({ credentialId: id }),

  setBindingStatus: (status, error = null) =>
    set({ bindingStatus: status, bindingError: status === 'error' ? error : null }),
});
