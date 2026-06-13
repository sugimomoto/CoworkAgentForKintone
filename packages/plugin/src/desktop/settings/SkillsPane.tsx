// Cowork Agent for kintone — Settings View / 🧠 スキル (V1 P3.1)
//
// Plugin 同梱 skill の Anthropic Workspace への同期 + 同期済 skill 一覧表示。
// V1 では Workspace 全 skill の取得・カスタム skill 追加モーダル (P3.2) と連動する。
//
// 仕様: requirements.md §15.4 / design.md §4.6

import { useState } from 'react';

import { SkillAddModal } from './SkillAddModal';

import type { CustomSkillInput } from './SkillAddModal';

export interface BundledSkillEntry {
  /** SKILL.md frontmatter の name */
  name: string;
  /** 表示用タイトル */
  displayTitle: string;
  /** Anthropic から払い出された skill_id (未同期なら null) */
  skillId: string | null;
  /** Anthropic 側のバージョン (Unix epoch timestamp) */
  version: string | null;
  /** 'synced' = 最新同期済 / 'pending' = 未同期 / 'updated' = 古いバージョン */
  status: 'synced' | 'pending' | 'updated';
}

export interface SkillsPaneProps {
  /** Plugin 同梱 skill の同期状態 (resolveAgent 周りから渡される想定) */
  bundledSkills?: BundledSkillEntry[];
  /** カスタム skill (admin 追加) の一覧 */
  customSkills?: BundledSkillEntry[];
  /**
   * 「Plugin 同梱 skill を同期」ボタン押下時のハンドラ。
   * 呼出側は skillsSyncClient.syncSkills を呼ぶ。
   */
  onSyncBundled?: () => Promise<void>;
  /**
   * カスタム skill 追加 (SkillAddModal 経由で Anthropic にアップロード)
   */
  onAddCustomSkill?: (input: CustomSkillInput) => Promise<void>;
  /**
   * カスタム skill 編集 (V2 #30)。SkillAddModal を editing モードで開き、SKILL.md 本文を
   * 編集 → Worker /skills/sync で新 version 作成。
   */
  onEditCustomSkill?: (input: CustomSkillInput) => Promise<void>;
  /**
   * カスタム skill 削除 (V2 #30)。Anthropic `DELETE /v1/skills/{id}` で完全削除。
   * 呼出前に admin に確認ダイアログを出すこと。
   */
  onDeleteCustomSkill?: (skill: BundledSkillEntry) => Promise<void>;
}

export function SkillsPane({
  bundledSkills = [],
  customSkills = [],
  onSyncBundled,
  onAddCustomSkill,
  onEditCustomSkill,
  onDeleteCustomSkill,
}: SkillsPaneProps): JSX.Element {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  /** 編集中の skill (null = 編集モーダル閉じ) */
  const [editingSkill, setEditingSkill] = useState<BundledSkillEntry | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSync = async (): Promise<void> => {
    if (!onSyncBundled || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await onSyncBundled();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '同期に失敗しました');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div data-testid="skills-pane" className="p-[20px]">
      <div className="mb-[14px]">
        <h2 className="mb-[4px] text-[15px] font-semibold text-text">スキル</h2>
        <p className="text-[11px] text-muted">
          Plugin 同梱 skill (kintone-customize-js / plugin-development) と admin が追加した
          カスタム skill を管理します。同期は Anthropic Workspace に対して行われます。
        </p>
      </div>

      {/* 同梱 Skills */}
      <section className="mb-[20px]">
        <div className="mb-[8px] flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.6px] text-subtle">
            Plugin 同梱 Skills
          </h3>
          <button
            type="button"
            data-testid="skills-sync-btn"
            disabled={syncing || !onSyncBundled}
            onClick={handleSync}
            className={[
              'flex items-center gap-[6px] rounded-[7px] px-[12px] py-[6px] text-[11.5px] font-semibold',
              syncing || !onSyncBundled
                ? 'cursor-not-allowed bg-card-hi text-muted opacity-60'
                : 'cursor-pointer bg-accent text-white hover:opacity-90',
            ].join(' ')}
          >
            <SyncIcon spinning={syncing} />
            {syncing ? '同期中…' : '同期'}
          </button>
        </div>
        {syncError && (
          <div className="mb-[8px] rounded-[6px] border border-warn/30 bg-warn-soft px-[10px] py-[6px] text-[11px] text-warn">
            {syncError}
          </div>
        )}
        {bundledSkills.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border p-[14px] text-[12px] text-muted">
            同梱 skill 情報を読み込み中…
          </div>
        ) : (
          <ul className="flex flex-col gap-[6px]">
            {bundledSkills.map((s) => (
              <SkillRow key={s.name} skill={s} />
            ))}
          </ul>
        )}
      </section>

      {/* カスタム Skills */}
      <section>
        <div className="mb-[8px] flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.6px] text-subtle">
            カスタム Skills
          </h3>
          <button
            type="button"
            data-testid="skills-add-btn"
            disabled={!onAddCustomSkill}
            onClick={() => setShowAddModal(true)}
            className={[
              'flex items-center gap-[5px] rounded-[7px] border border-border px-[10px] py-[5px] text-[11.5px] font-medium',
              onAddCustomSkill
                ? 'cursor-pointer text-text hover:bg-card-hi'
                : 'cursor-not-allowed opacity-60 text-muted',
            ].join(' ')}
          >
            <PlusIcon />
            追加
          </button>
        </div>
        {customSkills.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border p-[14px] text-[12px] text-muted">
            カスタム skill はまだ追加されていません。
          </div>
        ) : (
          <ul className="flex flex-col gap-[6px]">
            {customSkills.map((s) => (
              <SkillRow
                key={s.name}
                skill={s}
                showStatus={false}
                actions={
                  <CustomSkillActions
                    skill={s}
                    onEdit={onEditCustomSkill ? () => setEditingSkill(s) : undefined}
                    onDelete={
                      onDeleteCustomSkill
                        ? async () => {
                            const ok = window.confirm(
                              `カスタム skill「${s.displayTitle}」を削除します。\n\n` +
                                'この skill を attach している Agent にはダングリング参照が\n' +
                                '残る可能性があります (新規セッションから skill 読込失敗の恐れ)。\n\n' +
                                '本当に削除しますか?',
                            );
                            if (!ok) return;
                            setDeletingName(s.name);
                            setDeleteError(null);
                            try {
                              await onDeleteCustomSkill(s);
                            } catch (e) {
                              setDeleteError(
                                e instanceof Error
                                  ? `${s.displayTitle} の削除に失敗: ${e.message}`
                                  : '削除に失敗しました',
                              );
                            } finally {
                              setDeletingName(null);
                            }
                          }
                        : undefined
                    }
                    disabled={deletingName === s.name}
                  />
                }
              />
            ))}
          </ul>
        )}
        {deleteError && (
          <div className="mt-[8px] rounded-[6px] border border-warn/30 bg-warn-soft px-[10px] py-[6px] text-[11px] text-warn">
            {deleteError}
          </div>
        )}
      </section>

      {showAddModal && onAddCustomSkill && (
        <SkillAddModal
          onClose={() => setShowAddModal(false)}
          onSubmit={async (input) => {
            await onAddCustomSkill(input);
            setShowAddModal(false);
          }}
        />
      )}

      {editingSkill && onEditCustomSkill && (
        <SkillAddModal
          initialSkill={{
            name: editingSkill.name,
            description: '', // 編集時は description を再入力 (skillMd 内 frontmatter が正)
            skillMd: '', // 現状 Plugin 側は skillMd 本文を保持していないため、admin が貼り直す想定
          }}
          onClose={() => setEditingSkill(null)}
          onSubmit={async (input) => {
            await onEditCustomSkill(input);
            setEditingSkill(null);
          }}
        />
      )}
    </div>
  );
}

