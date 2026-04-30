// Cowork Agent for kintone — Header (チャットパネル上部)
//
// デザイン仕様: docs/functional-design.md §5.3.2

import { PebbleSprout, type PebbleSproutState } from './PebbleSprout';

export interface HeaderProps {
  /** Agent 表示名 (例: "Cowork Agent for kintone") */
  agentName: string;
  /** Status 行のテキスト (例: "作業中 · kintone接続") */
  status: string;
  /** Pebble Sprout マスコットの状態 (省略時 'idle') */
  agentState?: PebbleSproutState;
  /** 履歴アイコン押下時。未指定ならボタン非表示 */
  onHistoryClick?: () => void;
  /** 新規会話アイコン押下時。未指定ならボタン非表示 */
  onNewConversationClick?: () => void;
  /** 設定アイコン押下時。未指定ならボタン非表示 */
  onSettingsClick?: () => void;
  /** 閉じるアイコン押下時。未指定ならボタン非表示 */
  onClose?: () => void;
  /** kintone 再連携ボタン押下時。未指定ならボタン非表示 */
  onReconnectKintone?: () => void;
  /** 再連携ボタンを描画するか (bound / binding / error の時に true) */
  reconnectVisible?: boolean;
  /** 再連携処理中 (binding) で disabled 表示 */
  reconnectDisabled?: boolean;
}

export function Header({
  agentName,
  status,
  agentState = 'idle',
  onHistoryClick,
  onNewConversationClick,
  onSettingsClick,
  onClose,
  onReconnectKintone,
  reconnectVisible = false,
  reconnectDisabled = false,
}: HeaderProps): JSX.Element {
  return (
    <header className="flex items-center gap-[10px] border-b border-border bg-panel px-[14px] py-[10px] backdrop-blur-[12px]">
      {/* Avatar + status dot */}
      <div className="relative shrink-0">
        <PebbleSprout size={40} state={agentState} />
        <span
          className="absolute bottom-[-2px] right-[-2px] h-[11px] w-[11px] rounded-full bg-[#22c55e] ring-2 ring-[color:var(--cw-panel)]"
          aria-hidden="true"
        />
      </div>

      {/* name / status */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-[6px]">
          <span className="truncate text-[14px] font-semibold text-text" title={agentName}>
            {agentName}
          </span>
          <span className="shrink-0 rounded-[4px] bg-accent-soft px-[6px] py-[1px] text-[10px] font-medium text-accent">
            AGENT
          </span>
        </div>
        <div className="flex items-center gap-[4px] text-[11px] text-muted">
          <ClockIcon />
          <span>{status}</span>
        </div>
      </div>

      {/* buttons */}
      <div className="flex items-center gap-[2px]">
        {onHistoryClick && (
          <IconButton aria-label="履歴" onClick={onHistoryClick}>
            <HistoryIcon />
          </IconButton>
        )}
        {onNewConversationClick && (
          <IconButton aria-label="新規会話" onClick={onNewConversationClick}>
            <NewChatIcon />
          </IconButton>
        )}
        {onReconnectKintone && reconnectVisible && (
          <IconButton
            aria-label="kintone を再連携"
            title="kintone を再連携"
            onClick={onReconnectKintone}
            disabled={reconnectDisabled}
          >
            <LinkIcon />
          </IconButton>
        )}
        {onSettingsClick && (
          <IconButton aria-label="設定" onClick={onSettingsClick}>
            <SettingsIcon />
          </IconButton>
        )}
        {onClose && (
          <IconButton aria-label="閉じる" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </div>
    </header>
  );
}

function IconButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return (
    <button
      type="button"
      className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-muted hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
      {...rest}
    >
      {children}
    </button>
  );
}

// ----- icons ---------------------------------------------------------------

const strokeAttrs = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function ClockIcon(): JSX.Element {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" strokeWidth="2" {...strokeAttrs} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.6" {...strokeAttrs} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HistoryIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.6" {...strokeAttrs} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function NewChatIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.6" {...strokeAttrs} aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <line x1="9.5" y1="11.5" x2="14.5" y2="11.5" />
    </svg>
  );
}

function LinkIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.6" {...strokeAttrs} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.6" {...strokeAttrs} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
