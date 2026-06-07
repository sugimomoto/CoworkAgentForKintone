// Cowork Agent for kintone — Agent 詳細編集 / 新規 Custom Agent 追加モーダル (#40)
//
// admin 専用。AgentsListPane の「編集 →」/「+ Custom Agent を追加」から開く。
// form の state は AgentEditDraft。保存ボタンで applyAgentEdit / createCustomAgentFrom を呼ぶ。
//
// built-in (= agent.source === 'builtin') では:
//   - 「初期値に戻す」ボタンで BUILTIN_AGENT_SPECS の出荷時値を form に再ロード
//   - 削除ボタンは非表示
// custom (= agent.source === 'custom') では:
//   - 「初期値に戻す」ボタンは非表示
//   - 削除ボタンを表示 (確認ダイアログ → archive)
//
// create モードでは:
//   - 冒頭に「雛形」プルダウンが出る
//   - 雛形変更で form 全体がリロード

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AGENT_GLYPHS,
  AGENT_PICKER_COLORS,
} from '../../core/bootstrap/agentTypes';
import {
  BUILTIN_AGENT_SPECS,
  DESTRUCTIVE_TOOL_NAMES,
  KINTONE_TOOL_NAMES,
  type KintoneToolName,
} from '../../core/bootstrap/builtInAgents';
import { extractEnabledTools } from '../../core/managed-agents/buildAgentTools';
import {
  resolveAccessEntries,
  searchGroups,
  searchOrganizations,
  searchUsers,
} from '../../core/kintone/users';

import { accessValueOf } from '../../core/access/accessControl';

import { AgentIcon } from '../components/AgentIcon';
import { AccessPicker } from './AccessPicker';

import type {
  AgentColor,
  AgentGlyph,
  AgentPurpose,
  AgentRecord,
} from '../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../core/managed-agents/agentDetailApi';
import type { Agent } from '../../core/managed-agents/types';

// ─── public types ─────────────────────────────────────────────────────────

export interface AvailableSkill {
  /** Anthropic Workspace の skill_id (custom skill では Anthropic 払出 ID) */
  skillId: string;
  /** Anthropic 製 skill (xlsx/docx/...) の場合 'anthropic'、Plugin/Custom なら 'custom' */
  type: 'anthropic' | 'custom';
  /** UI 表示用ラベル */
  label: string;
}

export type AgentDetailModalMode =
  | { kind: 'edit'; agent: AgentRecord }
  | { kind: 'create'; templates: readonly AgentRecord[] }
  | {
      // #48 Designer の propose_agent 受信時に開くモード。
      // 雛形プルダウンは出さず、draft で全項目初期化。「雛形から作り直す」リンクで
      // fallbackTemplates を使った通常の create モードに切替えられる。
      kind: 'create-from-proposal';
      draft: AgentEditDraft;
      rationale: string;
      /** 提案された model。base 雛形の選定に使う (AgentEditDraft には載せない) */
      model: 'opus' | 'sonnet';
    };

export interface AgentDetailModalProps {
  /** edit (既存 Agent 編集) / create (新規 Custom Agent 追加) / create-from-proposal (#48 Designer 提案) */
  mode: AgentDetailModalMode;
  /** モーダル open 時に Agent 詳細 (system / tools / skills) を取得する */
  fetchAgent: (id: string) => Promise<Agent>;
  /**
   * 保存ハンドラ。
   * - edit モード: 2nd 引数 (sourceAgent) は mode.agent と一致する
   * - create モード: 2nd 引数は dropdown で選択された雛形 AgentRecord (base)
   * - create-from-proposal モード: 2nd 引数は fallbackTemplates から選んだ Designer 等の base
   */
  onSave: (draft: AgentEditDraft, sourceAgent: AgentRecord) => Promise<void>;
  /** 削除ハンドラ — custom Agent の編集モードのみ表示 */
  onDelete?: (agent: AgentRecord) => Promise<void>;
  /** 描画用 skill リスト (Anthropic 製 + Plugin 同梱 + custom 同期済) */
  availableSkills: readonly AvailableSkill[];
  /**
   * create-from-proposal モードで「雛形から作り直す」を押した時の templates ソース。
   * 通常は builtInAgents をそのまま渡す。
   */
  fallbackTemplates?: readonly AgentRecord[];
  /** モーダルを閉じる */
  onClose: () => void;
}

