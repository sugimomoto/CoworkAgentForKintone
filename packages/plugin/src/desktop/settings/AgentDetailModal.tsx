// Cowork Agent for kintone — Agent 詳細編集 / 新規 Custom Agent 追加モーダル (#40)
//
// admin 専用。AgentsListPane の「編集 →」/「+ Custom Agent を追加」から開く。
// form の state は AgentEditDraft。保存ボタンで applyAgentEdit / createCustomAgentFrom を呼ぶ。
//
// モード管理は useAgentModalMode、フォーム本体は agent-detail/DraftForm、
// 削除確認は components/ConfirmDialog、draft 構築は agent-detail/buildDraft に分割 (Phase 3 PR-C)。

import { useCallback, useEffect, useState } from 'react';

import { BUILTIN_AGENT_SPECS } from '../../core/bootstrap/builtInAgents';
import { ConfirmDialog } from '../components/ConfirmDialog';

import { buildDraftFromAgent, buildDraftFromSpec, isBuiltInPurpose } from './agent-detail/buildDraft';
import { DraftForm } from './agent-detail/DraftForm';
import { useAgentModalMode } from './agent-detail/useAgentModalMode';
import { NotifySection } from './notify/NotifySection';

import type { AgentDetailModalMode, AvailableSkill } from './agent-detail/types';
import type { WebhookConfig } from './notify/webhookPlatform';
import type { AgentRecord } from '../../core/bootstrap/agentTypes';
import type { AgentEditDraft } from '../../core/managed-agents/agentDetailApi';
import type { Agent } from '../../core/managed-agents/types';

export type { AvailableSkill, AgentDetailModalMode } from './agent-detail/types';
export { buildDraftFromAgent, buildDraftFromSpec } from './agent-detail/buildDraft';

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
   * - 3rd 引数 webhook: 通知先 Webhook の working copy (#13)。null=未設定/解除、
   *   {platform,url}=新規/上書き、{platform}(url 無し)=変更なし。親が登録/解除を行う。
   */
  onSave: (
    draft: AgentEditDraft,
    sourceAgent: AgentRecord,
    webhook: WebhookConfig | null,
  ) => Promise<void>;
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

export function AgentDetailModal(props: AgentDetailModalProps): JSX.Element {
  const { fetchAgent, availableSkills, fallbackTemplates, onDelete, onSave } = props;
  const {
    localMode,
    setLocalMode,
    isEdit,
    editAgent,
    isCreateFromProposal,
    templateId,
    setTemplateId,
    sourceAgent,
  } = useAgentModalMode(props.mode, fallbackTemplates);

  const [draft, setDraft] = useState<AgentEditDraft | null>(null);
  // 通知先 Webhook の working copy (#13)。既存 Agent が登録済なら伏字 ({platform}) で初期化。
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
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
    void fetchAgent(sourceAgent.id)
      .then((agent) => {
        if (cancelled) return;
        setDraft(
          buildDraftFromAgent(
            agent,
            sourceAgent,
            availableSkills,
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
  }, [sourceAgent, fetchAgent, availableSkills, localMode]);

  // 通知 working copy の初期化 (#13)。編集中の Agent が登録済なら伏字、それ以外は未設定。
  useEffect(() => {
    setWebhook(editAgent?.notifyPlatform ? { platform: editAgent.notifyPlatform } : null);
  }, [editAgent]);

  /** 「雛形から作り直す」: create-from-proposal → 通常の create モードに切替 (draft 破棄) */
  const handleRebuildFromTemplate = useCallback(() => {
    const templates = fallbackTemplates ?? [];
    setLocalMode({ kind: 'create', templates });
  }, [fallbackTemplates, setLocalMode]);

  const handleReset = useCallback(() => {
    if (!editAgent || editAgent.source !== 'builtin') return;
    const purpose = editAgent.purpose;
    if (!isBuiltInPurpose(purpose)) return;
    const spec = BUILTIN_AGENT_SPECS[purpose];
    setDraft(buildDraftFromSpec(spec, editAgent, availableSkills));
  }, [editAgent, availableSkills]);

  const handleDelete = useCallback(async () => {
    if (!editAgent || !onDelete) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onDelete(editAgent);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '削除に失敗しました');
      setSubmitting(false);
      setConfirmDelete(false);
    }
  }, [editAgent, onDelete]);

  const handleSubmit = useCallback(async () => {
    if (!draft || !sourceAgent) return;
    if (draft.name.trim() === '' || draft.systemPrompt.trim() === '') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(draft, sourceAgent, webhook);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存に失敗しました');
      setSubmitting(false);
    }
  }, [draft, sourceAgent, onSave, webhook]);

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
            <>
              <DraftForm
                draft={draft}
                setDraft={setDraft}
                availableSkills={availableSkills}
                source={editAgent?.source ?? 'custom'}
              />
              {/* 通知先 Webhook (#13) — 公開先(ACL)の後・フッタ直前。新規作成時は作成後に登録される。 */}
              <div className="mt-[16px] border-t border-border pt-[14px]">
                <NotifySection value={webhook} onChange={setWebhook} />
              </div>
            </>
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
          {editAgent?.source === 'custom' && onDelete && (
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
          <ConfirmDialog
            testId="agent-detail-delete-confirm"
            confirmTestId="agent-detail-delete-confirm-yes"
            title="エージェントを削除"
            message={
              <>
                <span className="font-semibold text-text">「{editAgent.name}」</span>{' '}
                を Anthropic Workspace 上でアーカイブします。既存 Session は継続実行できますが、
                Header からは選択できなくなります。
              </>
            }
            confirmLabel="削除する"
            busyLabel="削除中…"
            submitting={submitting}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
          />
        )}
      </div>
    </div>
  );
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
