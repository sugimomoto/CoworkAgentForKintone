// Cowork Agent for kintone — チャット状態管理 (Zustand)
//
// プラグイン設定や localStorage には保存しない (§3.1 / §3.2 ステートレス原則)。
// ページ再読込時は useSession が metadata から Session を再解決する。

import { create } from 'zustand';

import type { ChatMessage } from '../desktop/components/MessageList';

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
  /** 現在のパネル表示 (チャット or 履歴) */
  view: ChatView;

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

  /** Session ID を設定 */
  setSessionId: (id: string | null) => void;
  /** Agent ID を設定 (bootstrap で解決後に呼ぶ) */
  setAgentId: (id: string | null) => void;
  /** Vault ID を設定 */
  setVaultId: (id: string | null) => void;
  /** Vault Credential ID を設定 (Phase 1b-2 改訂で旧 userEnvironmentId から改名) */
  setCredentialId: (id: string | null) => void;
  /** バインディング状態を設定。'error' のときのみ第 2 引数のメッセージを保持する */
  setBindingStatus: (status: BindingStatus, error?: string | null) => void;
  /** Status を設定。error 時のみ 2 番目の引数で詳細を渡す */
  setStatus: (status: ChatStatus, error?: string | null) => void;
  /** 表示モードを切替 */
  setView: (view: ChatView) => void;

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
  vaultId: null,
  credentialId: null,
  bindingStatus: 'unknown' as BindingStatus,
  bindingError: null,
  status: 'idle' as ChatStatus,
  error: null,
  view: 'chat' as ChatView,
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

  setSessionId: (id) => set({ sessionId: id }),

  setAgentId: (id) => set({ agentId: id }),

  setVaultId: (id) => set({ vaultId: id }),

  setCredentialId: (id) => set({ credentialId: id }),

  setBindingStatus: (status, error = null) =>
    set({ bindingStatus: status, bindingError: status === 'error' ? error : null }),

  setStatus: (status, error = null) => set({ status, error: status === 'error' ? error : null }),

  setView: (view) => set({ view }),

  reset: () => set({ ...INITIAL_STATE }),

  resetConversation: () => set({ messages: [] }),

  startNewConversation: () => set({ messages: [], sessionId: null }),
}));
