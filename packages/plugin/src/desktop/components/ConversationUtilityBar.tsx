// Conversation View 内の二次行 utility (V1 P4.5.4)
//
// Header 案 C (2 段構成) では brand / AgentPicker を主役にしているため、履歴 / 新規会話 /
// kintone 再連携の動線は Composer の直上にコンパクトな utility bar として配置する。
//
// 仕様: requirements.md §15 (Conversation View) / tasklist.md P4.5.4

import type { BindingStatus } from '../../store/chatStore';

export interface ConversationUtilityBarProps {
  /** 履歴を開く (view='history' に切替) */
  onHistoryClick: () => void;
  /** 新規会話を始める */
  onNewConversationClick: () => void;
  /** kintone を再連携 (OAuth flow を再起動) */
  onReconnectKintone: () => void;
  /** OAuth バインディング状態 */
  bindingStatus: BindingStatus;
}

export function ConversationUtilityBar({
  onHistoryClick,
  onNewConversationClick,
  onReconnectKintone,
  bindingStatus,
}: ConversationUtilityBarProps): JSX.Element {
  const showReconnect =
    bindingStatus === 'bound' || bindingStatus === 'binding' || bindingStatus === 'error';
  const reconnectDisabled = bindingStatus === 'binding';

  return (
    <div
      data-testid="conversation-utility-bar"
      className="flex shrink-0 items-center gap-[4px] border-t border-border bg-panel px-[12px] py-[6px]"
    >
      <UtilityIconButton
        ariaLabel="新規会話"
        title="新規会話を始める"
        onClick={onNewConversationClick}
        testId="utility-new-conversation"
      >
        <NewChatIcon />
      </UtilityIconButton>
      <UtilityIconButton
        ariaLabel="履歴"
        title="過去のセッション履歴"
        onClick={onHistoryClick}
        testId="utility-history"
      >
        <HistoryIcon />
      </UtilityIconButton>
      <div className="flex-1" />
      {showReconnect && (
        <UtilityIconButton
          ariaLabel="kintone を再連携"
          title="kintone を再連携"
          onClick={onReconnectKintone}
          disabled={reconnectDisabled}
          testId="utility-reconnect"
        >
          <LinkIcon />
        </UtilityIconButton>
      )}
    </div>
  );
}

interface UtilityIconButtonProps {
  children: React.ReactNode;
  ariaLabel: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
}

function UtilityIconButton({
  children,
  ariaLabel,
  title,
  onClick,
  disabled,
  testId,
}: UtilityIconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-muted hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted"
    >
      {children}
    </button>
  );
}

// ─── icons (旧 components/Header.tsx から流用) ────────────────────────────

const strokeAttrs = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

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
