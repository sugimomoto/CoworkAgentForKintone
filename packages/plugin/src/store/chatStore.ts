// Cowork Agent for kintone — チャット状態管理 (Zustand)
//
// プラグイン設定や localStorage には保存しない (§3.1 / §3.2 ステートレス原則)。
// ページ再読込時は useSession が metadata から Session を再解決する。

import { create } from 'zustand';

import { binaryArtifactIdFromFileId } from '../core/artifacts/types';

import type { AccessContext } from '../core/access/filterAgentsByAccess';
import type { Artifact, CreateArtifactInput } from '../core/artifacts/types';
import type { AgentRecord } from '../core/bootstrap/agentTypes';
import type { AttachedFile } from '../core/files/types';
import type { AgentEditDraft } from '../core/managed-agents/agentDetailApi';
import type { ProgressEventKind } from '../core/managed-agents/progressEvent';
import type { ChatMessage, ToolMessage } from '../desktop/components/MessageList';

export interface BinaryArtifactInput {
  fileId: string;
  filename: string;
  mime?: string;
  sizeBytes?: number;
}

export type ChatStatus = 'idle' | 'bootstrapping' | 'ready' | 'error';

/**
 * パネル内の表示モード。
 * - 'chat': 会話画面 (Conversation View、既定)
 * - 'history': 過去 Session 一覧
 * - 'settings': admin 専用設定画面 (Customizer wedge V1 で追加、Section 4.1 参照)
 */
export type ChatView = 'chat' | 'history' | 'settings';

