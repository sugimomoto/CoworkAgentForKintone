// カスタム skill 追加モーダルの「ファイル」タブ。
// ドロップ / 選択した File を parseSkillFile で解析し、結果を編集できる。

import { useRef } from 'react';

import { FormField } from '../../components/ui/FormField';

import { parseSkillFile } from './parseSkillFile';

import type { CustomSkillInput } from '../../../core/skills/types';

export interface SkillFileTabProps {
  parsed: CustomSkillInput | null;
  setParsed: (p: CustomSkillInput | null) => void;
  fileError: string | null;
  setFileError: (e: string | null) => void;
}

export function SkillFileTab({
  parsed,
  setParsed,
  fileError,
  setFileError,
}: SkillFileTabProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    setFileError(null);
    try {
      setParsed(await parseSkillFile(file));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'ファイル読み込みに失敗しました');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  if (parsed) {
    const isBundle = Array.isArray(parsed.files) && parsed.files.length > 1;
    const totalBytes = parsed.files
      ? parsed.files.reduce((sum, f) => sum + f.content.length, 0)
      : parsed.skillMd.length;
    return (
      <div data-testid="file-uploaded">
        <div className="mb-[10px] rounded-[8px] border border-border bg-card-hi p-[12px]">
          <div className="flex items-center gap-[10px]">
            <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[6px] bg-accent-soft text-accent font-mono text-[10px] font-bold">
              {isBundle ? 'ZIP' : 'MD'}
            </div>
            <div className="flex-1">
              <div className="font-mono text-[12px] font-semibold text-text">
                {parsed.name}
                {isBundle ? '/' : '.md'}
              </div>
              <div className="text-[10.5px] text-muted">
                {(totalBytes / 1024).toFixed(1)} KB ·{' '}
                {isBundle ? `${parsed.files!.length} ファイル · frontmatter OK` : 'frontmatter OK'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="text-[11px] text-muted hover:text-text"
            >
              差し替え
            </button>
          </div>
          {isBundle && (
            <ul
              data-testid="bundle-file-list"
              className="mt-[8px] border-t border-border pt-[8px] font-mono text-[10.5px] text-muted"
            >
              {parsed.files!.slice(0, 12).map((f) => (
                <li key={f.path} className="truncate">
                  {f.path}{' '}
                  <span className="text-muted/70">({(f.content.length / 1024).toFixed(1)} KB)</span>
                </li>
              ))}
              {parsed.files!.length > 12 && (
                <li className="text-muted/70">… 他 {parsed.files!.length - 12} ファイル</li>
              )}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-1 gap-[8px]">
          <FormField label="name (識別子)">
            <input
              type="text"
              data-testid="file-edit-name"
              value={parsed.name}
              onChange={(e) => setParsed({ ...parsed, name: e.target.value })}
              className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] font-mono text-[12px] text-text"
            />
          </FormField>
          <FormField label="description (1 行説明)">
            <input
              type="text"
              data-testid="file-edit-description"
              value={parsed.description}
              onChange={(e) => setParsed({ ...parsed, description: e.target.value })}
              className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] text-[12px] text-text"
            />
          </FormField>
          <FormField label="SKILL.md (プレビュー、読み取り専用)">
            <textarea
              readOnly
              value={parsed.skillMd}
              rows={6}
              className="w-full rounded-[6px] border border-border bg-card-hi px-[10px] py-[6px] font-mono text-[10.5px] text-text"
            />
          </FormField>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="file-dropzone">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center gap-[10px] rounded-[10px] border-2 border-dashed border-border bg-card-hi px-[20px] py-[28px] text-center"
      >
        <UploadIcon />
        <div className="text-[12px] text-text">SKILL.md / .md / .zip / .skill をドロップ</div>
        <div className="text-[10.5px] text-muted">
          .zip / .skill は中の SKILL.md と references/ scripts/ を保持してアップロード (最大 8 MB)
        </div>
        <button
          type="button"
          data-testid="file-select-btn"
          onClick={() => inputRef.current?.click()}
          className="mt-[4px] rounded-[7px] border border-border bg-card px-[14px] py-[6px] text-[11.5px] font-medium text-text hover:bg-card-hi"
        >
          ファイルを選択
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.markdown,.zip,.skill"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {fileError && (
        <div className="mt-[10px] rounded-[6px] border border-warn/30 bg-warn-soft px-[10px] py-[6px] text-[11px] text-warn">
          {fileError}
        </div>
      )}
    </div>
  );
}

function UploadIcon(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
      <path d="M12 4v12M7 9l5-5 5 5" />
      <path d="M5 18v2h14v-2" />
    </svg>
  );
}
