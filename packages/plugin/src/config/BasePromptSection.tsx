// Cowork Agent for kintone — 共通 base システムプロンプト編集セクション (#141)
//
// Plugin Config (admin 専用) の「高度な設定」に差し込むアコーディオン。全エージェント共通の
// base を編集/リセットする。保存は ConfigScreen 全体の「保存」に集約 (このセクションは下書きのみ)。
// 出所: docs/design-handoff/base-prompt-config/BasePromptSection.tsx。

import { useState } from 'react';

import { DEFAULT_MAX_LENGTH, charCount, isOverLimit, isUsingDefault } from './basePrompt';

export interface BasePromptSectionProps {
  /** 現在の override (未設定 = 空文字。空なら既定を使用)。 */
  value: string;
  onChange: (v: string) => void;
  /** コードの既定 base (「既定を読み込む」やプレースホルダ表示に使う)。 */
  defaultBase: string;
  /** override をクリアして既定へ戻す (確認後)。 */
  onResetToDefault: () => void;
  maxLength?: number;
  defaultOpen?: boolean;
}

export function BasePromptSection({
  value,
  onChange,
  defaultBase,
  onResetToDefault,
  maxLength = DEFAULT_MAX_LENGTH,
  defaultOpen = false,
}: BasePromptSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);

  const usingDefault = isUsingDefault(value);
  const count = charCount(value);
  const over = isOverLimit(value, maxLength);

  return (
    <section className="relative mb-[20px] rounded-[12px] border border-card-border bg-card">
      {/* ── アコーディオン ヘッダ ── */}
      <button
        type="button"
        data-testid="base-prompt-header"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[10px] p-[14px_16px] text-left"
      >
        <ChevronIcon className={`flex-none text-subtle transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex-none text-accent">
          <SparkleIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-text">共通システムプロンプト</span>
            <span className="rounded-[4px] border border-border bg-card-hi px-1.5 py-px text-[9.5px] font-semibold text-muted">
              上級者向け
            </span>
          </div>
          {!open && (
            <div className="mt-0.5 text-[11px] text-muted">
              全エージェント共通の作法（base）。既定を上書きできます。
            </div>
          )}
        </div>
        <StatusChip usingDefault={usingDefault} />
      </button>

      {open && (
        <div className="border-t border-border p-[16px] pt-[14px]">
          <p className="mb-3 text-[11.5px] leading-[1.6] text-muted">
            全エージェントに共通で効く基本作法です。各エージェント固有の指示（persona）は含みません。
            <strong className="font-semibold text-text">変更は次の新規会話から反映されます。</strong>
          </p>

          {over && (
            <div
              data-testid="base-prompt-over"
              className="mb-3 rounded-[8px] border border-warn bg-warn-soft px-3 py-2 text-[11.5px] leading-[1.5] text-warn"
            >
              文字数が上限（{maxLength.toLocaleString()} 字）を超えています。保存するには{' '}
              {(count - maxLength).toLocaleString()} 字減らしてください。
            </div>
          )}

          <div className="mb-1.5 flex items-center gap-2">
            <label htmlFor="base-prompt-editor" className="text-[12px] font-semibold text-text">
              base システムプロンプト
            </label>
            <span className="flex-1" />
            <span
              className={`font-mono text-[10.5px] tabular-nums ${over ? 'font-semibold text-warn' : 'text-subtle'}`}
            >
              {count.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          </div>

          <textarea
            id="base-prompt-editor"
            data-testid="base-prompt-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder="未設定のため既定の作法を使用します。ここに入力すると、既定を上書きするカスタム base になります。"
            className={`box-border min-h-[200px] w-full resize-y rounded-[8px] border bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-[1.7] text-text outline-none ${
              over ? 'border-warn' : 'border-card-border focus:border-accent'
            }`}
          />

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {usingDefault ? (
              <button
                type="button"
                data-testid="base-prompt-load-default"
                onClick={() => onChange(defaultBase)}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-accent"
              >
                <ImportIcon /> 既定を読み込んで編集
              </button>
            ) : (
              <button
                type="button"
                data-testid="base-prompt-reset"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 rounded-[7px] border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-warn"
              >
                <RefreshIcon /> デフォルトに戻す
              </button>
            )}

            <span className="flex-1" />

            <span className="text-[10.5px] text-subtle">
              {usingDefault
                ? '空欄のまま保存すると既定の作法が使われます'
                : '変更は画面下の「保存」で確定します'}
            </span>
          </div>
        </div>
      )}

      {/* リセット確認 (config bundle 内で完結する簡易ダイアログ) */}
      {confirming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[12px] bg-black/30">
          <div className="w-[380px] rounded-[14px] border border-warn bg-bg p-[18px] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="mb-2 text-[13px] font-semibold text-text">共通プロンプトを既定に戻します</div>
            <div className="mb-4 text-[11.5px] leading-[1.6] text-muted">
              カスタム（override）を破棄し、コードの既定 base に戻します。<strong>全エージェント</strong>
              の共通作法に影響します（persona には影響しません）。変更は次の新規会話から反映されます。
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-[7px] border border-border px-3 py-1.5 text-[11.5px] text-text"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="base-prompt-reset-confirm"
                onClick={() => {
                  onResetToDefault();
                  setConfirming(false);
                }}
                className="rounded-[7px] bg-warn px-3 py-1.5 text-[11.5px] font-semibold text-white"
              >
                既定に戻す
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusChip({ usingDefault }: { usingDefault: boolean }): JSX.Element {
  if (!usingDefault) {
    return (
      <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10.5px] font-semibold text-accent">
        <span className="h-[6px] w-[6px] rounded-full bg-accent" />
        カスタム
      </span>
    );
  }
  return (
    <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-card-hi px-2.5 py-1 text-[10.5px] font-medium text-muted">
      <span className="h-[6px] w-[6px] rounded-full bg-subtle" />
      既定を使用中
    </span>
  );
}

// ── inline icons ──
function ChevronIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3l4 3-4 3" />
    </svg>
  );
}
function SparkleIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12l-1.4-3.6L3 7l3.6-1.4z" />
    </svg>
  );
}
function RefreshIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 8a5 5 0 11-1.5-3.5M13 2v3h-3" />
    </svg>
  );
}
function ImportIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v7M5 6l3 3 3-3M3 12h10" />
    </svg>
  );
}

export default BasePromptSection;
