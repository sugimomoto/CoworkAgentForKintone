// Cowork Agent for kintone — Header (Customizer wedge V1 — design 案 C / 2 段構成)
//
// 上段: CA brand mark + 製品名 + Memory トグル + ⚙ (admin only) + ×
// 下段: フル幅 AgentPicker pill
//
// 旧 `components/Header.tsx` (1 段、PebbleSprout + status) は当面残置 (削除候補)。
// 仕様: requirements.md §15.2 / design.md §5

import { AgentPicker } from './components/AgentPicker';
import { MemoryToggle } from './components/MemoryToggle';

import type { AgentRecord } from '../core/bootstrap/agentTypes';

export interface HeaderProps {
  /** 表示する Agent 一覧 (public のみが AgentPicker でリストされる) */
  agents: AgentRecord[];
  /** 現在選択中の Agent ID */
  currentAgentId: string | null;
  /** Agent 切替ハンドラ (呼出側で新規会話開始する) */
  onSelectAgent: (agentId: string) => void;
  /** admin (Gear / Settings 表示制御) */
  isAdmin: boolean;
  /** Memory トグル状態 (V1 は常に disabled) */
  memoryEnabled?: boolean;
  /** Memory トグル ON/OFF */
  memoryOn?: boolean;
  /** Memory トグルクリック (V1 は呼ばれない) */
  onMemoryToggle?: () => void;
  /** 設定アイコンクリック (admin のみ) */
  onSettingsClick?: () => void;
  /** 閉じるアイコンクリック */
  onClose?: () => void;
}

export function Header({
  agents,
  currentAgentId,
  onSelectAgent,
  isAdmin,
  memoryEnabled = false,
  memoryOn = false,
  onMemoryToggle,
  onSettingsClick,
  onClose,
}: HeaderProps): JSX.Element {
  return (
    <header
      data-testid="wedge-header"
      className="relative z-[2] border-b border-border bg-panel backdrop-blur-[12px]"
    >
      {/* 上段: brand + utility */}
      <div className="flex items-center gap-[10px] px-[14px] pb-[8px] pt-[10px]">
        <BrandMark />
        <BrandTitle />
        <div className="flex-1" />
        <MemoryToggle enabled={memoryEnabled} on={memoryOn} onToggle={onMemoryToggle} />
        {isAdmin && onSettingsClick && (
          <IconButton ariaLabel="設定" onClick={onSettingsClick} highlight testId="header-gear">
            <GearIcon />
          </IconButton>
        )}
        {onClose && (
          <IconButton ariaLabel="閉じる" onClick={onClose} testId="header-close">
            <CloseIcon />
          </IconButton>
        )}
      </div>

      {/* 下段: フル幅 Agent pill */}
      <div className="px-[14px] pb-[10px]">
        <AgentPicker
          agents={agents}
          currentId={currentAgentId}
          onSelect={onSelectAgent}
        />
      </div>
    </header>
  );
}

// ─── 上段の brand mark ─────────────────────────────────────────────────────

function BrandMark(): JSX.Element {
  return (
    <div className="relative shrink-0">
      <div className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px] bg-accent text-white font-mono text-[10.5px] font-extrabold tracking-[-0.5px]">
        CA
      </div>
      <span
        className="absolute bottom-[-2px] right-[-2px] h-[10px] w-[10px] rounded-full bg-[#22c55e] ring-2 ring-[color:var(--cw-bg)]"
        aria-hidden="true"
      />
    </div>
  );
}

function BrandTitle(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[6px] leading-[1.25]">
      <span className="truncate text-[13px] font-bold tracking-[-0.2px] text-text">
        Cowork Agent
      </span>
      <span className="shrink-0 rounded-[3px] bg-accent-soft px-[5px] py-[1px] text-[9px] font-semibold tracking-[0.2px] text-accent">
        for kintone
      </span>
    </div>
  );
}

// ─── アイコンボタン ──────────────────────────────────────────────────────

interface IconButtonProps {
  children: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
  highlight?: boolean;
  testId?: string;
}

function IconButton({ children, ariaLabel, onClick, highlight, testId }: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      data-testid={testId}
      className={[
        'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px]',
        'text-muted hover:bg-accent-soft hover:text-accent',
        highlight ? 'bg-card-hi' : 'bg-transparent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function GearIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}
