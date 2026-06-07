// Scene step DSL for chat-panel animations (consumed by src/scripts/lp.ts).
export type SceneStep =
  | { show: string[]; hold?: number }
  | { type: string; cps?: number; after?: number }
  | { clear: true };
