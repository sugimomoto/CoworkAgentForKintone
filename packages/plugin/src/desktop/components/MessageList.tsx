// Cowork Agent for kintone — メッセージ一覧
//
// kind 別に対応するコンポーネントへ振り分ける。

import { AgentMessage } from './MessageItem/AgentMessage';
import { ArtifactRefMessage } from './MessageItem/ArtifactRefMessage';
import { ThinkingStatic } from './MessageItem/ThinkingStatic';
import { ToolCardMessage } from './MessageItem/ToolCardMessage';
import { UserMessage } from './MessageItem/UserMessage';
import { ProgressIndicator } from './ProgressIndicator';

import type { ArtifactKind } from '../../core/artifacts/types';
import type { AgentPhase } from '../hooks/useAgentPhase';

export type ToolStatus = 'running' | 'success' | 'error' | 'pending-confirmation' | 'rejected';

export interface ToolMessage {
  /** tool_use_id をそのまま使う (後続 tool_result の突合キー) */
  id: string;
  kind: 'tool';
  /** ツール名 (例: 'kintone-update-record') */
  name: string;
  /** tool_use.input */
  input: unknown;
  status: ToolStatus;
  /** tool_result.content (success / error 時) */
  result?: unknown;
  /** is_error=true の content から抽出したテキスト (リセット用に明示 undefined を許容) */
  errorText?: string | undefined;
}

/**
 * 会話ストリームに残す Artifact 参照タイル。本文は chatStore.artifacts から取得する。
 * クリックで ArtifactPane を開く (setActiveArtifact 経由)。
 */
export interface ArtifactRefChatMessage {
  id: string;
  kind: 'artifact-ref';
  artifactId: string;
  /** 表示用 (artifact 削除時のフォールバック) */
  title: string;
  artifactKind: ArtifactKind;
}

export type ChatMessage =
  | {
      id: string;
      kind: 'user';
      text: string;
      /** 送信時に添付したファイル一覧 (バブル上部にラベル表示用) */
      attachments?: Array<{ filename: string; kind: import('../../core/files/types').AttachmentKind }>;
    }
  | { id: string; kind: 'agent'; text: string }
  | { id: string; kind: 'thinking' }
  | ToolMessage
  | ArtifactRefChatMessage;

export interface MessageListProps {
  messages: ChatMessage[];
  /** 承認ボタン押下 (tool kind, pending-confirmation のみ) */
  onApproveTool?: (toolUseId: string) => void;
  /** 却下ボタン押下 (tool kind, pending-confirmation のみ) */
  onRejectTool?: (toolUseId: string) => void;
  /** 失敗ツールの再試行依頼 (tool kind, error のみ) */
  onRetryTool?: (toolUseId: string) => void;
  /** Artifact 参照タイルのクリック (artifact-ref kind のみ) */
  onOpenArtifact?: (artifactId: string) => void;
  /**
   * 現在のターン局面。`idle` のとき完了 divider を出す / retry ボタンを出す等で参照する。
   * 既存テストとの互換のため省略時は idle 扱い (= retry 可、divider 出る)。
   */
  agentPhase?: AgentPhase;
}

export function MessageList({
  messages,
  onApproveTool,
  onRejectTool,
  onRetryTool,
  onOpenArtifact,
  agentPhase = 'idle',
}: MessageListProps): JSX.Element {
  const isIdle = agentPhase === 'idle';

  // 「もう一度試す」ボタンは履歴の中で **最後の error tool カード** にだけ出す。
  // (複数 error が積み上がってもボタンは 1 つだけ → 連打 / 混乱を防ぐ)
  // ターン進行中は出さない (retry クリック後に Agent が処理している間は連打不可)
  let lastErrorToolId: string | null = null;
  if (isIdle) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.kind === 'tool' && m.status === 'error') {
        lastErrorToolId = m.id;
        break;
      }
    }
  }

  // ターン完了 divider: phase===idle かつ Agent が一度でも返答 (agent/tool/artifact-ref) を
  // 返したことがあるときに、メッセージ末尾に「✓ 応答完了」divider を表示。
  // useAgentPhase 側で pending-thinking / pending custom_tool / awaiting-confirm を
  // 既に running / awaiting-confirm 扱いにしているので、ここでは追加チェック不要。
  const showCompletedDivider =
    isIdle &&
    messages.some((m) => m.kind === 'agent' || m.kind === 'tool' || m.kind === 'artifact-ref');

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-[16px] py-[18px]">
      {messages.map((m) => {
        const showRetry = m.kind === 'tool' && m.id === lastErrorToolId;
        const rendered = renderMessage(
          m,
          onApproveTool,
          onRejectTool,
          showRetry ? onRetryTool : undefined,
          onOpenArtifact,
        );
        if (!rendered) return null;
        return (
          <div key={m.id} data-msg data-msg-kind={m.kind}>
            {rendered}
          </div>
        );
      })}
      {showCompletedDivider && (
        <div
          data-msg-completed
          className="msg-completed mt-[2px] flex items-center gap-[8px] text-[11px] font-medium text-emerald-700"
        >
          <span className="h-px flex-1 bg-emerald-200" aria-hidden />
          <span className="inline-flex items-center gap-[4px] rounded-full bg-emerald-50 px-[10px] py-[2px]">
            <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
              <path
                d="M2 5.2 L4 7 L8 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>応答完了</span>
          </span>
          <span className="h-px flex-1 bg-emerald-200" aria-hidden />
        </div>
      )}
      </div>
      <ProgressIndicator />
    </div>
  );
}

function renderMessage(
  m: ChatMessage,
  onApproveTool?: (id: string) => void,
  onRejectTool?: (id: string) => void,
  onRetryTool?: (id: string) => void,
  onOpenArtifact?: (artifactId: string) => void,
): JSX.Element | null {
  switch (m.kind) {
    case 'user':
      return <UserMessage text={m.text} {...(m.attachments ? { attachments: m.attachments } : {})} />;
    case 'agent':
      return <AgentMessage text={m.text} />;
    case 'thinking':
      return <ThinkingStatic />;
    case 'tool':
      return (
        <ToolCardMessage
          message={m}
          {...(onApproveTool ? { onApprove: onApproveTool } : {})}
          {...(onRejectTool ? { onReject: onRejectTool } : {})}
          {...(onRetryTool ? { onRetry: onRetryTool } : {})}
        />
      );
    case 'artifact-ref':
      return (
        <ArtifactRefMessage
          artifactId={m.artifactId}
          title={m.title}
          artifactKind={m.artifactKind}
          {...(onOpenArtifact ? { onOpen: onOpenArtifact } : {})}
        />
      );
    default:
      return null;
  }
}