/**
 * ユーザー (Vault + Environment) のバインディング状態。
 * - unknown: 未調査 (mount 直後)
 * - checking: listVaults / listEnvironments 検索中
 * - unbound: 未バインド (kintone OAuth 連携ボタンで認可が必要)
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
  /**
   * 直近の進行 event スナップショット。進行インジケータの表示元。
   * - at:       受信時刻 (epoch ms)。経過秒の起点
   * - kind:     進行種別 (思考中 / ツール実行中 / 等)
   * - toolName: tool_use 系のみ tool 名、それ以外 null
   * ターン非アクティブ時は全体が null (= インジケータ非表示扱い)。
   */
  lastEvent: { at: number; kind: ProgressEventKind; toolName: string | null } | null;
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
  /**
   * Composer から添付されたファイル一覧 (送信前)。
   * 送信完了 / 新規セッション開始 / reset でクリア。
   */
  attachedFiles: AttachedFile[];

  // ─── Customizer wedge V1 で追加 (Section 2.3) ─────────────────────────
  /**
   * 現在のターン用 Agent ID。Header プルダウンで切替されると新規会話の起点になる。
   * resolveBuiltInAgents 完了後に builtInAgents から isDefault=true を初期値に設定。
   */
  currentAgentId: string | null;
  /**
   * Built-in 3 variant の解決結果 (resolveBuiltInAgents の戻り値を Plugin metadata 付きで整形)。
   * Header の Agent プルダウン / Settings View の AgentsListPane で参照。
   */
  builtInAgents: AgentRecord[];
  /**
   * Memory トグル状態 (V1 は常に false に固定、UI placeholder)。
   * V2 で機能化されると Session 作成時に (user × agent) Memory Store を attach する。
   */
  memoryEnabled: boolean;
  /** 現ユーザーの所属 (groups / organizations コード一覧)。null = 未取得 / 失敗。 */
  currentUserAccess: AccessContext | null;

  /** cybozu.com 共通管理者か。null = 未解決 (= filter を保留して全 Agent 表示)。 */
  isAdmin: boolean | null;

  /**
   * #48 エージェントデザイナーの `propose_agent` 受信で発火する「全項目入力済モーダルを開く」シグナル。
   * ChatPanel がこれを購読して `<AgentDetailModal mode='create-from-proposal'>` を描画する。
   * AgentEditDraft 自体は永続化スキーマとして純粋に保ち、rationale はここに別フィールドで持つ。
   */
  pendingAgentProposal: { draft: AgentEditDraft; rationale: string; model: 'opus' | 'sonnet' } | null;

  /**
   * Customizer wedge の rollback 用スナップショット (#20)。
   * key = artifact.id、value = apply 直前の旧 customize.js コンテンツ。
   * Plugin リロードで失われる (V1 制約、design.md Risk R3)。
   */
  workflowHistory: Map<string, string>;

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
  /** 進行 event スナップショットを設定 (null で消去)。`at` は epoch ms */
  setLastEvent: (
    snapshot: { at: number; kind: ProgressEventKind; toolName: string | null } | null,
  ) => void;
  /** Session terminated フラグの更新 */
  setSessionTerminated: (terminated: boolean) => void;
  /** 表示モードを切替 */
  setView: (view: ChatView) => void;

  // ─── Customizer wedge V1 setter ───────────────────────────────────────
  /** Header プルダウンで Agent を切替 (呼出側で startNewConversation も呼ぶ) */
  setCurrentAgentId: (id: string | null) => void;
  /** resolveBuiltInAgents 完了時に 3 variant をまとめてセット */
  setBuiltInAgents: (agents: AgentRecord[]) => void;
  /** 1 件分の Agent を id ベースで upsert (Custom Agent 追加/編集後の反映) — #40 */
  upsertAgent: (record: AgentRecord) => void;
  /** Agent を builtInAgents から除去 (Custom Agent 削除後) — #40 */
  removeAgent: (agentId: string) => void;
  /** Memory トグル切替 (V1 は呼び出されないが API として用意) */
  setMemoryEnabled: (enabled: boolean) => void;
  /**
   * apply 直前の customize.js を snapshot 保存 (rollback 用)。
   * 同じ artifactId で再 apply するときは上書きしない (= 最古のスナップショットを保持) — TODO: 要検討
   */
  saveWorkflowSnapshot: (artifactId: string, prevJs: string) => void;
  /** rollback 完了後にスナップショットを破棄 */
  clearWorkflowSnapshot: (artifactId: string) => void;

  /** #48 propose_agent 受信時にモーダル展開シグナルをセット。null でクリア。 */
  setPendingAgentProposal: (next: { draft: AgentEditDraft; rationale: string; model: 'opus' | 'sonnet' } | null) => void;

  setCurrentUserAccess: (next: AccessContext | null) => void;
  /** admin 判定解決後に値を入れる (true/false)。null から戻ることはない */
  setIsAdminResolved: (value: boolean) => void;

  /**
   * Artifact を新規追加 or 同 id 更新する。
   * 同じ id が既にあれば content/title 等を上書きし、version を +1、updatedAt を現在時刻に。
   * 戻り値は反映後の Artifact (呼出側で result 返却に使う)。
   */
  upsertArtifact: (input: CreateArtifactInput) => Artifact;
  /**
   * Anthropic Files API で検出した session ファイルを binary artifact として登録する。
   * 同じ file_id で再呼出しても何もしない (artifact map のキーは file_id 由来で安定)。
   */
  upsertBinaryArtifact: (input: BinaryArtifactInput) => Artifact;
  /** Artifact を削除 */
  removeArtifact: (id: string) => void;
  /** 全 Artifact を削除 */
  clearArtifacts: () => void;
  /** 表示中の Artifact ID を変更 (null で ペインを閉じる) */
  setActiveArtifact: (id: string | null) => void;

  /** 未応答 custom_tool_use を追跡 (responder hook が POST / リトライする) */
  addPendingCustomToolUse: (toolUseId: string, artifactId: string) => void;
  removePendingCustomToolUse: (toolUseId: string) => void;

  /** 添付ファイルを追加 (末尾) */
  addAttachedFile: (file: AttachedFile) => void;
  /** 部分更新 (status / errorText / content など)。該当 localId が無ければ no-op */
  updateAttachedFile: (localId: string, patch: Partial<Omit<AttachedFile, 'localId'>>) => void;
  /** 1 件削除 */
  removeAttachedFile: (localId: string) => void;
  /** 全削除 */
  clearAttachedFiles: () => void;

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
  lastEvent: null as ChatState['lastEvent'],
  sessionTerminated: false,
  view: 'chat' as ChatView,
  artifacts: new Map<string, Artifact>(),
  activeArtifactId: null as string | null,
  pendingCustomToolUseIds: new Map<string, string>(),
  attachedFiles: [] as AttachedFile[],
  // Customizer wedge V1
  currentAgentId: null as string | null,
  builtInAgents: [] as AgentRecord[],
  memoryEnabled: false,
  workflowHistory: new Map<string, string>(),
  // #48 エージェントデザイナー
  pendingAgentProposal: null as { draft: AgentEditDraft; rationale: string; model: 'opus' | 'sonnet' } | null,
  currentUserAccess: null as AccessContext | null,
  isAdmin: null as boolean | null,
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
      // false に戻ったら null にリセット。あわせて進行 event 状態もクリアして
      // ProgressIndicator が確実に消えるようにする。
      if (running && !s.isAgentRunning) {
        return { isAgentRunning: true, agentRunningSince: Date.now() };
      }
      if (!running && s.isAgentRunning) {
        return {
          isAgentRunning: false,
          agentRunningSince: null,
          lastEvent: null,
        };
      }
      return { isAgentRunning: running };
    }),

  setLastEvent: (snapshot) => set({ lastEvent: snapshot }),

  setSessionTerminated: (terminated) => set({ sessionTerminated: terminated }),

  setView: (view) => set({ view }),

  setCurrentAgentId: (id) => set({ currentAgentId: id }),

  setBuiltInAgents: (agents) => set({ builtInAgents: agents }),

  upsertAgent: (record) =>
    set((s) => {
      const idx = s.builtInAgents.findIndex((a) => a.id === record.id);
      if (idx === -1) return { builtInAgents: [...s.builtInAgents, record] };
      const next = s.builtInAgents.slice();
      next[idx] = record;
      return { builtInAgents: next };
    }),

  removeAgent: (agentId) =>
    set((s) => ({
      builtInAgents: s.builtInAgents.filter((a) => a.id !== agentId),
    })),

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

  reset: () =>
    set({
      ...INITIAL_STATE,
      artifacts: new Map(),
      pendingCustomToolUseIds: new Map(),
      attachedFiles: [],
      builtInAgents: [],
      workflowHistory: new Map(),
    }),

  resetConversation: () => set({ messages: [] }),

  startNewConversation: () =>
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
      attachedFiles: [],
      pendingAgentProposal: null,
    }),
}));
