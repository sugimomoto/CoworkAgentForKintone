// AgentDetailModal のフォーム本体。基本情報 / System Prompt / Quick Actions /
// 公開先 / Skills / Tools の編集セクションをまとめる。

import { useEffect, useMemo, useState } from 'react';

import { accessValueOf } from '../../../core/access/accessControl';
import { AGENT_GLYPHS, AGENT_PICKER_COLORS } from '../../../core/bootstrap/agentTypes';
import {
  DESTRUCTIVE_TOOL_NAMES,
  KINTONE_TOOL_NAMES,
  type KintoneToolName,
} from '../../../core/bootstrap/builtInAgents';
import {
  resolveAccessEntries,
  searchGroups,
  searchOrganizations,
  searchUsers,
} from '../../../core/kintone/users';
import { AgentIcon } from '../../components/AgentIcon';
import { FormField } from '../../components/ui/FormField';
import { AccessPicker } from '../AccessPicker';

import type { AvailableSkill } from './types';
import type { AgentColor, AgentGlyph } from '../../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../../core/managed-agents/agentDetailApi';

export interface DraftFormProps {
  draft: AgentEditDraft;
  setDraft: (next: AgentEditDraft) => void;
  availableSkills: readonly AvailableSkill[];
  source: 'builtin' | 'custom';
}

