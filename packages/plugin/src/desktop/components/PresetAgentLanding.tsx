// Cowork Agent for kintone — Preset Agent Landing
//
// チャットパネルの空状態 (messages 空 & sessionId null) で表示するランディング。
// 公開エージェントをアコーディオンで縦に積み、各行のクイックアクションを 1 クリックで起動できる。
//
// 仕様: .steering/20260606-preset-agents-one-click/

import { useMemo, useState } from 'react';

import { AgentIcon } from './AgentIcon';
import { ModelBadge } from './ModelBadge';

import type { AgentRecord } from '../../core/bootstrap/agentTypes';

export interface PresetAgentLandingProps {
  agents: readonly AgentRecord[];
  /** プロンプト押下時。チャット遷移と送信は親が行う */
  onSelectPrompt: (agent: AgentRecord, prompt: string) => void;
  /** 「自由入力で話しかける」CTA 押下時。送信せずエージェント切替 + Composer フォーカスのみ */
  onSelectAgentForFreeInput: (agent: AgentRecord) => void;
  /** 検索ボックス強制表示 (既定: 6 個超で自動 ON)。テスト用 */
  searchable?: boolean;
  /** Agent ターン進行中。true の間はワンクリック実行ボタンを disable (二重実行ガード) */
  running?: boolean;
}

const SEARCH_AUTO_THRESHOLD = 6;

function pickInitialOpenId(publicAgents: readonly AgentRecord[]): string | null {
  return (
    publicAgents.find((a) => a.isDefault)?.id ?? publicAgents[0]?.id ?? null
  );
}

export function PresetAgentLanding({
  agents,
  onSelectPrompt,
  onSelectAgentForFreeInput,
  searchable,
  running = false,
}: PresetAgentLandingProps): JSX.Element | null {
  const publicAgents = useMemo(
    () => agents.filter((a) => a.visibility === 'public'),
    [agents],
  );
  const [openId, setOpenId] = useState<string | null>(() => pickInitialOpenId(publicAgents));
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return publicAgents;
    return publicAgents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
    );
  }, [publicAgents, query]);

  if (publicAgents.length === 0) return null;

  if (publicAgents.length === 1) {
    return (
      <Container mode="single">
        <SinglePresetView
          agent={publicAgents[0]!}
          running={running}
          onSelectPrompt={onSelectPrompt}
          onSelectAgentForFreeInput={onSelectAgentForFreeInput}
        />
      </Container>
    );
  }

  const showSearch = searchable ?? publicAgents.length > SEARCH_AUTO_THRESHOLD;

  return (
    <Container mode="list">
      <Intro />
      {showSearch && <SearchBox value={query} onChange={setQuery} />}
      <div className="flex flex-col gap-[8px] px-[12px] pb-[8px]">
        {filtered.map((a) => (
          <AccordionRow
            key={a.id}
            agent={a}
            open={a.id === openId}
            running={running}
            onToggle={() => setOpenId((id) => (id === a.id ? null : a.id))}
            onSelectPrompt={(p) => onSelectPrompt(a, p)}
            onFreeInput={() => onSelectAgentForFreeInput(a)}
          />
        ))}
        {filtered.length === 0 && (
          <div
            data-testid="preset-search-empty"
            className="rounded-[10px] border border-dashed border-card-border bg-bg px-[14px] py-[16px] text-center text-[11.5px] text-muted"
          >
            該当するエージェントがありません。
          </div>
        )}
      </div>
    </Container>
  );
}

// ─── Container (mode 属性付きの共通外殻) ─────────────────────────────────────

interface ContainerProps {
  mode: 'list' | 'single';
  children: React.ReactNode;
}
function Container({ mode, children }: ContainerProps): JSX.Element {
  return (
    <div
      data-testid="preset-agent-landing"
      data-mode={mode}
      data-single={mode === 'single' ? 'true' : 'false'}
      className="cw-view-fade flex-1 overflow-y-auto"
    >
      {children}
    </div>
  );
}

// ─── Intro / SearchBox ───────────────────────────────────────────────────────

function Intro(): JSX.Element {
  return (
    <div className="px-[16px] pb-[10px] pt-[14px]">
      <h2 className="mb-[3px] text-[15px] font-semibold tracking-tight text-text">
        何をお手伝いしましょうか？
      </h2>
      <p className="text-[11.5px] leading-normal text-muted">
        エージェントを選んで、クイックアクションからすぐに始められます。
      </p>
    </div>
  );
}

interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
}
function SearchBox({ value, onChange }: SearchBoxProps): JSX.Element {
  return (
    <div className="px-[16px] pb-[10px]">
      <label className="flex items-center gap-[6px] rounded-[10px] border border-card-border bg-card px-[10px] py-[6px]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="text-subtle"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="4" />
          <path d="M9 9l2.5 2.5" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="エージェントを検索"
          aria-label="エージェントを検索"
          className="w-full bg-transparent text-[12px] text-text outline-none placeholder:text-subtle"
        />
      </label>
    </div>
  );
}

// ─── AccordionRow ────────────────────────────────────────────────────────────

