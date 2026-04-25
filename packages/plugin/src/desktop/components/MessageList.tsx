// Cowork Agent for kintone — メッセージ一覧
//
// kind 別に対応するコンポーネントへ振り分ける。
// Phase 1a では user / agent / thinking のみ。tool / plan / progress / result は Phase 1b で追加。

import { AgentMessage } from './MessageItem/AgentMessage';
import { ThinkingDots } from './MessageItem/ThinkingDots';
import { UserMessage } from './MessageItem/UserMessage';

export type ChatMessage =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'agent'; text: string }
  | { id: string; kind: 'thinking' };

export interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto overscroll-contain px-[16px] py-[18px]">
      {messages.map((m) => {
        const rendered = renderMessage(m);
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

function renderMessage(m: ChatMessage): JSX.Element | null {
  switch (m.kind) {
    case 'user':
      return <UserMessage text={m.text} />;
    case 'agent':
      return <AgentMessage text={m.text} />;
    case 'thinking':
      return <ThinkingDots />;
    default:
      return null;
  }
}
