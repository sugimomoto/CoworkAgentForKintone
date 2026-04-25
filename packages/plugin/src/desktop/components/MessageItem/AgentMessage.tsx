// Cowork Agent for kintone — Agent 発話バブル
//
// デザイン仕様: docs/functional-design.md §5.6.3

import { AgentAvatar } from './AgentAvatar';

export interface AgentMessageProps {
  text: string;
}

export function AgentMessage({ text }: AgentMessageProps): JSX.Element {
  return (
    <div className="msg-in flex items-start gap-[8px]">
      <AgentAvatar />
      <div className="whitespace-pre-wrap pt-[1px] text-[13px] leading-[1.5] text-text">{text}</div>
    </div>
  );
}
