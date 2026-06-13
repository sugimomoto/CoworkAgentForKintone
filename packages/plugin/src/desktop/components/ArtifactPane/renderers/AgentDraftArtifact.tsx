// AgentDraftArtifact — エージェントデザイナー (#48) が出力した設計案のスナップショット
//
// content は JSON 文字列 `{ draft: AgentEditDraft, rationale: string }`。
// 履歴復帰性のためのカード UI + 「この内容で作成画面を開く」ボタンを提供する。
// 押下で chatStore.setPendingAgentProposal({ draft, rationale }) を呼び、
// ChatPanel 側の watcher が AgentDetailModal を `create-from-proposal` mode で開く。

import { useMemo } from 'react';

import { useChatStore } from '../../../../store/chatStore';
import { AgentIcon } from '../../AgentIcon';
import { ModelBadge } from '../../ModelBadge';

import type { Artifact } from '../../../../core/artifacts/types';
import type { AgentColor, AgentGlyph } from '../../../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../../../core/managed-agents/agentDetailApi';

interface AgentDraftContent {
  draft: AgentEditDraft;
  rationale: string;
  model: 'opus' | 'sonnet';
}

function parseContent(raw: string): AgentDraftContent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const o = json as { draft?: unknown; rationale?: unknown; model?: unknown };
  if (!o.draft || typeof o.draft !== 'object') return null;
  const d = o.draft as Record<string, unknown>;
  if (typeof d.name !== 'string' || typeof d.systemPrompt !== 'string') return null;
  return {
    draft: o.draft as AgentEditDraft,
    rationale: typeof o.rationale === 'string' ? o.rationale : '',
    model: o.model === 'opus' ? 'opus' : 'sonnet',
  };
}

export function AgentDraftArtifact({ artifact }: { artifact: Artifact }): JSX.Element {
  const parsed = useMemo(() => parseContent(artifact.content), [artifact.content]);
  const setPendingAgentProposal = useChatStore((s) => s.setPendingAgentProposal);

  if (!parsed) {
    return (
      <div className="px-[16px] py-[14px] text-[12px] text-warn">
        ⚠️ エージェント案の内容が解釈できませんでした。
      </div>
    );
  }
  const { draft, rationale, model } = parsed;
  const iconKind = (draft.iconKind ?? 'ai') as AgentGlyph;
  const iconColor = (draft.iconColor ?? 'teal') as AgentColor;

  return (
    <div className="flex h-full flex-col gap-[14px] overflow-y-auto bg-white px-[18px] py-[16px] text-text">
      <header className="flex items-start gap-[12px]">
        <AgentIcon kind={iconKind} color={iconColor} size={40} className="shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-[8px]">
            <h2 className="truncate text-[15px] font-bold text-text">{draft.name}</h2>
            <ModelBadge model={model} size="sm" />
          </div>
          {draft.description && (
            <p className="mt-[2px] text-[11.5px] text-muted">{draft.description}</p>
          )}
        </div>
      </header>

      <section>
        <h3 className="mb-[6px] text-[10.5px] font-bold uppercase tracking-[0.5px] text-subtle">
          クイックアクション ({draft.quickActions.length})
        </h3>
        {draft.quickActions.length === 0 ? (
          <div className="text-[11.5px] text-muted">(なし)</div>
        ) : (
          <ul className="flex flex-col gap-[4px]">
            {draft.quickActions.map((q, i) => (
              <li
                key={i}
                className="rounded-[6px] border border-card-border bg-card px-[10px] py-[6px] text-[12px]"
              >
                {q}
              </li>
            ))}
          </ul>
        )}
      </section>

      {rationale && (
        <details open>
          <summary className="cursor-pointer text-[10.5px] font-bold uppercase tracking-[0.5px] text-subtle">
            設計理由
          </summary>
          <p className="mt-[6px] whitespace-pre-wrap text-[11.5px] leading-[1.6] text-text">
            {rationale}
          </p>
        </details>
      )}

      <details open>
        <summary className="cursor-pointer text-[10.5px] font-bold uppercase tracking-[0.5px] text-subtle">
          システムプロンプト ({draft.systemPrompt.length} 字)
        </summary>
        <pre className="mt-[6px] max-h-[280px] overflow-auto rounded-[6px] border border-card-border bg-card px-[10px] py-[8px] font-mono text-[11px] leading-[1.5] text-text whitespace-pre-wrap">
          {draft.systemPrompt}
        </pre>
      </details>

      <section>
        <h3 className="mb-[4px] text-[10.5px] font-bold uppercase tracking-[0.5px] text-subtle">
          推奨ツール ({draft.enabledTools.length})
        </h3>
        {draft.enabledTools.length === 0 ? (
          <div className="text-[11.5px] text-muted">(なし)</div>
        ) : (
          <div className="flex flex-wrap gap-[4px]">
            {draft.enabledTools.map((t) => (
              <code
                key={t}
                className="rounded-[3px] bg-card-hi px-[6px] py-[2px] font-mono text-[10.5px] text-muted"
              >
                {t}
              </code>
            ))}
          </div>
        )}
      </section>

      <footer className="sticky bottom-0 -mx-[18px] -mb-[16px] mt-auto border-t border-border bg-white px-[18px] py-[12px]">
        <button
          type="button"
          data-testid="agent-draft-open-modal"
          onClick={() => setPendingAgentProposal({ draft, rationale, model })}
          className="w-full rounded-[9px] bg-accent px-[14px] py-[10px] text-[12.5px] font-semibold text-white hover:opacity-90"
        >
          この内容で作成画面を開く →
        </button>
      </footer>
    </div>
  );
}
