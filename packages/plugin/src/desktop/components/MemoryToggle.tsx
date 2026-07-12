// Memory トグル
//
// #15 で機能化: ON のとき次の新規会話から Memory Store (preferences / agent-context) を
// Session に attach する。既定 ON / opt-out で per-user localStorage に永続 (ChatPanel 配線)。
//
// 仕様: .steering/20260711-issue-15-memory-stores/design.md §7

export interface MemoryToggleProps {
  /** false で disabled (プレースホルダ)。#15 以降は true。 */
  enabled?: boolean;
  /** トグル ON/OFF (enabled=true 時のみ有効) */
  on?: boolean;
  /** クリックハンドラ (enabled=true 時のみ呼ばれる) */
  onToggle?: (() => void) | undefined;
}

export function MemoryToggle({
  enabled = false,
  on = false,
  onToggle,
}: MemoryToggleProps): JSX.Element {
  const handleClick = (): void => {
    if (enabled && onToggle) onToggle();
  };
  return (
    <button
      type="button"
      data-testid="memory-toggle"
      data-enabled={enabled ? '1' : '0'}
      data-on={on ? '1' : '0'}
      title={enabled ? 'メモリ (会話間の persistence)' : 'メモリ機能は V2 で有効化されます'}
      onClick={handleClick}
      disabled={!enabled}
      className={[
        'flex h-[24px] items-center gap-[5px] rounded-full border border-border px-[7px]',
        'font-medium text-[10.5px]',
        enabled ? 'cursor-pointer text-muted' : 'cursor-default opacity-60 text-subtle',
        on && enabled ? 'bg-accent-soft text-accent' : 'bg-transparent',
      ]
        .join(' ')
        .trim()}
    >
      <MemoryIcon />
      <span>メモリ</span>
      <span
        className={`px-[3px] font-bold text-[8.5px] tracking-[0.6px] ${
          on && enabled ? 'text-accent' : 'text-subtle'
        }`}
      >
        {on && enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

function MemoryIcon(): JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="9" height="7" rx="1.5" />
      <path d="M4 5.2v1.6M6 4.5v2.6M8 5.5v0.6" />
    </svg>
  );
}
