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
//   - dot / fade-in アニメは `styles/global.css` の `cw-progress-*` クラスで定義
//     (prefers-reduced-motion 対応も global で共通化済み)

import { useChatStore } from '../../store/chatStore';
import { progressLabelOf } from '../../core/managed-agents/progressLabel';
import { useAgentPhase } from '../hooks/useAgentPhase';
import { useElapsedSinceEvent } from '../hooks/useElapsedSinceEvent';

export function ProgressIndicator(): JSX.Element | null {
  const phase = useAgentPhase();
  const lastEvent = useChatStore((s) => s.lastEvent);
  const elapsed = useElapsedSinceEvent(lastEvent?.at ?? null);

  if (phase !== 'running') return null;

  const label = progressLabelOf(lastEvent?.kind ?? null, lastEvent?.toolName ?? null);

  return (
    <div
      data-testid="progress-indicator"
      role="status"
      aria-live="polite"
      className="
        cw-progress-fade
        pointer-events-none absolute bottom-[10px] left-[10px] z-10
        flex max-w-[280px] items-center gap-[6px]
        rounded-full border border-card-border bg-card
        px-[10px] py-[5px]
        text-[11px] text-muted
        shadow-[0_2px_6px_rgba(0,0,0,0.08)]
      "
    >
      <span className="inline-flex items-center gap-[3px]">
        <span className="cw-progress-dot" />
        <span className="cw-progress-dot" />
        <span className="cw-progress-dot" />
      </span>
      <span className="truncate" data-testid="progress-indicator-label">{label}</span>
      <span className="shrink-0 text-subtle tabular-nums" data-testid="progress-indicator-elapsed">
        ·&nbsp;{elapsed}s
      </span>
    </div>
  );
}
