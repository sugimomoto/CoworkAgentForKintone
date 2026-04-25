// Cowork Agent for kintone — Thinking 表示 (3 ドットアニメ)
//
// デザイン仕様: docs/functional-design.md §5.6.3 / §5.7.1

import { AgentAvatar } from './AgentAvatar';

export function ThinkingDots(): JSX.Element {
  return (
    <div className="msg-in flex items-center gap-[8px]" role="status" aria-label="考え中">
      <AgentAvatar />
      <div className="flex items-center gap-[3px] text-[12px] text-muted">
        <span className="cw-dot" data-dot />
        <span className="cw-dot" data-dot />
        <span className="cw-dot" data-dot />
      </div>
      <style>{`
        .cw-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: var(--cw-accent);
          animation: cw-dot-blink 1.2s infinite ease-in-out both;
        }
        .cw-dot:nth-child(2) { animation-delay: 0.15s; }
        .cw-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes cw-dot-blink {
          0%, 80%, 100% { opacity: 0.25; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
