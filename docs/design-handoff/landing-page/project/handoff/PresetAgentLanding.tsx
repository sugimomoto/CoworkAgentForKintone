// ─────────────────────────────────────────────────────────────
// PresetAgentLanding.tsx — 案 A (アコーディオン) の本実装
//
// チャットパネルのメインエリアに差し込むランディング。
// 履歴が空 & セッション未開始のときに WelcomeMessage の代わりに表示する。
//   - 公開エージェントをアコーディオンで縦に積む (= Agent ピッカー兼用)
//   - 行ヘッダーで開閉、サンプルプロンプト押下で即実行
//   - 既定エージェントは初期展開 → 初回 1 クリックで価値が出る
//   - サンプル 0 個 / 1 エージェントのみ / 10 個以上 をすべてケア
//
// Header / UtilityBar / Composer は既存パネルが持つ前提。
// 自由入力 (Composer) は常に表示されるので逃げ道は別途確保される。
// ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  PresetAgent, IconColor, AgentModel,
  publicAgents, defaultOpenId,
} from './agents';
import { AgentGlyph } from './AgentGlyph';

interface Props {
  agents: PresetAgent[];
  /** プロンプト押下 / 空状態 CTA。チャット遷移と送信は親が行う。 */
  onSelectPrompt: (agent: PresetAgent, prompt: string) => void;
  /** 10 個以上のとき検索ボックスを出すか (既定: 6 個超で自動 ON)。 */
  searchable?: boolean;
}

// purpose=customizer は accent 塗り。それ以外は iconColor の淡色チップ。
const TINT: Record<IconColor, { soft: string; fg: string }> = {
  accent:     { soft: 'bg-teal-600/10',    fg: 'text-teal-700' },
  accentSoft: { soft: 'bg-teal-600/10',    fg: 'text-teal-700' },
  teal:       { soft: 'bg-teal-600/10',    fg: 'text-teal-700' },
  blue:       { soft: 'bg-blue-600/10',    fg: 'text-blue-700' },
  emerald:    { soft: 'bg-emerald-600/10', fg: 'text-emerald-700' },
  sand:       { soft: 'bg-amber-700/10',   fg: 'text-amber-800' },
};

function ModelBadge({ model }: { model: AgentModel }) {
  return model === 'opus' ? (
    <span className="rounded bg-teal-600 px-1.5 py-px font-mono text-[9px] font-semibold tracking-wide text-white">
      OPUS
    </span>
  ) : (
    <span className="rounded border border-slate-300 px-1.5 py-px font-mono text-[9px] font-semibold tracking-wide text-slate-500">
      SONNET
    </span>
  );
}

function AgentChip({ agent }: { agent: PresetAgent }) {
  const isCust = agent.purpose === 'customizer';
  const tint = TINT[agent.iconColor] ?? TINT.teal;
  return (
    <span
      className={[
        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]',
        isCust ? 'bg-teal-600 text-white' : `${tint.soft} ${tint.fg}`,
      ].join(' ')}
    >
      <AgentGlyph kind={agent.iconKind} className="h-[15px] w-[15px]" />
    </span>
  );
}

function PromptButton({
  text, onClick,
}: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-2.5 rounded-[10px] border border-slate-200 bg-white px-2.5 py-2.5 text-left text-[12.5px] leading-snug text-slate-800 transition active:scale-[0.99] active:border-teal-600 active:bg-teal-600 active:text-white active:shadow-[0_4px_14px_rgba(13,148,136,0.25)] hover:border-slate-300"
    >
      <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-teal-600/10 text-teal-700 group-active:bg-white/20 group-active:text-white">
        <svg viewBox="0 0 10 10" className="h-[9px] w-[9px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
          <path d="M2 5h6M5 2l3 3-3 3" />
        </svg>
      </span>
      <span className="flex-1 [text-wrap:pretty]">{text}</span>
    </button>
  );
}

function EmptyPrompts({ onFree }: { onFree: () => void }) {
  return (
    <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50 px-3.5 py-4 text-center">
      <p className="mb-3 text-[11.5px] leading-relaxed text-slate-500">
        このエージェントにはまだサンプルがありません。
      </p>
      <button
        type="button"
        onClick={onFree}
        className="inline-flex items-center gap-1.5 rounded-[9px] bg-teal-600 px-3.5 py-2 text-[12px] font-semibold text-white"
      >
        自由入力で話しかける
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6h7M6 3l3 3-3 3" />
        </svg>
      </button>
    </div>
  );
}

function AgentRow({
  agent, open, onToggle, onSelectPrompt,
}: {
  agent: PresetAgent;
  open: boolean;
  onToggle: () => void;
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div
      className={[
        'overflow-hidden rounded-xl border transition',
        open
          ? 'border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
          : 'border-slate-200/70 bg-transparent',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <AgentChip agent={agent} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-slate-800">{agent.name}</span>
            <ModelBadge model={agent.model} />
            {agent.isDefault && (
              <span className="rounded border border-slate-200 px-1 text-[8.5px] font-semibold text-slate-400">
                既定
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-slate-500">
            {agent.desc}
          </span>
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {agent.prompts.length === 0 ? (
            <EmptyPrompts onFree={() => onSelectPrompt('')} />
          ) : (
            agent.prompts.map((p, i) => (
              <PromptButton key={i} text={p} onClick={() => onSelectPrompt(p)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PresetAgentLanding({ agents, onSelectPrompt, searchable }: Props) {
  const list = publicAgents(agents);
  const [openId, setOpenId] = useState<string | null>(defaultOpenId(list));
  const [query, setQuery] = useState('');

  const showSearch = searchable ?? list.length > 6;
  const filtered = query
    ? list.filter((a) => (a.name + a.desc).toLowerCase().includes(query.toLowerCase()))
    : list;

  // エッジ: エージェント 1 個のみ → リスト chrome を省いて即提示
  if (list.length === 1) {
    const a = list[0];
    return (
      <div className="px-4 pb-3.5 pt-5">
        <div className="flex flex-col items-center text-center">
          <AgentChip agent={a} />
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-slate-800">{a.name}</span>
            <ModelBadge model={a.model} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{a.desc}</p>
        </div>
        <p className="px-1 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
          サンプルから始める
        </p>
        <div className="flex flex-col gap-1.5">
          {a.prompts.map((p, i) => (
            <PromptButton key={i} text={p} onClick={() => onSelectPrompt(a, p)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pb-2.5 pt-3.5">
        <h2 className="mb-0.5 text-[15px] font-semibold tracking-tight text-slate-800">
          何をお手伝いしましょうか？
        </h2>
        <p className="text-[11.5px] leading-normal text-slate-500">
          エージェントを選んで、サンプルからすぐに始められます。
        </p>
      </div>

      {showSearch && (
        <div className="px-4 pb-2.5">
          <div className="flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5">
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <circle cx="6" cy="6" r="4" /><path d="M9 9l2.5 2.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="エージェントを検索"
              className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 px-3 pb-2">
        {filtered.map((a) => (
          <AgentRow
            key={a.id}
            agent={a}
            open={a.id === openId}
            onToggle={() => setOpenId((id) => (id === a.id ? null : a.id))}
            onSelectPrompt={(p) => onSelectPrompt(a, p)}
          />
        ))}
      </div>
    </div>
  );
}
