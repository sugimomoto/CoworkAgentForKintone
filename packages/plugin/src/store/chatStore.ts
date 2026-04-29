// Cowork Agent for kintone — チャット状態管理 (Zustand)
//
// プラグイン設定や localStorage には保存しない (§3.1 / §3.2 ステートレス原則)。
// ページ再読込時は useSession が metadata から Session を再解決する。

import { create } from 'zustand';

import type { Artifact, CreateArtifactInput } from '../core/artifacts/types';
import type { ChatMessage, ToolMessage } from '../desktop/components/MessageList';

export type ChatStatus = 'idle' | 'bootstrapping' | 'ready' | 'error';

/** パネル内の表示モード。chat = 会話画面 / history = 過去 Session 一覧 */
export type ChatView = 'chat' | 'history';

/**
 * ユーザー (Vault + Environment) のバインディング状態。
 * - unknown: 未調査 (mount 直後)
 * - checking: listVaults / listEnvironments 検索中
 * - unbound: 未バインド (CredentialDialog で入力が必要)
 * - binding: bind() 進行中
 * - bound: 完了 (vaultId / credentialId が store に揃っている)
 * - error: 検索 or 作成で失敗
 */
export type BindingStatus =
  | 'unknown'
  | 'checking'
  | 'unbound'
  | 'binding'
  | 'bound'
  | 'error';

export interface ChatState {
  /** 会話メッセージ (時系列) */
  messages: ChatMessage[];
  /** Managed Agents Session ID。初送信または履歴選択まで null */
  sessionId: string | null;
  /** Default Agent の ID。bootstrap 完了まで null */
  agentId: string | null;
  /** kintone プラグイン ID (起動時に固定される)。kintone proxy 呼出時の第 1 引数 */
  pluginId: string | null;
  /** ユーザー Vault の ID。bind 完了まで null */
  vaultId: string | null;
  /** ユーザー専用 Environment の ID。bind 完了まで null */
  credentialId: string | null;
  /** ユーザー (Vault + Environment) のバインディング状態 */
  bindingStatus: BindingStatus;
  /** bindingStatus === 'error' のときのエラーメッセージ */
  bindingError: string | null;
  /** 現在のブートストラップ / 接続状態 */
  status: ChatStatus;
  /** status === 'error' のときのエラーメッセージ */
  error: string | null;
  /** Agent ターン進行中フラグ (session.status_running 〜 status_idle/terminal) */
  isAgentRunning: boolean;
  /**
   * Agent ターンが running に入った時刻 (epoch ms)。idle に戻ると null。
   * UI で「○秒待機中」の表示や「応答が遅い」バナーの判定に使う。
   */
  agentRunningSince: number | null;
  /** Session が terminated (Anthropic 側で完全終了) になったかどうか */
  sessionTerminated: boolean;
  /** 現在のパネル表示 (チャット or 履歴) */
  view: ChatView;
  /**
   * Agent が `create_artifact` ツールで生成した成果物。session スコープ。
   * Map をそのまま使うので set 時は new Map(prev) で再生成する (Zustand の等値判定対策)
   */
  artifacts: Map<string, Artifact>;
  /** ArtifactPane で表示中の Artifact ID。null なら ペイン非表示 */
  activeArtifactId: string | null;
  /**
   * 未応答の `custom_tool_use_id → artifact.id` マップ。
   * Agent が create_artifact を呼ぶと add され、Anthropic が user.custom_tool_result を
   * 受領 (= events に echo back) したら delete される。
   * useCustomToolResponder がこの Map を見て POST / リトライする。
   */
  pendingCustomToolUseIds: Map<string, string>;

  /** メッセージを末尾に追加 */
  addMessage: (msg: ChatMessage) => void;
  /**
   * id 重複時は no-op、ユーザー発言の場合はオプティミスティック追加分
   * (id プレフィックス `user-`、本文一致) を API 由来 (id プレフィックス `evt_`) で置換する。
   * イベントポーリングからの復元と送信直後のオプティミスティック表示を両立させるための merge。
   */
  mergeMessage: (msg: ChatMessage) => void;
  /** 指定 ID のメッセージを差し替え。見つからなければ no-op */
  replaceMessage: (id: string, next: ChatMessage) => void;
  /** 指定 ID のメッセージを削除 */
  removeMessage: (id: string) => void;
  /**
   * Tool メッセージを id (= tool_use_id) で部分更新する。
   * 該当 ID が無い、または kind !== 'tool' の場合は no-op。
   */
  updateTool: (toolUseId: string, patch: Partial<Omit<ToolMessage, 'id' | 'kind'>>) => void;

