// Agent プルダウン (Header 案 C 下段、フル幅 pill)
//
// クリックで配下に Agent 一覧ドロップダウンを展開。visibility=public な Agent
// だけがリストされる。選択で新規会話のトリガー。
//
// 仕様: requirements.md §15.2 / docs/design-handoff/customizer-wedge/project/wedge-header.jsx (HeaderVariantC + AgentDropdownPanel)

import { useEffect, useRef, useState } from 'react';

import { AgentIcon } from './AgentIcon';
import { ModelBadge } from './ModelBadge';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

export interface AgentPickerProps {
  /** 表示候補 Agent (呼出側で visibility filter 済み想定だが、念のため内部でも filter する) */
  agents: AgentRecord[];
  /** 現在選択中の Agent ID。null なら最初の Agent を表示 */
  currentId: string | null;
  /** Agent 選択ハンドラ。新規会話のトリガーは呼出側で行う想定 */
  onSelect: (agentId: string) => void;
}

export function AgentPicker({ agents, currentId, onSelect }: AgentPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const publicAgents = agents.filter((a) => a.visibility === 'public');
  const current =
    publicAgents.find((a) => a.id === currentId) ?? publicAgents[0] ?? null;

  // クリック外で閉じる
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleSelect = (id: string): void => {
    setOpen(false);
    if (id !== currentId) {
      onSelect(id);
    }
  };

  return (
    <div className="relative" ref={rootRef} data-testid="agent-picker">
      <button
        type="button"
        data-testid="agent-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'flex w-full items-center gap-[9px] rounded-[10px] border border-border px-[8px] py-[6px]',
          'text-left text-text font-sans',
          open ? 'bg-card' : 'bg-card-hi',
          'cursor-pointer',
        ].join(' ')}
      >
        {current ? (
          <>
            <AgentIcon
              kind={current.iconKind}
              color={current.iconColor}
              size={22}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-1 items-center gap-[6px] leading-tight">
              <span className="truncate text-[13.5px] font-semibold">{current.name}</span>
              <ModelBadge model={current.model} size="lg" />
            </div>
          </>
        ) : (
          <span className="flex-1 text-[12px] text-muted">エージェントを読み込み中…</span>
        )}
        <ChevronDownIcon className="shrink-0 text-muted" />
      </button>

      {open && publicAgents.length > 0 && (
        <div
          role="listbox"
          data-testid="agent-picker-dropdown"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_12px_36px_rgba(0,0,0,0.14)]"
        >
          <div className="px-[12px] pb-[6px] pt-[8px] text-[9.5px] font-bold uppercase tracking-[0.8px] text-subtle">
            エージェントを選択
          </div>
          {publicAgents.map((a, i) => {
            const active = a.id === current?.id;
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={active}
                data-testid={`agent-picker-item-${a.id}`}
                onClick={() => handleSelect(a.id)}
                className={[
                  'flex w-full items-center gap-[10px] px-[12px] py-[8px] text-left text-text',
                  i > 0 ? 'border-t border-border' : '',
                  active ? 'bg-card-hi' : 'bg-transparent hover:bg-card-hi',
                ].join(' ')}
              >
                <AgentIcon kind={a.iconKind} color={a.iconColor} size={26} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[6px] leading-tight">
                    <span className="text-[12.5px] font-semibold">{a.name}</span>
                    <ModelBadge model={a.model} size="sm" />
                    {a.isDefault && (
                      <span className="rounded-[3px] border border-border px-[4px] text-[8.5px] font-semibold tracking-[0.4px] text-muted">
                        既定
                      </span>
                    )}
                  </div>
                  <div className="mt-[2px] text-[10.5px] leading-[1.35] text-muted">
                    {a.description}
                  </div>
                </div>
                {active && <CheckIcon className="shrink-0 text-accent" />}
              </button>
            );
          })}
          <div className="flex items-center gap-[5px] border-t border-border bg-card-hi px-[12px] py-[7px] text-[10.5px] text-muted">
            <InfoIcon />
            切替時は新規会話が開始されます
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 5l3 3 3-3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 7.5l3 3L12 3.5" />
    </svg>
  );
}

function InfoIcon(): JSX.Element {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="4.5" />
      <path d="M6 3.5v3M6 8h.01" />
    </svg>
  );
}