function SkillRow({
  skill,
  showStatus = true,
  actions,
}: {
  skill: BundledSkillEntry;
  /** false にすると StatusDot と「同期済/未同期」バッジを非表示にする (カスタム skill 一覧用) */
  showStatus?: boolean;
  /** カスタム skill 用の編集 / 削除ボタン (任意、右端に配置) */
  actions?: JSX.Element;
}): JSX.Element {
  return (
    <li
      data-testid={`skill-row-${skill.name}`}
      data-status={skill.status}
      className="flex items-center gap-[10px] rounded-[8px] border border-border bg-card px-[12px] py-[8px]"
    >
      {showStatus && <StatusDot status={skill.status} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-text">{skill.displayTitle}</div>
        <div className="mt-[1px] flex items-center gap-[6px] font-mono text-[10px] text-subtle">
          <span>{skill.name}</span>
          {skill.version && <span className="opacity-60">v{skill.version}</span>}
        </div>
      </div>
      {showStatus && (
        <span
          className={[
            'shrink-0 rounded-[3px] px-[5px] py-[1px] text-[9.5px] font-semibold',
            skill.status === 'synced'
              ? 'bg-ok-soft text-ok'
              : skill.status === 'updated'
                ? 'bg-warn-soft text-warn'
                : 'bg-card-hi text-muted',
          ].join(' ')}
        >
          {skill.status === 'synced' ? '同期済' : skill.status === 'updated' ? '更新あり' : '未同期'}
        </span>
      )}
      {actions}
    </li>
  );
}

function CustomSkillActions({
  skill,
  onEdit,
  onDelete,
  disabled,
}: {
  skill: BundledSkillEntry;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void | Promise<void>) | undefined;
  disabled?: boolean | undefined;
}): JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-[4px]">
      {onEdit && (
        <button
          type="button"
          data-testid={`skill-edit-${skill.name}`}
          onClick={onEdit}
          disabled={disabled}
          title="編集 (新バージョン作成)"
          className="rounded-[6px] border border-border bg-transparent px-[8px] py-[3px] text-[10.5px] font-medium text-text hover:bg-card-hi disabled:cursor-not-allowed disabled:opacity-50"
        >
          編集
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          data-testid={`skill-delete-${skill.name}`}
          onClick={() => void onDelete()}
          disabled={disabled}
          title="削除"
          className="rounded-[6px] border border-warn/40 bg-transparent px-[8px] py-[3px] text-[10.5px] font-medium text-warn hover:bg-warn-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? '削除中…' : '削除'}
        </button>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: BundledSkillEntry['status'] }): JSX.Element {
  const color =
    status === 'synced' ? 'var(--cw-ok)' : status === 'updated' ? 'var(--cw-warn)' : 'var(--cw-muted)';
  return (
    <span
      className="h-[8px] w-[8px] shrink-0 rounded-full"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

function SyncIcon({ spinning }: { spinning: boolean }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
      aria-hidden="true"
    >
      <path d="M2 7a5 5 0 019-3M12 7a5 5 0 01-9 3" />
      <path d="M11 2v3h-3M3 12v-3h3" />
    </svg>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}
