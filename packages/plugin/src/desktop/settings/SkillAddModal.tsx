// Cowork Agent for kintone — カスタム skill 追加モーダル (V1 P3.2)
//
// 2 タブ:
//   - 📤 ファイル: SKILL.md / .md ドロップゾーン (max 8 MB) + frontmatter 自動抽出
//   - 📝 直接入力: name / description / SKILL.md textarea
//
// ZIP は V2 以降に延期 (frontmatter パース + bundler 設計が必要)。
//
// 仕様: requirements.md §15.4 / design.md §4.6

import { useRef, useState } from 'react';

export type SkillAddMode = 'file' | 'text';

/** カスタム skill 投入時の引数 */
export interface CustomSkillInput {
  /** SKILL.md frontmatter の name (識別子) */
  name: string;
  /** description (1 行説明) */
  description: string;
  /** SKILL.md 本文 (frontmatter 含む) */
  skillMd: string;
}

export interface SkillAddModalProps {
  /** モーダルを閉じる */
  onClose: () => void;
  /** 追加実行ハンドラ。resolve 後にモーダルが閉じられる */
  onSubmit: (input: CustomSkillInput) => Promise<void>;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPT_EXT = ['md'];

export function SkillAddModal({ onClose, onSubmit }: SkillAddModalProps): JSX.Element {
  const [mode, setMode] = useState<SkillAddMode>('file');
  const [parsed, setParsed] = useState<CustomSkillInput | null>(null);
  const [textName, setTextName] = useState('');
  const [textDescription, setTextDescription] = useState('');
  const [textBody, setTextBody] = useState('');
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
            <div className="text-[14px] font-semibold text-text">カスタムスキルを追加</div>
            <div className="text-[10.5px] text-muted">SKILL.md (frontmatter 必須) を Anthropic Workspace にアップロードします</div>
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

        {/* Mode tabs */}
        <div className="flex shrink-0 gap-[2px] border-b border-border px-[18px] pt-[10px]">
          <TabPill active={mode === 'file'} onClick={() => setMode('file')} testId="tab-file">
            📤 ファイル
          </TabPill>
          <TabPill active={mode === 'text'} onClick={() => setMode('text')} testId="tab-text">
            📝 直接入力
          </TabPill>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-[18px] py-[14px]">
          {mode === 'file' ? (
            <FileTab
              parsed={parsed}
              setParsed={setParsed}
              fileError={fileError}
              setFileError={setFileError}
            />
          ) : (
            <TextTab
              name={textName}
              setName={setTextName}
              description={textDescription}
              setDescription={setTextDescription}
              body={textBody}
              setBody={setTextBody}
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
              'name / 本文を入力してください'
            ) : (
              <span>準備完了。アップロードを押すと Anthropic に同期されます。</span>
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
            {submitting ? 'アップロード中…' : 'アップロード'}
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
        active ? 'border-b-2 border-accent text-text' : 'border-b-2 border-transparent text-muted hover:text-text',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ─── File tab ─────────────────────────────────────────────────────────────

interface FileTabProps {
  parsed: CustomSkillInput | null;
  setParsed: (p: CustomSkillInput | null) => void;
  fileError: string | null;
  setFileError: (e: string | null) => void;
}

function FileTab({ parsed, setParsed, fileError, setFileError }: FileTabProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`ファイルサイズが上限 (${MAX_FILE_BYTES / 1024 / 1024} MB) を超えています`);
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPT_EXT.includes(ext)) {
      setFileError(`サポートされていない拡張子です: .${ext} (受付: ${ACCEPT_EXT.map((e) => '.' + e).join(' / ')})`);
      return;
    }
    try {
      const text = await file.text();
      const meta = parseFrontmatter(text);
      if (!meta.name) {
        setFileError('SKILL.md の frontmatter に name が見つかりません');
        return;
      }
      setParsed({
        name: meta.name,
        description: meta.description ?? '',
        skillMd: text,
      });
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
    return (
      <div data-testid="file-uploaded">
        <div className="mb-[10px] rounded-[8px] border border-border bg-card-hi p-[12px]">
          <div className="flex items-center gap-[10px]">
            <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[6px] bg-accent-soft text-accent font-mono text-[10px] font-bold">
              MD
            </div>
            <div className="flex-1">
              <div className="font-mono text-[12px] font-semibold text-text">{parsed.name}.md</div>
              <div className="text-[10.5px] text-muted">{(parsed.skillMd.length / 1024).toFixed(1)} KB · frontmatter OK</div>
            </div>
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="text-[11px] text-muted hover:text-text"
            >
              差し替え
            </button>
          </div>
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
        <div className="text-[12px] text-text">SKILL.md / .md をドロップ</div>
        <div className="text-[10.5px] text-muted">または下のボタンから選択 (最大 8 MB)</div>
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
          accept=".md,.markdown"
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

// ─── Text tab ─────────────────────────────────────────────────────────────

interface TextTabProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
}

function TextTab({
  name,
  setName,
  description,
  setDescription,
  body,
  setBody,
}: TextTabProps): JSX.Element {
  return (
    <div data-testid="text-tab" className="grid grid-cols-1 gap-[10px]">
      <FormField label="name (識別子)">
        <input
          type="text"
          data-testid="text-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="kintone-my-skill"
          className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] font-mono text-[12px] text-text"
        />
      </FormField>
      <FormField label="description (1 行説明)">
        <input
          type="text"
          data-testid="text-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 顧客アプリのレコード集計に特化したスキル"
          className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] text-[12px] text-text"
        />
      </FormField>
      <FormField label="SKILL.md 本文 (frontmatter 含む)">
        <textarea
          data-testid="text-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder={'---\nname: kintone-my-skill\ndescription: ...\n---\n\n# Skill 本文'}
          className="w-full rounded-[6px] border border-border bg-card px-[10px] py-[6px] font-mono text-[11px] text-text"
        />
      </FormField>
    </div>
  );
}

// ─── shared helpers ───────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

function FormField({ label, children }: FormFieldProps): JSX.Element {
  return (
    <label className="flex flex-col gap-[4px]">
      <span className="text-[10.5px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * 簡易 YAML frontmatter パーサ (js-yaml 依存なし)。
 * `---` ... `---` ブロックから name / description を抽出する。
 * 値はクォート (` " ` または ` ' `) があれば剥がす。
 */
export function parseFrontmatter(text: string): { name?: string; description?: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const body = match[1] ?? '';
  const result: { name?: string; description?: string } = {};
  for (const line of body.split(/\r?\n/)) {
    const m = /^(\w+):\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let value = m[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === 'name') result.name = value;
    if (key === 'description') result.description = value;
  }
  return result;
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
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
