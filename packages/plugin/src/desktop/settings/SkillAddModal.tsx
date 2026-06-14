// Cowork Agent for kintone — カスタム skill 追加モーダル (V1 P3.2 / V2 #30)
//
// 2 タブ:
//   - 📤 ファイル: SKILL.md / .md / .zip / .skill ドロップゾーン (max 8 MB) + frontmatter 自動抽出
//   - 📝 直接入力: name / description / SKILL.md textarea
//
// ファイル解析は skill-add/parseSkillFile、各タブ UI は skill-add/SkillFileTab /
// SkillTextTab に分割 (Phase 3 PR-D)。
//
// 仕様: requirements.md §15.4 / design.md §4.6

import { useState } from 'react';

import { SkillFileTab } from './skill-add/SkillFileTab';
import { SkillTextTab } from './skill-add/SkillTextTab';

import type { CustomSkillInput } from '../../core/skills/types';

export type SkillAddMode = 'file' | 'text';

// skill 投入の入力型は core/skills/types.ts に集約。解析の純関数は parseSkillFile に。
// 既存の import を壊さないため再エクスポートを残す。
export type { SkillFileEntry, CustomSkillInput } from '../../core/skills/types';
export { parseFrontmatter, extractSkillBundle } from './skill-add/parseSkillFile';

export interface SkillAddModalProps {
  /** モーダルを閉じる */
  onClose: () => void;
  /** 追加実行ハンドラ。resolve 後にモーダルが閉じられる */
  onSubmit: (input: CustomSkillInput) => Promise<void>;
  /**
   * 編集モード (V2 #30)。指定時:
   *   - タイトルが「カスタム skill を編集」に
   *   - name は read-only (display_title 一致で skill version up するため)
   *   - 初期表示モードは 'text' (本文編集のみ想定)
   *   - フォームに初期値が入る
   * 省略時は新規追加モード (V1 既存挙動)。
   */
  initialSkill?: CustomSkillInput;
}

export function SkillAddModal({ onClose, onSubmit, initialSkill }: SkillAddModalProps): JSX.Element {
  const isEdit = initialSkill !== undefined;
  const [mode, setMode] = useState<SkillAddMode>(isEdit ? 'text' : 'file');
  const [parsed, setParsed] = useState<CustomSkillInput | null>(initialSkill ?? null);
  const [textName, setTextName] = useState(initialSkill?.name ?? '');
  const [textDescription, setTextDescription] = useState(initialSkill?.description ?? '');
  const [textBody, setTextBody] = useState(initialSkill?.skillMd ?? '');
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    (mode === 'file'
      ? parsed !== null && parsed.name.length > 0
      : textName.trim().length > 0 && textBody.trim().length > 0);

  const buildInput = (): CustomSkillInput | null => {
    if (mode === 'file') return parsed;
    return {
      name: textName.trim(),
      description: textDescription.trim(),
      skillMd: textBody,
    };
  };

  const handleSubmit = async (): Promise<void> => {
    const input = buildInput();
    if (!input || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="skill-add-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-[20px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-[480px] max-w-full flex-col rounded-[12px] border border-border bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-[10px] border-b border-border px-[18px] py-[14px]">
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text">
              {isEdit ? 'カスタムスキルを編集' : 'カスタムスキルを追加'}
            </div>
            <div className="text-[10.5px] text-muted">
              {isEdit
                ? '本文を編集して保存すると Anthropic Workspace に **新バージョン** が作成されます。name は変更できません'
                : 'SKILL.md (frontmatter 必須) を Anthropic Workspace にアップロードします'}
            </div>
          </div>
          <button
            type="button"
            data-testid="skill-add-close"
            aria-label="閉じる"
            onClick={onClose}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-muted hover:bg-card-hi"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Mode tabs (新規追加時のみ。編集時はテキスト編集に限定) */}
        {!isEdit && (
          <div className="flex shrink-0 gap-[2px] border-b border-border px-[18px] pt-[10px]">
            <TabPill active={mode === 'file'} onClick={() => setMode('file')} testId="tab-file">
              📤 ファイル
            </TabPill>
            <TabPill active={mode === 'text'} onClick={() => setMode('text')} testId="tab-text">
              📝 直接入力
            </TabPill>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[18px] py-[14px]">
          {mode === 'file' && !isEdit ? (
            <SkillFileTab
              parsed={parsed}
              setParsed={setParsed}
              fileError={fileError}
              setFileError={setFileError}
            />
          ) : (
            <SkillTextTab
              name={textName}
              setName={setTextName}
              description={textDescription}
              setDescription={setTextDescription}
              body={textBody}
              setBody={setTextBody}
              nameReadOnly={isEdit}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-[10px] border-t border-border px-[18px] py-[12px]">
          <div className="flex-1 text-[11px] text-muted">
            {submitError ? (
              <span className="text-warn">{submitError}</span>
            ) : !canSubmit && mode === 'file' && parsed === null ? (
              'ファイルを選択してください'
            ) : !canSubmit && mode === 'text' ? (
              isEdit ? '本文を入力してください' : 'name / 本文を入力してください'
            ) : (
              <span>
                {isEdit
                  ? '準備完了。保存すると新バージョンが Anthropic に作成されます。'
                  : '準備完了。アップロードを押すと Anthropic に同期されます。'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[7px] border border-border px-[12px] py-[6px] text-[12px] text-text hover:bg-card-hi"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-testid="skill-add-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'rounded-[7px] px-[14px] py-[6px] text-[12px] font-semibold',
              canSubmit
                ? 'cursor-pointer bg-accent text-white hover:opacity-90'
                : 'cursor-not-allowed bg-card-hi text-muted opacity-60',
            ].join(' ')}
          >
            {submitting
              ? isEdit
                ? '保存中…'
                : 'アップロード中…'
              : isEdit
                ? '保存 (新バージョン)'
                : 'アップロード'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mode tabs ────────────────────────────────────────────────────────────

interface TabPillProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
}

function TabPill({ active, children, onClick, testId }: TabPillProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-selected={active}
      onClick={onClick}
      className={[
        'rounded-t-[8px] px-[14px] py-[7px] text-[12px] font-medium',
        active
          ? 'border-b-2 border-accent text-text'
          : 'border-b-2 border-transparent text-muted hover:text-text',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}
