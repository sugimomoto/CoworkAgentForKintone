import { binaryArtifactIdFromFileId } from '../../core/artifacts/types';

import type { Artifact } from '../../core/artifacts/types';
import type { ChatState } from '../types';
import type { StateCreator } from 'zustand';

type ArtifactActions = Pick<
  ChatState,
  | 'upsertArtifact'
  | 'upsertBinaryArtifact'
  | 'removeArtifact'
  | 'clearArtifacts'
  | 'setActiveArtifact'
  | 'addPendingCustomToolUse'
  | 'removePendingCustomToolUse'
>;

export const createArtifactSlice: StateCreator<ChatState, [], [], ArtifactActions> = (set) => ({
  upsertArtifact: (input) => {
    const now = Date.now();
    let result!: Artifact;
    set((s) => {
      const existing = s.artifacts.get(input.id);
      const next: Artifact = existing
        ? {
            ...existing,
            kind: input.kind,
            title: input.title,
            content: input.content,
            language: input.language,
            summary: input.summary,
            updatedAt: now,
            version: existing.version + 1,
          }
        : {
            id: input.id,
            kind: input.kind,
            title: input.title,
            content: input.content,
            language: input.language,
            summary: input.summary,
            createdAt: now,
            updatedAt: now,
            version: 1,
          };
      result = next;
      const artifacts = new Map(s.artifacts);
      artifacts.set(input.id, next);
      return { artifacts };
    });
    return result;
  },

  upsertBinaryArtifact: (input) => {
    const now = Date.now();
    const id = binaryArtifactIdFromFileId(input.fileId);
    let result!: Artifact;
    set((s) => {
      const existing = s.artifacts.get(id);
      const next: Artifact = existing
        ? {
            ...existing,
            kind: 'binary',
            title: input.filename,
            content: '',
            fileId: input.fileId,
            filename: input.filename,
            mime: input.mime,
            sizeBytes: input.sizeBytes,
            updatedAt: now,
            version: existing.version + 1,
          }
        : {
            id,
            kind: 'binary',
            title: input.filename,
            content: '',
            fileId: input.fileId,
            filename: input.filename,
            mime: input.mime,
            sizeBytes: input.sizeBytes,
            createdAt: now,
            updatedAt: now,
            version: 1,
          };
      result = next;
      const artifacts = new Map(s.artifacts);
      artifacts.set(id, next);
      return { artifacts };
    });
    return result;
  },

  removeArtifact: (id) =>
    set((s) => {
      if (!s.artifacts.has(id)) return s;
      const artifacts = new Map(s.artifacts);
      artifacts.delete(id);
      const activeArtifactId = s.activeArtifactId === id ? null : s.activeArtifactId;
      return { artifacts, activeArtifactId };
    }),

  clearArtifacts: () =>
    set({ artifacts: new Map(), activeArtifactId: null, pendingCustomToolUseIds: new Map() }),

  setActiveArtifact: (id) => set({ activeArtifactId: id }),

  addPendingCustomToolUse: (toolUseId, artifactId) =>
    set((s) => {
      if (s.pendingCustomToolUseIds.get(toolUseId) === artifactId) return s;
      const next = new Map(s.pendingCustomToolUseIds);
      next.set(toolUseId, artifactId);
      return { pendingCustomToolUseIds: next };
    }),

  removePendingCustomToolUse: (toolUseId) =>
    set((s) => {
      if (!s.pendingCustomToolUseIds.has(toolUseId)) return s;
      const next = new Map(s.pendingCustomToolUseIds);
      next.delete(toolUseId);
      return { pendingCustomToolUseIds: next };
    }),
});
