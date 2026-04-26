// Cowork Agent for kintone — メッセージ一覧
//
// kind 別に対応するコンポーネントへ振り分ける。

import { AgentMessage } from './MessageItem/AgentMessage';
import { ThinkingDots } from './MessageItem/ThinkingDots';
import { ToolCardMessage } from './MessageItem/ToolCardMessage';
import { UserMessage } from './MessageItem/UserMessage';

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

export type ChatMessage =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'agent'; text: string }
  | { id: string; kind: 'thinking' }
  | ToolMessage;

export interface MessageListProps {
  messages: ChatMessage[];
  /** 承認ボタン押下 (tool kind, pending-confirmation のみ) */
  onApproveTool?: (toolUseId: string) => void;
  /** 却下ボタン押下 (tool kind, pending-confirmation のみ) */
  onRejectTool?: (toolUseId: string) => void;
  /** 失敗ツールの再試行依頼 (tool kind, error のみ) */
  onRetryTool?: (toolUseId: string) => void;
  /** Agent ターン進行中なら retry ボタンを出さない (連打防止) */
  agentRunning?: boolean;
}

export function MessageList({
  messages,
  onApproveTool,
  onRejectTool,
  onRetryTool,
  agentRunning = false,
}: MessageListProps): JSX.Element {
  // 「もう一度試す」ボタンは履歴の中で **最後の error tool カード** にだけ出す。
  // (複数 error が積み上がってもボタンは 1 つだけ → 連打 / 混乱を防ぐ)
  // Agent ターン進行中は出さない (retry クリック後に Agent が処理している間は連打不可)
  let lastErrorToolId: string | null = null;
  if (!agentRunning) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.kind === 'tool' && m.status === 'error') {
        lastErrorToolId = m.id;
        break;
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-[16px] py-[18px]">
      {messages.map((m) => {
        const showRetry = m.kind === 'tool' && m.id === lastErrorToolId;
        const rendered = renderMessage(
          m,
          onApproveTool,
          onRejectTool,
          showRetry ? onRetryTool : undefined,
        );
        if (!rendered) return null;
        return (
          <div key={m.id} data-msg data-msg-kind={m.kind}>
            {rendered}
          </div>
        );
      })}
    </div>
  );
}

function renderMessage(
  m: ChatMessage,
  onApproveTool?: (id: string) => void,
  onRejectTool?: (id: string) => void,
  onRetryTool?: (id: string) => void,
): JSX.Element | null {
  switch (m.kind) {
    case 'user':
      return <UserMessage text={m.text} />;
    case 'agent':
      return <AgentMessage text={m.text} />;
    case 'thinking':
      return <ThinkingDots />;
    case 'tool':
      return (
        <ToolCardMessage
          message={m}
          {...(onApproveTool ? { onApprove: onApproveTool } : {})}
          {...(onRejectTool ? { onReject: onRejectTool } : {})}
          {...(onRetryTool ? { onRetry: onRetryTool } : {})}
        />
      );
    default:
      return null;
  }
}