  /** Session ID を設定 */
  setSessionId: (id: string | null) => void;
  /** Agent ID を設定 (bootstrap で解決後に呼ぶ) */
  setAgentId: (id: string | null) => void;
  /** Plugin ID を設定 (mount 時に固定する) */
  setPluginId: (id: string | null) => void;
  /** Vault ID を設定 */
  setVaultId: (id: string | null) => void;
  /** Vault Credential ID を設定 */
  setCredentialId: (id: string | null) => void;
  /** バインディング状態を設定。'error' のときのみ第 2 引数のメッセージを保持する */
  setBindingStatus: (status: BindingStatus, error?: string | null) => void;
  /** Status を設定。error 時のみ 2 番目の引数で詳細を渡す */
  setStatus: (status: ChatStatus, error?: string | null) => void;
  /** Agent ターン進行中フラグの更新 */
  setAgentRunning: (running: boolean) => void;
  /** Session terminated フラグの更新 */
  setSessionTerminated: (terminated: boolean) => void;
  /** 表示モードを切替 */
  setView: (view: ChatView) => void;

  /**
   * Artifact を新規追加 or 同 id 更新する。
   * 同じ id が既にあれば content/title 等を上書きし、version を +1、updatedAt を現在時刻に。
   * 戻り値は反映後の Artifact (呼出側で result 返却に使う)。
   */
  upsertArtifact: (input: CreateArtifactInput) => Artifact;
  /** Artifact を削除 */
  removeArtifact: (id: string) => void;
  /** 全 Artifact を削除 */
  clearArtifacts: () => void;
  /** 表示中の Artifact ID を変更 (null で ペインを閉じる) */
  setActiveArtifact: (id: string | null) => void;

  /** 未応答 custom_tool_use を追跡 (responder hook が POST / リトライする) */
  addPendingCustomToolUse: (toolUseId: string, artifactId: string) => void;
  removePendingCustomToolUse: (toolUseId: string) => void;

  /** 全て初期化 (接続情報リセット等の後に呼ぶ) */
  reset: () => void;
  /** 会話履歴だけ初期化し、Session は保つ */
  resetConversation: () => void;
  /**
   * 新規会話を開始する。
   * messages を空にし sessionId を null に戻す (view は維持)。
   * 次のユーザー送信で新しい Session が作成される。
   */
  startNewConversation: () => void;
}

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
  sessionTerminated: false,
  view: 'chat' as ChatView,
  artifacts: new Map<string, Artifact>(),
  activeArtifactId: null as string | null,
  pendingCustomToolUseIds: new Map<string, string>(),
};

export const useChatStore = create<ChatState>((set) => ({
  ...INITIAL_STATE,

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

  removeMessage: (id) =>
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

  updateTool: (toolUseId, patch) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === toolUseId && m.kind === 'tool');
      if (idx < 0) return s;
      const messages = s.messages.slice();
      messages[idx] = { ...(messages[idx] as ToolMessage), ...patch };
      return { messages };
    }),

  setSessionId: (id) => set({ sessionId: id }),

  setAgentId: (id) => set({ agentId: id }),

  setPluginId: (id) => set({ pluginId: id }),

  setVaultId: (id) => set({ vaultId: id }),

  setCredentialId: (id) => set({ credentialId: id }),

  setBindingStatus: (status, error = null) =>
    set({ bindingStatus: status, bindingError: status === 'error' ? error : null }),

  setStatus: (status, error = null) => set({ status, error: status === 'error' ? error : null }),

  setAgentRunning: (running) =>
    set((s) => {
      // false → true への遷移でだけ開始時刻を記録 (true → true では更新しない)。
      // false に戻ったら null にリセット。
      if (running && !s.isAgentRunning) {
        return { isAgentRunning: true, agentRunningSince: Date.now() };
      }
      if (!running && s.isAgentRunning) {
        return { isAgentRunning: false, agentRunningSince: null };
      }
      return { isAgentRunning: running };
    }),

  setSessionTerminated: (terminated) => set({ sessionTerminated: terminated }),

  setView: (view) => set({ view }),

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

  reset: () =>
    set({
      ...INITIAL_STATE,
      artifacts: new Map(),
      pendingCustomToolUseIds: new Map(),
    }),

  resetConversation: () => set({ messages: [] }),

  startNewConversation: () =>
    set({
      messages: [],
      sessionId: null,
      isAgentRunning: false,
      agentRunningSince: null,
      sessionTerminated: false,
      artifacts: new Map(),
      activeArtifactId: null,
      pendingCustomToolUseIds: new Map(),
    }),
}));