interface AccordionRowProps {
  agent: AgentRecord;
  open: boolean;
  running: boolean;
  onToggle: () => void;
  onSelectPrompt: (prompt: string) => void;
  onFreeInput: () => void;
}
function AccordionRow({
  agent,
  open,
  running,
  onToggle,
  onSelectPrompt,
  onFreeInput,
}: AccordionRowProps): JSX.Element {
  return (
    <div
      data-testid="preset-agent-row"
      data-agent-id={agent.id}
      data-open={open}
      className={[
        'overflow-hidden rounded-[12px] border transition-colors duration-200',
        open ? 'border-border bg-card shadow-card' : 'border-card-border bg-transparent',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`preset-row-body-${agent.id}`}
        className="flex w-full items-center gap-[10px] px-[12px] py-[10px] text-left"
      >
        <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={30} className="shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-[6px]">
            <span className="truncate text-[13px] font-semibold text-text">{agent.name}</span>
            <ModelBadge model={agent.model} size="sm" />
            {agent.isDefault && (
              <span className="rounded border border-card-border px-[4px] text-[8.5px] font-semibold text-subtle">
                既定
              </span>
            )}
          </span>
          <span className="mt-[1px] block truncate text-[10.5px] text-muted">
            {agent.description}
          </span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          id={`preset-row-body-${agent.id}`}
          className="flex flex-col gap-[6px] px-[12px] pb-[12px]"
        >
          <QuickActionsList
            prompts={agent.quickActions}
            running={running}
            onSelectPrompt={onSelectPrompt}
            onFreeInput={onFreeInput}
          />
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }): JSX.Element {
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
      aria-hidden="true"
      className={`shrink-0 text-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5l3 3 3-3" />
    </svg>
  );
}

// ─── QuickActionsList (0 件 → EmptyPromptsCTA、1 件以上 → PromptButton 列) ──

interface QuickActionsListProps {
  prompts: readonly string[];
  running: boolean;
  onSelectPrompt: (prompt: string) => void;
  onFreeInput: () => void;
}
function QuickActionsList({
  prompts,
  running,
  onSelectPrompt,
  onFreeInput,
}: QuickActionsListProps): JSX.Element {
  if (prompts.length === 0) {
    return <EmptyPromptsCTA disabled={running} onFreeInput={onFreeInput} />;
  }
  return (
    <>
      {prompts.map((p, i) => (
        <PromptButton
          key={i}
          text={p}
          disabled={running}
          onClick={() => onSelectPrompt(p)}
        />
      ))}
    </>
  );
}

// ─── PromptButton ────────────────────────────────────────────────────────────

interface PromptButtonProps {
  text: string;
  disabled?: boolean;
  onClick: () => void;
}
function PromptButton({ text, disabled = false, onClick }: PromptButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid="preset-prompt"
      disabled={disabled}
      onClick={onClick}
      className={[
        'group flex w-full items-start gap-[9px] rounded-[10px] border border-card-border bg-card px-[11px] py-[9px]',
        'text-left text-[12.5px] leading-snug text-text',
        'transition-colors duration-150 hover:border-border',
        'active:scale-[0.99] active:border-accent active:bg-accent active:text-white',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:active:bg-card disabled:active:text-text disabled:active:border-card-border',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md',
          'bg-accent-soft text-accent group-active:bg-white/20 group-active:text-white',
        ].join(' ')}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M2 5h6M5 2l3 3-3 3" />
        </svg>
      </span>
      <span className="flex-1 [text-wrap:pretty]">{text}</span>
    </button>
  );
}

// ─── EmptyPromptsCTA ────────────────────────────────────────────────────────

interface EmptyPromptsCTAProps {
  disabled?: boolean;
  onFreeInput: () => void;
}
function EmptyPromptsCTA({ disabled = false, onFreeInput }: EmptyPromptsCTAProps): JSX.Element {
  return (
    <div
      data-testid="preset-empty-cta"
      className="rounded-[10px] border border-dashed border-card-border bg-bg px-[14px] py-[16px] text-center"
    >
      <p className="mb-[10px] text-[11.5px] leading-relaxed text-muted">
        このエージェントにはまだクイックアクションがありません。
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onFreeInput}
        className="inline-flex items-center gap-[6px] rounded-[9px] bg-accent px-[14px] py-[7px] text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        自由入力で話しかける
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 6h7M6 3l3 3-3 3" />
        </svg>
      </button>
    </div>
  );
}

// ─── SinglePresetView (Agent 1 個のみ — アコーディオン chrome 省略) ─────────

interface SinglePresetViewProps {
  agent: AgentRecord;
  running: boolean;
  onSelectPrompt: (agent: AgentRecord, prompt: string) => void;
  onSelectAgentForFreeInput: (agent: AgentRecord) => void;
}
function SinglePresetView({
  agent,
  running,
  onSelectPrompt,
  onSelectAgentForFreeInput,
}: SinglePresetViewProps): JSX.Element {
  return (
    <div className="px-[16px] pb-[14px] pt-[20px]">
      <div className="flex flex-col items-center text-center">
        <AgentIcon kind={agent.iconKind} color={agent.iconColor} size={48} className="shrink-0" />
        <div className="mt-[10px] flex items-center gap-[6px]">
          <span className="text-[16px] font-bold tracking-tight text-text">{agent.name}</span>
          <ModelBadge model={agent.model} size="sm" />
        </div>
        <p className="mt-[4px] text-[11.5px] text-muted">{agent.description}</p>
      </div>
      {agent.quickActions.length > 0 && (
        <p className="px-[4px] pb-[6px] pt-[14px] text-[10.5px] font-bold uppercase tracking-wider text-subtle">
          クイックアクション
        </p>
      )}
      <div className={`flex flex-col gap-[6px] ${agent.quickActions.length === 0 ? 'mt-[14px]' : ''}`}>
        <QuickActionsList
          prompts={agent.quickActions}
          running={running}
          onSelectPrompt={(p) => onSelectPrompt(agent, p)}
          onFreeInput={() => onSelectAgentForFreeInput(agent)}
        />
      </div>
    </div>
  );
}
