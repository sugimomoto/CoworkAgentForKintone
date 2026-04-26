// 通知バナー (ChatPanel ヘッダ直下に並ぶ補助情報行)
//
// 用途: API 認証エラー / OAuth 失効 / Session terminated など、
// チャットを止めずに「上部で軽く案内 + 1 アクション」を提供したい場面。

import type { ReactNode } from 'react';

export type BannerTone = 'warn' | 'info';

export interface BannerProps {
  tone?: BannerTone;
  /** バナー本文。文字列・要素いずれも可 */
  children: ReactNode;
  /** 任意のアクションボタン (1 個まで) */
  actionLabel?: string;
  onAction?: () => void;
  /** data-banner 属性 (テスト / E2E アサート用) */
  testId?: string;
}

const TONE_CLASS: Record<BannerTone, string> = {
  warn: 'border-b border-border bg-warn-soft px-[14px] py-[10px] text-[12px] text-warn',
  info: 'border-b border-border bg-amber-50 px-[14px] py-[8px] text-[12px] text-amber-900',
};

const BUTTON_CLASS: Record<BannerTone, string> = {
  warn: 'mt-[6px] rounded border border-warn px-[10px] py-[3px] text-[11px] text-warn hover:bg-warn/10',
  info: 'ml-[8px] rounded border border-amber-700 px-[8px] py-[2px] text-[11px] text-amber-800 hover:bg-amber-100',
};

export function Banner({
  tone = 'info',
  children,
  actionLabel,
  onAction,
  testId,
}: BannerProps): JSX.Element {
  return (
    <div className={TONE_CLASS[tone]} {...(testId ? { 'data-banner': testId } : {})}>
      {tone === 'warn' ? <div>{children}</div> : <>{children}</>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className={BUTTON_CLASS[tone]}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
