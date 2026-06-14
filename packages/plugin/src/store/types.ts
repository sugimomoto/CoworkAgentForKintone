// Cowork Agent for kintone — チャット状態管理の型定義
//
// ChatState は store/slices/* の各スライスが実装する全フィールド + アクションの集合。
// スライスは StateCreator<ChatState, ...> でこの型を参照する (実体の合成は chatStore.ts)。

import type { AccessContext } from '../core/access/filterAgentsByAccess';
import type { Artifact, CreateArtifactInput } from '../core/artifacts/types';
import type { AgentRecord } from '../core/bootstrap/agentTypes';
import type { ChatMessage, ToolMessage } from '../core/chat/types';
import type { AttachedFile } from '../core/files/types';
import type { AgentEditDraft } from '../core/managed-agents/agentDetailApi';
import type { ProgressEventKind } from '../core/managed-agents/progressEvent';

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
export type BindingStatus = 'unknown' | 'checking' | 'unbound' | 'binding' | 'bound' | 'error';

/** 進行 event スナップショット (進行インジケータの表示元) */
export interface LastEventSnapshot {
  at: number;
  kind: ProgressEventKind;
  toolName: string | null;
}

/** #48 propose_agent 受信時のモーダル展開シグナル */
export interface PendingAgentProposal {
  draft: AgentEditDraft;
  rationale: string;
  model: 'opus' | 'sonnet';
}

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
   * ターン非アクティブ時は全体が null (= インジケータ非表示扱い)。
   */
  lastEvent: LastEventSnapshot | null;
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
   */
  pendingAgentProposal: PendingAgentProposal | null;
  /**
   * Customizer wedge の rollback 用スナップショット (#20)。
   * key = artifact.id、value = apply 直前の旧 customize.js コンテンツ。
   * Plugin リロードで失われる (V1 制約、design.md Risk R3)。
   */
  workflowHistory: Map<string, string>;

  // ─── messageSlice ─────────────────────────────────────────────────────
  /** メッセージを末尾に追加 */
  addMessage: (msg: ChatMessage) => void;
  /**
   * id 重複時は no-op、ユーザー発言の場合はオプティミスティック追加分
   * (id プレフィックス `user-`、本文一致) を API 由来 (id プレフィックス `evt_`) で置換する。
   */
  mergeMessage: (msg: ChatMessage) => void;
  /** 指定 ID のメッセージを差し替え。見つからなければ no-op */
  replaceMessage: (id: string, next: ChatMessage) => void;
  /** 指定 ID のメッセージを削除 */
  removeMessage: (id: string) => void;
  /** Tool メッセージを id (= tool_use_id) で部分更新する。該当無し / kind!=='tool' は no-op。 */
  updateTool: (toolUseId: string, patch: Partial<Omit<ToolMessage, 'id' | 'kind'>>) => void;

  // ─── sessionSlice ─────────────────────────────────────────────────────
  /** Session ID を設定 */
  setSessionId: (id: string | null) => void;
  /** Agent ID を設定 (bootstrap で解決後に呼ぶ) */
  setAgentId: (id: string | null) => void;
  /** Plugin ID を設定 (mount 時に固定する) */
  setPluginId: (id: string | null) => void;
  /** Status を設定。error 時のみ 2 番目の引数で詳細を渡す */
  setStatus: (status: ChatStatus, error?: string | null) => void;
  /** Agent ターン進行中フラグの更新 */
  setAgentRunning: (running: boolean) => void;
  /** 進行 event スナップショットを設定 (null で消去)。`at` は epoch ms */
  setLastEvent: (snapshot: LastEventSnapshot | null) => void;
  /** Session terminated フラグの更新 */
  setSessionTerminated: (terminated: boolean) => void;
  /** 表示モードを切替 */
  setView: (view: ChatView) => void;

  // ─── bindingSlice ─────────────────────────────────────────────────────
  /** Vault ID を設定 */
  setVaultId: (id: string | null) => void;
  /** Vault Credential ID を設定 */
  setCredentialId: (id: string | null) => void;
  /** バインディング状態を設定。'error' のときのみ第 2 引数のメッセージを保持する */
  setBindingStatus: (status: BindingStatus, error?: string | null) => void;

  // ─── agentSlice (Customizer wedge V1) ─────────────────────────────────
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
  /** apply 直前の customize.js を snapshot 保存 (rollback 用)。同 id では上書きしない。 */
  saveWorkflowSnapshot: (artifactId: string, prevJs: string) => void;
  /** rollback 完了後にスナップショットを破棄 */
  clearWorkflowSnapshot: (artifactId: string) => void;
  /** #48 propose_agent 受信時にモーダル展開シグナルをセット。null でクリア。 */
  setPendingAgentProposal: (next: PendingAgentProposal | null) => void;
  setCurrentUserAccess: (next: AccessContext | null) => void;
  /** admin 判定解決後に値を入れる (true/false)。null から戻ることはない */
  setIsAdminResolved: (value: boolean) => void;

  // ─── artifactSlice ────────────────────────────────────────────────────
  /** Artifact を新規追加 or 同 id 更新する。戻り値は反映後の Artifact。 */
  upsertArtifact: (input: CreateArtifactInput) => Artifact;
  /** Anthropic Files API で検出した session ファイルを binary artifact として登録する。 */
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

  // ─── fileSlice ────────────────────────────────────────────────────────
  /** 添付ファイルを追加 (末尾) */
  addAttachedFile: (file: AttachedFile) => void;
  /** 部分更新 (status / errorText / content など)。該当 localId が無ければ no-op */
  updateAttachedFile: (localId: string, patch: Partial<Omit<AttachedFile, 'localId'>>) => void;
  /** 1 件削除 */
  removeAttachedFile: (localId: string) => void;
  /** 全削除 */
  clearAttachedFiles: () => void;

  // ─── 跨りオペレーション (chatStore.ts で合成) ─────────────────────────
  /** 全て初期化 (接続情報リセット等の後に呼ぶ) */
  reset: () => void;
  /** 会話履歴だけ初期化し、Session は保つ */
  resetConversation: () => void;
  /** 新規会話を開始する (messages を空にし sessionId を null に戻す。view は維持)。 */
  startNewConversation: () => void;
}
