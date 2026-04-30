// Cowork Agent for kintone — Composer (チャット入力部)
//
// デザイン仕様: docs/functional-design.md §5.3.3
//                docs/design_handoff_attachments/README.md (添付対応)

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { ACCEPT_ATTRIBUTE } from '../../core/files/types';

import { AttachmentChipRow } from './AttachmentChipRow';
import { PAPERCLIP_ICON } from './attachmentAssets';

import type { AttachedFile } from '../../core/files/types';

export interface ComposerProps {
  /** ユーザーがメッセージを送信したときのハンドラ */
  onSubmit: (text: string) => void;
  /** true の場合、入力と送信を無効化 */
  disabled?: boolean;
  /** placeholder 文言。未指定なら既定 */
  placeholder?: string;
  /** Agent ターン進行中。true の場合、送信ボタンの位置にキャンセルボタンを出す */
  running?: boolean;
  /** キャンセルボタン押下 (running=true のみ有効) */
  onCancel?: () => void;
  /** 添付ファイル一覧 (chatStore 由来) */
  attachedFiles?: AttachedFile[];
  /** 📎 ボタンでファイルが選択された時 */
  onAttach?: (files: FileList) => void;
  /** チップ ✕ ボタン */
  onRemoveAttachment?: (localId: string) => void;
}

const DEFAULT_PLACEHOLDER = 'このアプリについて聞く / レコードを操作...';
const ATTACHED_PLACEHOLDER = '添付について聞く / 指示を入力...';

export function Composer({
  onSubmit,
  disabled = false,
  placeholder,
  running = false,
  onCancel,
  attachedFiles = [],
  onAttach,
  onRemoveAttachment,
}: ComposerProps): JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAttachments = attachedFiles.length > 0;
  const effectivePlaceholder =
    placeholder ?? (hasAttachments ? ATTACHED_PLACEHOLDER : DEFAULT_PLACEHOLDER);
  // reading 状態のチップがある間は送信できない (= まだ content が無い)
  const hasReading = attachedFiles.some((f) => f.status === 'reading');

  // 入力に応じて textarea を auto-grow する (1〜MAX_ROWS 行)。
  // scrollHeight ベースで height を都度書き換える。値が空に戻ったら 1 行へ縮める。
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const maxRows = 8;
    const maxHeight = lineHeight * maxRows;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);
  // IME 変換中フラグ。
  // macOS の日本語入力では Enter で「変換確定」を行うが、`keydown` のタイミングでは
  // `nativeEvent.isComposing` が一瞬 false に見えることがあり、誤送信を引き起こす。
  // onCompositionStart/End で明示的に保持し、確定 keydown も同フレームでガードする。
  const composingRef = useRef(false);

  function submit(): void {
    if (disabled || running) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.shiftKey) return;
    // Enter 検出: key === 'Enter' または keyCode === 13。両方見るのは jsdom など
    // テスト環境で keyCode が落ちる場合への保険。
    const isEnter = e.key === 'Enter' || e.keyCode === 13;
    if (!isEnter) return;
    // IME 変換中・確定 Enter のガード:
    // - macOS IME の確定 Enter は **keyCode === 229** で来る (ブラウザによっては
    //   `e.key === 'Enter'` のままなので key だけでは判別できない)。
    // - composingRef / isComposing は変換中フラグ。
    // 参考: https://etama.jp/1974/
    if (e.keyCode === 229) return;
    if (composingRef.current || e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  }

  function handleFormSubmit(e: FormEvent): void {
    e.preventDefault();
    submit();
  }

  function handleAttachClick(): void {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files;
    if (files && files.length > 0 && onAttach) {
      onAttach(files);
    }
    // 同じファイルを再選択できるよう値をリセット
    e.target.value = '';
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="border-t border-border bg-panel px-[14px] pt-[10px] pb-[14px] backdrop-blur-[12px]"
    >
      <div
        className={`flex flex-col rounded-[14px] border border-card-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_var(--cw-accent-soft)_inset] ${hasAttachments ? 'pb-[8px]' : ''}`}
      >
        {/* 添付チップ列 (添付ありの時だけ表示) */}
        {hasAttachments && (
          <AttachmentChipRow
            files={attachedFiles}
            onRemove={(id) => onRemoveAttachment?.(id)}
          />
        )}
        <div className="flex items-end gap-[6px] p-[8px] pl-[14px]">
          {/* 📎 ボタン */}
          {onAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTRIBUTE}
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={handleAttachClick}
                aria-label="ファイルを添付"
                disabled={disabled || running}
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg bg-transparent text-muted hover:bg-card-hi disabled:opacity-50"
              >
                {PAPERCLIP_ICON}
              </button>
            </>
          )}
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            // 確定直後 (= この compositionend と同じフレームで来る Enter keydown) も
            // 抑止するため、次のティックまで一瞬 true を維持する。
            setTimeout(() => {
              composingRef.current = false;
            }, 0);
          }}
          placeholder={effectivePlaceholder}
          disabled={disabled || running}
          aria-label="メッセージ入力"
          className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] text-text outline-none placeholder:text-subtle disabled:opacity-50"
        />
        {running ? (
          <button
            type="button"
            aria-label="キャンセル"
            onClick={onCancel}
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-red-500 text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-red-600"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            aria-label="送信"
            disabled={disabled || !value.trim() || hasReading}
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-accent text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] disabled:opacity-50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
        </div>
      </div>
      <div className="mt-[6px] px-[4px] text-[10px] text-subtle">
        ⌘K 呼び出し · Claude Managed Agents
      </div>
    </form>
  );
}