// ─── component ────────────────────────────────────────────────────────────

export function AgentDetailModal(props: AgentDetailModalProps): JSX.Element {
  // localMode: 「雛形から作り直す」(#48 提案 mode → create mode への移行) の遷移用。
  // 親から渡された mode が変わったら localMode も同期する。
  const [localMode, setLocalMode] = useState<AgentDetailModalMode>(props.mode);
  useEffect(() => {
    setLocalMode(props.mode);
  }, [props.mode]);

  const isEdit = localMode.kind === 'edit';
  const editAgent: AgentRecord | null = localMode.kind === 'edit' ? localMode.agent : null;
  const isCreateFromProposal = localMode.kind === 'create-from-proposal';

  // create モードでは雛形 ID を state で保持 (templates[0] を初期選択)
  const initialTemplateId =
    localMode.kind === 'create' ? localMode.templates[0]?.id ?? '' : '';
  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  // localMode が create に切替わったら templateId も初期化
  useEffect(() => {
    if (localMode.kind === 'create') {
      setTemplateId(localMode.templates[0]?.id ?? '');
    }
  }, [localMode]);

  // 現在 form で扱っている Agent。
  // - edit: mode.agent
  // - create: templateId で引いた template
  // - create-from-proposal: fallbackTemplates から Designer (= isDefault) を優先
  const sourceAgent: AgentRecord | null = useMemo(() => {
    if (localMode.kind === 'edit') return localMode.agent;
    if (localMode.kind === 'create') {
      return localMode.templates.find((t) => t.id === templateId) ?? null;
    }
    // create-from-proposal: base に使う Agent を fallbackTemplates から選ぶ。
    // Designer が提案した model に一致する built-in を優先 (= 新 Agent の model 継承)、
    // 無ければ isDefault → 先頭の順でフォールバック。
    const pool = props.fallbackTemplates ?? [];
    const wantModel = localMode.model;
    return (
      pool.find((t) => t.model === wantModel) ??
      pool.find((t) => t.isDefault) ??
      pool[0] ??
      null
    );
  }, [localMode, templateId, props.fallbackTemplates]);

  const [draft, setDraft] = useState<AgentEditDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // モーダル open 時 / 雛形変更時に Agent 詳細を fetch して form を初期化。
  // create-from-proposal モードでは draft が外部から渡されるので fetch 不要。
  useEffect(() => {
    if (localMode.kind === 'create-from-proposal') {
      setDraft(localMode.draft);
      setLoading(false);
      setFetchError(null);
      return;
    }
    if (!sourceAgent) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setDraft(null);
    void props
      .fetchAgent(sourceAgent.id)
      .then((agent) => {
        if (cancelled) return;
        setDraft(
          buildDraftFromAgent(
            agent,
            sourceAgent,
            props.availableSkills,
            localMode.kind === 'edit' ? 'edit' : 'create',
          ),
        );
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setFetchError(e instanceof Error ? e.message : 'Agent 詳細の取得に失敗しました');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceAgent, props.fetchAgent, props.availableSkills, localMode]);

  /** 「雛形から作り直す」: create-from-proposal → 通常の create モードに切替 (draft 破棄) */
  const handleRebuildFromTemplate = useCallback(() => {
    const templates = props.fallbackTemplates ?? [];
    setLocalMode({ kind: 'create', templates });
  }, [props.fallbackTemplates]);

  const handleReset = useCallback(() => {
    if (!editAgent || editAgent.source !== 'builtin') return;
    const purpose = editAgent.purpose;
    if (!isBuiltInPurpose(purpose)) return;
    const spec = BUILTIN_AGENT_SPECS[purpose];
    setDraft(buildDraftFromSpec(spec, editAgent, props.availableSkills));
  }, [editAgent, props.availableSkills]);

  const handleDelete = useCallback(async () => {
    if (!editAgent || !props.onDelete) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await props.onDelete(editAgent);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '削除に失敗しました');
      setSubmitting(false);
      setConfirmDelete(false);
    }
  }, [editAgent, props.onDelete]);

  const handleSubmit = useCallback(async () => {
    if (!draft || !sourceAgent) return;
    if (draft.name.trim() === '' || draft.systemPrompt.trim() === '') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await props.onSave(draft, sourceAgent);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存に失敗しました');
      setSubmitting(false);
    }
  }, [draft, sourceAgent, props.onSave]);

  const canSubmit =
    !submitting &&
    draft !== null &&
    draft.name.trim().length > 0 &&
    draft.systemPrompt.trim().length > 0;

  return (
    <div
      data-testid="agent-detail-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-[20px]"
      onClick={props.onClose}
    >
      <div
        className="flex max-h-[88vh] w-[680px] max-w-full flex-col rounded-[12px] border border-border bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-[10px] border-b border-border px-[18px] py-[14px]">
          <div className="flex-1">
            <div className="flex items-center gap-[8px] text-[14px] font-semibold text-text">
              {isEdit
                ? `${editAgent?.name ?? ''} を編集`
                : isCreateFromProposal
                  ? 'カスタム エージェントを追加'
                  : 'カスタム エージェントを追加'}
              {isCreateFromProposal && (
                <span
                  data-testid="agent-detail-proposal-badge"
                  className="rounded-[4px] bg-accent-soft px-[6px] py-[1px] text-[9.5px] font-bold uppercase tracking-[0.5px] text-accent"
                >
                  エージェントデザイナーによる提案
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-muted">
              {isEdit
                ? 'system prompt / tools / skills を編集して保存すると次回 Session から反映されます'
                : isCreateFromProposal
                  ? '内容を確認・調整して保存してください'
                  : '雛形を選んで Agent を複製。model は変更できません'}
            </div>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            data-testid="agent-detail-close"
            onClick={props.onClose}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-muted hover:bg-card-hi"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[18px] py-[14px]">
          {/* create モードの雛形プルダウン */}
          {localMode.kind === 'create' && (
            <div className="mb-[14px] rounded-[8px] border border-border bg-card-hi p-[10px]">
              <label className="block text-[10.5px] font-semibold text-muted">雛形 (base Agent)</label>
              <select
                data-testid="agent-detail-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-[4px] w-full rounded-[6px] border border-border bg-card px-[8px] py-[5px] text-[12px] text-text"
              >
                {localMode.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.modelLabel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* create-from-proposal モードの rationale + 「雛形から作り直す」 */}
          {localMode.kind === 'create-from-proposal' && (
            <div className="mb-[14px] rounded-[8px] border border-accent-soft bg-accent-soft/40 p-[10px]">
              <details data-testid="agent-detail-rationale">
                <summary className="cursor-pointer text-[10.5px] font-semibold text-text">
                  設計理由
                </summary>
                <p className="mt-[6px] whitespace-pre-wrap text-[11.5px] leading-[1.55] text-text">
                  {localMode.rationale || '(理由は提供されていません)'}
                </p>
              </details>
              <div className="mt-[8px] text-right">
                <button
                  type="button"
                  data-testid="agent-detail-rebuild-from-template"
                  onClick={handleRebuildFromTemplate}
                  className="text-[10.5px] text-accent underline hover:no-underline"
                >
                  自分で雛形から作り直す →
                </button>
              </div>
            </div>
          )}

          {loading && <FetchPlaceholder />}
          {fetchError && (
            <div className="rounded-[8px] border border-warn/30 bg-warn-soft p-[12px] text-[11.5px] text-warn">
              {fetchError}
            </div>
          )}
          {!loading && !fetchError && draft && (
            <DraftForm
              draft={draft}
              setDraft={setDraft}
              availableSkills={props.availableSkills}
              source={editAgent?.source ?? 'custom'}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-[10px] border-t border-border px-[18px] py-[12px]">
          <div className="flex-1 text-[11px]">
            {submitError ? (
              <span className="text-warn">{submitError}</span>
            ) : !canSubmit && draft ? (
              <span className="text-muted">name と system prompt は必須です</span>
            ) : null}
          </div>
          {editAgent?.source === 'builtin' && (
            <button
              type="button"
              data-testid="agent-detail-reset"
              onClick={handleReset}
              disabled={submitting || loading}
              className="rounded-[7px] border border-border px-[10px] py-[6px] text-[11.5px] text-text hover:bg-card-hi disabled:opacity-50"
            >
              初期値に戻す
            </button>
          )}
          {editAgent?.source === 'custom' && props.onDelete && (
            <button
              type="button"
              data-testid="agent-detail-delete"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
              className="rounded-[7px] border border-warn/40 bg-transparent px-[10px] py-[6px] text-[11.5px] font-medium text-warn hover:bg-warn-soft disabled:opacity-50"
            >
              削除
            </button>
          )}
          <button
            type="button"
            onClick={props.onClose}
            disabled={submitting}
            className="rounded-[7px] border border-border px-[12px] py-[6px] text-[12px] text-text hover:bg-card-hi"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-testid="agent-detail-save"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'rounded-[7px] px-[14px] py-[6px] text-[12px] font-semibold',
              canSubmit
                ? 'cursor-pointer bg-accent text-white hover:opacity-90'
                : 'cursor-not-allowed bg-card-hi text-muted opacity-60',
            ].join(' ')}
          >
            {submitting ? '保存中…' : isEdit ? '保存' : '作成'}
          </button>
        </div>

        {/* 削除確認ダイアログ (overlay 内に inset) */}
        {confirmDelete && editAgent && (
          <ConfirmDeleteOverlay
            agentName={editAgent.name}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}

// ─── DraftForm ────────────────────────────────────────────────────────────

interface DraftFormProps {
  draft: AgentEditDraft;
  setDraft: (next: AgentEditDraft) => void;
  availableSkills: readonly AvailableSkill[];
  source: 'builtin' | 'custom';
}

function DraftForm({ draft, setDraft, availableSkills, source }: DraftFormProps): JSX.Element {
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

// ─── ConfirmDeleteOverlay ──────────────────────────────────────────────────

interface ConfirmDeleteOverlayProps {
  agentName: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  submitting: boolean;
}

function ConfirmDeleteOverlay({
  agentName,
  onCancel,
  onConfirm,
  submitting,
}: ConfirmDeleteOverlayProps): JSX.Element {
  return (
    <div
      data-testid="agent-detail-delete-confirm"
      className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/30"
    >
      <div className="w-[360px] rounded-[10px] border border-border bg-bg p-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="mb-[10px] text-[13px] font-semibold text-text">エージェントを削除</div>
        <p className="mb-[14px] text-[11.5px] leading-[1.5] text-muted">
          <span className="font-semibold text-text">「{agentName}」</span>{' '}
          を Anthropic Workspace 上でアーカイブします。既存 Session は継続実行できますが、
          Header からは選択できなくなります。
        </p>
        <div className="flex justify-end gap-[8px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-[7px] border border-border px-[12px] py-[5px] text-[11.5px] text-text"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-testid="agent-detail-delete-confirm-yes"
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="rounded-[7px] bg-warn px-[12px] py-[5px] text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── form pieces ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-[4px]">
      <span className="text-[10.5px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

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
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${
        colorSwatch(color)
      } ${selected ? 'ring-2 ring-accent ring-offset-[1px]' : ''}`}
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

function FetchPlaceholder(): JSX.Element {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-card-hi p-[18px] text-center text-[11.5px] text-muted">
      Agent 詳細を読み込み中…
    </div>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
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

// ─── draft 構築ヘルパー ──────────────────────────────────────────────────

function isBuiltInPurpose(p: AgentPurpose): p is Exclude<AgentPurpose, 'custom'> {
  return p === 'business' || p === 'customizer-opus' || p === 'customizer-sonnet';
}

/**
 * Anthropic Agent + AgentRecord + availableSkills から AgentEditDraft を構築。
 * `mode='create'` のときは name に「 のコピー」を suffix、isDefault=false に固定。
 */
export function buildDraftFromAgent(
  agent: Agent,
  record: AgentRecord,
  availableSkills: readonly AvailableSkill[],
  modeKind: 'edit' | 'create',
): AgentEditDraft {
  // tools[] から enabledTools を抽出
  const enabledTools = extractEnabledTools(agent.tools);

  // skills[] (Agent response) から Anthropic / custom を分離
  const rawSkills = (agent as unknown as { skills?: Array<{ type?: string; skill_id?: string }> })
    .skills;
  const anthropicSkillIds: string[] = [];
  const customSkillIds: string[] = [];
  if (Array.isArray(rawSkills)) {
    for (const s of rawSkills) {
      if (!s || typeof s.skill_id !== 'string') continue;
      if (s.type === 'anthropic') anthropicSkillIds.push(s.skill_id);
      else if (s.type === 'custom') customSkillIds.push(s.skill_id);
    }
  }

  const baseName = agent.name ?? record.name;
  const suffix = modeKind === 'create' ? ' のコピー' : '';

  return {
    name: `${baseName}${suffix}`,
    description: agent.description ?? record.description,
    iconKind: record.iconKind,
    iconColor: record.iconColor,
    visibility: record.visibility,
    isDefault: modeKind === 'create' ? false : record.isDefault,
    systemPrompt: agent.system ?? '',
    anthropicSkillIds,
    customSkillIds,
    enabledTools,
    quickActions: [...record.quickActions],
    allowedUsers: [...record.allowedUsers],
    allowedGroups: [...record.allowedGroups],
    allowedOrganizations: [...record.allowedOrganizations],
  };
}

/**
 * BUILTIN_AGENT_SPECS の出荷時 spec から AgentEditDraft を構築 (「初期値に戻す」用)。
 * Anthropic Workspace 上の custom skill ID は availableSkills.custom から名前で引き当てる。
 */
export function buildDraftFromSpec(
  spec: (typeof BUILTIN_AGENT_SPECS)[Exclude<AgentPurpose, 'custom'>],
  record: AgentRecord,
  availableSkills: readonly AvailableSkill[],
): AgentEditDraft {
  // custom skill: 名前 (availableSkills.label に skill name を入れている前提) で filter
  const customSkillIds = availableSkills
    .filter((s) => s.type === 'custom' && spec.customSkillFilter(s.label))
    .map((s) => s.skillId);
  return {
    name: spec.name,
    description: spec.description,
    iconKind: spec.iconKind,
    iconColor: spec.iconColor,
    visibility: record.visibility, // visibility は spec に無いので現状値を維持
    isDefault: spec.isDefault,
    systemPrompt: spec.systemPrompt,
    anthropicSkillIds: [...spec.anthropicSkillIds],
    customSkillIds,
    enabledTools: KINTONE_TOOL_NAMES.filter(spec.mcpToolFilter),
    quickActions: [...spec.quickActions],
    // 「初期値に戻す」は全員公開に戻す (built-in は ACL を持たない)
    allowedUsers: [],
    allowedGroups: [],
    allowedOrganizations: [],
  };
}
