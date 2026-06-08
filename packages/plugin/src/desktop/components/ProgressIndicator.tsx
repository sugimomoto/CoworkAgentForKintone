// Cowork Agent for kintone — 進行インジケータ (左下フロート)
//
// Agent ターン進行中 (`phase === 'running'`) のあいだ、MessageList の左下に
// sticky に表示される小さなチップ。dot アニメ + 状態ラベル + 経過秒で
// 「ちゃんと動いている」をユーザーに伝える。
//
// 設計判断:
//   - 表示位置は MessageList 内の絶対配置 (= スクロールしない)
//   - 中断ボタンは持たない (= Composer 側の送信→中断トグルでカバー)
//   - 60s 超えても色変化なし (= 警告にしない)。実セッションで 61s gap を観測済み
//   - dot アニメは本コンポーネント内のローカル CSS で完結 (旧 ThinkingDots と同パターン)

import { useChatStore } from '../../store/chatStore';
import { progressLabelOf } from '../../core/managed-agents/progressLabel';
import { useAgentPhase } from '../hooks/useAgentPhase';
import { useElapsedSinceEvent } from '../hooks/useElapsedSinceEvent';

export function ProgressIndicator(): JSX.Element | null {
  const phase = useAgentPhase();
  const lastEventAt = useChatStore((s) => s.lastEventAt);
  const lastEventKind = useChatStore((s) => s.lastEventKind);
  const lastToolName = useChatStore((s) => s.lastToolName);
  const elapsed = useElapsedSinceEvent(lastEventAt);

  if (phase !== 'running') return null;

  const label = progressLabelOf(lastEventKind, lastToolName);

  return (
    <div
      data-testid="progress-indicator"
      role="status"
      aria-live="polite"
      className="
        pointer-events-none absolute bottom-[10px] left-[10px] z-10
        flex max-w-[280px] items-center gap-[6px]
        rounded-full border border-card-border bg-card
        px-[10px] py-[5px]
        text-[11px] text-muted
        shadow-[0_2px_6px_rgba(0,0,0,0.08)]
        animate-[cw-progress-fade-in_150ms_ease-out]
      "
    >
      <span className="cw-progress-dots inline-flex items-center gap-[3px]">
        <span className="cw-progress-dot" />
        <span className="cw-progress-dot" />
        <span className="cw-progress-dot" />
      </span>
      <span className="truncate" data-testid="progress-indicator-label">{label}</span>
      <span className="shrink-0 text-subtle tabular-nums" data-testid="progress-indicator-elapsed">
        ·&nbsp;{elapsed}s
      </span>
      <style>{`
        .cw-progress-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: var(--cw-accent);
          animation: cw-progress-dot-blink 1.2s infinite ease-in-out both;
        }
        .cw-progress-dot:nth-child(2) { animation-delay: 0.15s; }
        .cw-progress-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes cw-progress-dot-blink {
          0%, 80%, 100% { opacity: 0.25; }
          40% { opacity: 1; }
        }
        @keyframes cw-progress-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
