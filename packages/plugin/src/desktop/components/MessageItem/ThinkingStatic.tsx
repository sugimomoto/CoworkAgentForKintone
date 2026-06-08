// Cowork Agent for kintone — Thinking 痕跡 (静的)
//
// `agent.thinking` event がメッセージリストに永続的に残ったときに使う。
// ターン進行中のアニメは ProgressIndicator (左下フロート) が担うので、
// リスト内の thinking メッセージは「考え中だった」という静的痕跡だけにする。

import { AgentAvatar } from './AgentAvatar';

export function ThinkingStatic(): JSX.Element {
  return (
    <div
      className="msg-in flex items-center gap-[8px]"
      role="note"
      aria-label="考え中だった"
      data-testid="thinking-static"
    >
      <AgentAvatar />
      <div className="text-[12px] text-muted">考え中…</div>
    </div>
  );
}