export function DraftForm({ draft, setDraft, availableSkills, source }: DraftFormProps): JSX.Element {
  const update = <K extends keyof AgentEditDraft>(key: K, value: AgentEditDraft[K]): void =>
    setDraft({ ...draft, [key]: value });

  const toggleSkill = (s: AvailableSkill): void => {
    if (s.type === 'anthropic') {
      const has = draft.anthropicSkillIds.includes(s.skillId);
      update(
        'anthropicSkillIds',
        has
          ? draft.anthropicSkillIds.filter((id) => id !== s.skillId)
          : [...draft.anthropicSkillIds, s.skillId],
      );
    } else {
      const has = draft.customSkillIds.includes(s.skillId);
      update(
        'customSkillIds',
        has
          ? draft.customSkillIds.filter((id) => id !== s.skillId)
          : [...draft.customSkillIds, s.skillId],
      );
    }
  };

  const toggleTool = (name: KintoneToolName): void => {
    const has = draft.enabledTools.includes(name);
    update(
      'enabledTools',
      (has
        ? draft.enabledTools.filter((n) => n !== name)
        : [...draft.enabledTools, name]) as readonly KintoneToolName[],
    );
  };

  return (
    <div className="grid grid-cols-1 gap-[16px]">
      {/* 基本情報 */}
      <section>
        <h3 className="mb-[8px] text-[11px] font-bold uppercase tracking-[0.5px] text-subtle">
          基本情報
        </h3>
        <div className="grid grid-cols-1 gap-[10px]">
          <FormField label="表示名">
            <input
              type="text"
              data-testid="agent-detail-name"
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] text-[12px] text-text"
            />
          </FormField>
          <FormField label="説明 (1 行)">
            <input
              type="text"
              data-testid="agent-detail-description"
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
              className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] text-[12px] text-text"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-[10px]">
            <FormField label="アイコン">
              <div className="flex flex-wrap gap-[4px]">
                {AGENT_GLYPHS.map((g) => (
                  <IconChoice
                    key={g}
                    glyph={g}
                    color={draft.iconColor}
                    selected={draft.iconKind === g}
                    onSelect={() => update('iconKind', g)}
                  />
                ))}
              </div>
            </FormField>
            <FormField label="色">
              <div className="flex flex-wrap gap-[4px]">
                {AGENT_PICKER_COLORS.map((c) => (
                  <ColorChoice
                    key={c}
                    color={c}
                    selected={draft.iconColor === c}
                    onSelect={() => update('iconColor', c)}
                  />
                ))}
              </div>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <FormField label="公開">
              <label className="flex items-center gap-[6px] text-[11.5px] text-text">
                <input
                  type="checkbox"
                  data-testid="agent-detail-visibility"
                  checked={draft.visibility === 'public'}
                  onChange={(e) => update('visibility', e.target.checked ? 'public' : 'private')}
                />
                Header に表示する
              </label>
            </FormField>
            <FormField label="既定">
              <label className="flex items-center gap-[6px] text-[11.5px] text-text">
                <input
                  type="checkbox"
                  data-testid="agent-detail-default"
                  checked={draft.isDefault}
                  onChange={(e) => update('isDefault', e.target.checked)}
                />
                組織既定 (初期選択)
              </label>
            </FormField>
          </div>
        </div>
      </section>

      {/* System prompt */}
      <section>
        <h3 className="mb-[8px] text-[11px] font-bold uppercase tracking-[0.5px] text-subtle">
          System Prompt
        </h3>
        <textarea
          data-testid="agent-detail-system"
          value={draft.systemPrompt}
          onChange={(e) => update('systemPrompt', e.target.value)}
          rows={12}
          className="w-full resize-y rounded-[6px] border border-border bg-card px-[10px] py-[6px] font-mono text-[11px] leading-[1.45] text-text"
        />
      </section>

      {/* Quick Actions */}
      <QuickActionsSection
        value={draft.quickActions}
        onChange={(next) => update('quickActions', next)}
      />

      {/* 公開先 */}
      <section>
        <h3 className="mb-[8px] text-[11px] font-bold uppercase tracking-[0.5px] text-subtle">
          公開先
        </h3>
        <AccessPicker
          value={accessValueOf(draft)}
          onChange={(next) => setDraft({ ...draft, ...next })}
          searchUsers={searchUsers}
          searchGroups={searchGroups}
          searchOrganizations={searchOrganizations}
          resolveEntries={resolveAccessEntries}
        />
      </section>

      {/* Skills */}
      <section>
        <h3 className="mb-[8px] text-[11px] font-bold uppercase tracking-[0.5px] text-subtle">
          Skills ({draft.anthropicSkillIds.length + draft.customSkillIds.length} 個 attach)
        </h3>
        {availableSkills.length === 0 ? (
          <div className="text-[11px] text-muted">利用可能な skill がありません</div>
        ) : (
          <ul className="grid grid-cols-1 gap-[4px]">
            {availableSkills.map((s) => {
              const isOn =
                s.type === 'anthropic'
                  ? draft.anthropicSkillIds.includes(s.skillId)
                  : draft.customSkillIds.includes(s.skillId);
              return (
                <li key={`${s.type}:${s.skillId}`}>
                  <label className="flex cursor-pointer items-center gap-[8px] rounded-[6px] px-[6px] py-[4px] text-[11.5px] text-text hover:bg-card-hi">
                    <input
                      type="checkbox"
                      data-testid={`agent-detail-skill-${s.skillId}`}
                      checked={isOn}
                      onChange={() => toggleSkill(s)}
                    />
                    <span className="flex-1 truncate">{s.label}</span>
                    <span
                      className={`rounded-[3px] px-[4px] py-[1px] font-mono text-[9.5px] ${
                        s.type === 'anthropic' ? 'bg-accent-soft text-accent' : 'bg-card-hi text-muted'
                      }`}
                    >
                      {s.type}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Tools */}
      <section>
        <h3 className="mb-[8px] text-[11px] font-bold uppercase tracking-[0.5px] text-subtle">
          kintone MCP Tools ({draft.enabledTools.length} / {KINTONE_TOOL_NAMES.length})
        </h3>
        <ul className="grid grid-cols-1 gap-[4px] md:grid-cols-2">
          {KINTONE_TOOL_NAMES.map((name) => {
            const isOn = draft.enabledTools.includes(name);
            const destructive = DESTRUCTIVE_TOOL_NAMES.has(name);
            return (
              <li key={name}>
                <label className="flex cursor-pointer items-center gap-[8px] rounded-[6px] px-[6px] py-[4px] text-[11.5px] text-text hover:bg-card-hi">
                  <input
                    type="checkbox"
                    data-testid={`agent-detail-tool-${name}`}
                    checked={isOn}
                    onChange={() => toggleTool(name)}
                  />
                  <span className="flex-1 truncate font-mono text-[11px]">{name}</span>
                  {destructive && (
                    <span className="rounded-[3px] bg-warn-soft px-[4px] py-[1px] font-mono text-[9px] text-warn">
                      破壊的
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {source === 'builtin' && (
        <div className="rounded-[8px] border border-accent-soft bg-accent-soft/50 px-[10px] py-[8px] text-[10.5px] text-text">
          ヒント: built-in Agent を編集しても Anthropic Workspace 上の Agent ID は変わりません。
          「初期値に戻す」で出荷時の system prompt / tools / skills 構成に戻せます。
        </div>
      )}
    </div>
  );
}

// ─── form pieces ───────────────────────────────────────────────────────────

function IconChoice({
  glyph,
  color,
  selected,
  onSelect,
}: {
  glyph: AgentGlyph;
  color: AgentColor;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={`agent-detail-icon-${glyph}`}
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-[28px] w-[28px] items-center justify-center rounded-[6px] border ${
        selected ? 'border-accent ring-2 ring-accent/40' : 'border-border'
      }`}
    >
      <AgentIcon kind={glyph} color={color} size={20} />
    </button>
  );
}

function ColorChoice({
  color,
  selected,
  onSelect,
}: {
  color: AgentColor;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={`agent-detail-color-${color}`}
      onClick={onSelect}
      aria-pressed={selected}
      title={color}
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${colorSwatch(
        color,
      )} ${selected ? 'ring-2 ring-accent ring-offset-[1px]' : ''}`}
    >
      {selected ? <CheckIcon /> : null}
    </button>
  );
}

function colorSwatch(c: AgentColor): string {
  switch (c) {
    case 'teal':
      return 'bg-teal-500';
    case 'emerald':
      return 'bg-emerald-500';
    case 'amber':
      return 'bg-amber-500';
    case 'rose':
      return 'bg-rose-500';
    case 'indigo':
      return 'bg-indigo-500';
    case 'slate':
      return 'bg-slate-500';
    case 'sky':
      return 'bg-sky-500';
    case 'fuchsia':
      return 'bg-fuchsia-500';
    default:
      return 'bg-accent';
  }
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6l3 3 5-6" />
    </svg>
  );
}

// ─── QuickActionsSection ─────────────────────────────────────────────────
//
// クイックアクション (PresetAgentLanding の 1 クリック実行ボタン) 編集セクション。
// 1 行 1 件、空行無視、最大 5 行・1 行 200 文字、全体 1024 byte。
// バリデーション NG は警告文のみで保存は止めない (Phase 1 = 弱バリデーション)。

const QUICK_ACTIONS_MAX_COUNT = 5;
const QUICK_ACTIONS_MAX_LINE_LEN = 200;
const QUICK_ACTIONS_MAX_TOTAL_BYTES = 1024;

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

interface QuickActionsParse {
  /** 全行を split + trim + 空行除去した結果 (slice 前)。バリデーション用。 */
  lines: readonly string[];
  /** 保存対象。lines を最大 5 件に切り詰めたもの。 */
  prompts: readonly string[];
}
function parseQuickActionsText(text: string): QuickActionsParse {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return { lines, prompts: lines.slice(0, QUICK_ACTIONS_MAX_COUNT) };
}

interface QuickActionsSectionProps {
  value: readonly string[];
  onChange: (next: readonly string[]) => void;
}

function QuickActionsSection({ value, onChange }: QuickActionsSectionProps): JSX.Element {
  // textarea の生文字列はローカル state で保持し、空行を一旦許容する。
  // 親の draft.quickActions は parse 結果 (空行除去・上限 slice 済) を反映する。
  const [text, setText] = useState<string>(() => value.join('\n'));

  // 親側で value が差し替わった (= 「初期値に戻す」等) 際に textarea を同期する。
  // 自分の入力由来 (parse(text) === value) のときは上書きしない。
  const parse = useMemo(() => parseQuickActionsText(text), [text]);
  useEffect(() => {
    if (sameStringArray(parse.prompts, value)) return;
    setText(value.join('\n'));
    // text が変わると次レンダで parse が再計算され、value とは一致した状態になる。
  }, [value, parse.prompts]);

  const totalBytes = useMemo(
    () => new TextEncoder().encode(JSON.stringify(value)).byteLength,
    [value],
  );
  const tooMany = parse.lines.length > QUICK_ACTIONS_MAX_COUNT;
  const longLine = parse.lines.find((l) => l.length > QUICK_ACTIONS_MAX_LINE_LEN);
  const tooLarge = totalBytes > QUICK_ACTIONS_MAX_TOTAL_BYTES;

  function handleChange(nextText: string): void {
    setText(nextText);
    onChange(parseQuickActionsText(nextText).prompts);
  }

  return (
    <section>
      <h3 className="mb-[8px] text-[11px] font-bold uppercase tracking-[0.5px] text-subtle">
        クイックアクション ({value.length} / {QUICK_ACTIONS_MAX_COUNT})
      </h3>
      <p className="mb-[6px] text-[11px] leading-relaxed text-muted">
        チャットパネルの起動直後に並ぶ「1 クリック実行ボタン」の文言。1 行 1 件、空行は無視、最大{' '}
        {QUICK_ACTIONS_MAX_COUNT} 個まで。
      </p>
      <textarea
        data-testid="agent-detail-quick-actions"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={5}
        placeholder={'例:\nkintone アプリ一覧を見せて\n先週追加された案件を集計して'}
        className="w-full resize-y rounded-[6px] border border-border bg-card px-[10px] py-[6px] text-[12px] leading-[1.5] text-text placeholder:text-subtle"
      />
      {(tooMany || longLine || tooLarge) && (
        <ul
          data-testid="agent-detail-quick-actions-errors"
          className="mt-[6px] list-disc pl-[18px] text-[11px] text-warn"
        >
          {tooMany && (
            <li>
              {QUICK_ACTIONS_MAX_COUNT} 個までです (現在 {parse.lines.length} 個)。超過分は保存時に切り詰められます。
            </li>
          )}
          {longLine && (
            <li>
              1 行が {QUICK_ACTIONS_MAX_LINE_LEN} 文字を超えています ({longLine.length} 文字)。短くしてください。
            </li>
          )}
          {tooLarge && (
            <li>
              全体サイズが {QUICK_ACTIONS_MAX_TOTAL_BYTES} byte を超えています ({totalBytes} byte)。
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
