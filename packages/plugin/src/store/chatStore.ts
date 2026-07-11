// Cowork Agent for kintone — チャット状態管理 (Zustand)
//
// プラグイン設定や localStorage には保存しない (§3.1 / §3.2 ステートレス原則)。
// ページ再読込時は useSession が metadata から Session を再解決する。
//
// 状態フィールド + アクションの型は store/types.ts、アクション実装は store/slices/* に分割。
// ここでは初期状態 (INITIAL_STATE) と各スライスの合成、複数スライスを跨ぐ操作
// (reset / resetConversation / startNewConversation) のみを持つ。

import { create } from 'zustand';

import { createAgentSlice } from './slices/agentSlice';
import { createArtifactSlice } from './slices/artifactSlice';
import { createBindingSlice } from './slices/bindingSlice';
import { createFileSlice } from './slices/fileSlice';
import { createMessageSlice } from './slices/messageSlice';
import { createPlanSlice } from './slices/planSlice';
import { createSessionSlice } from './slices/sessionSlice';

import type { BindingStatus, ChatState, ChatStatus, ChatView } from './types';
import type { Artifact } from '../core/artifacts/types';
import type { AgentRecord } from '../core/bootstrap/agentTypes';
import type { AttachedFile } from '../core/files/types';

export type {
  BinaryArtifactInput,
  BindingStatus,
  ChatState,
  ChatStatus,
  ChatView,
  LastEventSnapshot,
  PendingAgentProposal,
} from './types';

const INITIAL_STATE = {
  messages: [],
  sessionId: null,
  agentId: null,
  pluginId: null,
  vaultId: null,
  credentialId: null,
  bindingStatus: 'unknown' as BindingStatus,
  bindingError: null,
  status: 'idle' as ChatStatus,
  error: null,
  isAgentRunning: false,
  agentRunningSince: null as number | null,
  lastEvent: null as ChatState['lastEvent'],
  sessionTerminated: false,
  view: 'chat' as ChatView,
  artifacts: new Map<string, Artifact>(),
  activeArtifactId: null as string | null,
  pendingCustomToolUseIds: new Map<string, string>(),
  attachedFiles: [] as AttachedFile[],
  plan: null as ChatState['plan'],
  // Customizer wedge V1
  currentAgentId: null as string | null,
  builtInAgents: [] as AgentRecord[],
  memoryEnabled: false,
  workflowHistory: new Map<string, string>(),
  // #48 エージェントデザイナー
  pendingAgentProposal: null as ChatState['pendingAgentProposal'],
  currentUserAccess: null as ChatState['currentUserAccess'],
  isAdmin: null as boolean | null,
};

export const useChatStore = create<ChatState>()((...a) => {
  const [set] = a;
  return {
    ...INITIAL_STATE,
    ...createMessageSlice(...a),
    ...createSessionSlice(...a),
    ...createBindingSlice(...a),
    ...createAgentSlice(...a),
    ...createArtifactSlice(...a),
    ...createFileSlice(...a),
    ...createPlanSlice(...a),

    // ─── 跨りオペレーション ──────────────────────────────────────────────
    reset: () =>
      set({
        ...INITIAL_STATE,
        artifacts: new Map(),
        pendingCustomToolUseIds: new Map(),
        attachedFiles: [],
        builtInAgents: [],
        workflowHistory: new Map(),
      }),

    // #128: 履歴選択 (selectSession) はこれを呼ぶ。前セッションの計画を残さない。
    resetConversation: () => set({ messages: [], plan: null }),

    startNewConversation: () =>
      // #121: 会話リセットと添付クリアは分離する。添付は送信時 (handleSubmit の
      // clearAttachedFiles) / ユーザーの明示削除 / ハードリセット (reset) でのみ消す。
      // エージェント切替・新規会話開始では保持し、クイックアクション送信に添付が乗るようにする。
      set({
        messages: [],
        sessionId: null,
        isAgentRunning: false,
        agentRunningSince: null,
        lastEvent: null,
        sessionTerminated: false,
        artifacts: new Map(),
        activeArtifactId: null,
        pendingCustomToolUseIds: new Map(),
        pendingAgentProposal: null,
        plan: null,
      }),
  };
});
