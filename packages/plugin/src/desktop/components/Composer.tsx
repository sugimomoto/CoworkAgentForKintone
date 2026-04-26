// Cowork Agent for kintone — Composer (チャット入力部)
//
// デザイン仕様: docs/functional-design.md §5.3.3

import { useState, useRef, type KeyboardEvent, type FormEvent } from 'react';

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
}

const DEFAULT_PLACEHOLDER = 'このアプリについて聞く / レコードを操作...';

export function Composer({
  onSubmit,
  disabled = false,
  placeholder = DEFAULT_PLACEHOLDER,
  running = false,
  onCancel,
}: ComposerProps): JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  return (
    <form
      onSubmit={handleFormSubmit}
      className="border-t border-border bg-panel px-[14px] pt-[10px] pb-[14px] backdrop-blur-[12px]"
    >
      <div className="flex items-end gap-[6px] rounded-[14px] border border-card-border bg-card p-[8px] pl-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_var(--cw-accent-soft)_inset]">
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
          placeholder={placeholder}
          disabled={disabled || running}
          aria-label="メッセージ入力"
          className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] text-text outline-none placeholder:text-subtle disabled:opacity-50"
        />
        {running ? (
          <button
            type="button"
            aria-label="キャンセル"
            onClick={onCancel}
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-red-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.33)] hover:bg-red-600"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            aria-label="送信"
            disabled={disabled || !value.trim()}
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-accent text-white shadow-[0_2px_8px_rgba(13,148,136,0.33)] disabled:opacity-50"
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
      <div className="mt-[6px] px-[4px] text-[10px] text-subtle">
        ⌘K 呼び出し · Claude Managed Agents
      </div>
    </form>
  );
}
