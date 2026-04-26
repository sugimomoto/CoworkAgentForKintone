// 「kintone と連携」ボタン。useUserBinding の status を可視化する。
//
// status:
//   unknown / checking → 描画なし (バックグラウンド判定中、UI に出さない)
//   unbound            → 「kintone と連携」ボタン
//   binding            → スピナー + 「認可中…」、ボタン disabled
//   error              → エラーメッセージ + 「再試行」ボタン
//   bound              → 描画なし

import type { BindingStatus } from '../../store/chatStore';

export interface ConnectKintoneButtonProps {
  status: BindingStatus;
  error?: string | null;
  onConnect: () => void;
}

export function ConnectKintoneButton({
  status,
  error,
  onConnect,
}: ConnectKintoneButtonProps): JSX.Element | null {
  if (status === 'unknown' || status === 'checking' || status === 'bound') return null;

  if (status === 'error') {
    return (
      <div
        data-testid="connect-kintone-error"
        className="border-t border-border bg-warn-soft px-[14px] py-[12px]"
      >
        <p className="text-[12px] text-warn">⚠ {error ?? 'kintone との連携に失敗しました'}</p>
        <button
          type="button"
          onClick={onConnect}
          className="mt-[8px] rounded-[8px] bg-accent px-[14px] py-[6px] text-[12px] font-medium text-white shadow-[0_2px_8px_rgba(13,148,136,0.33)]"
        >
          再試行
        </button>
      </div>
    );
  }

  const isBinding = status === 'binding';

  return (
    <div
      data-testid="connect-kintone"
      className="flex flex-col items-stretch gap-[8px] border-t border-border bg-card px-[14px] py-[14px]"
    >
      <p className="text-[12px] text-muted">
        kintone と連携することで、kintone のアプリ・レコード情報を会話の中で扱えるようになります。
      </p>
      <button
        type="button"
        onClick={onConnect}
        disabled={isBinding}
        data-testid="connect-kintone-button"
        className="flex items-center justify-center gap-[6px] rounded-[8px] bg-accent px-[14px] py-[8px] text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(13,148,136,0.33)] disabled:opacity-50"
      >
        {isBinding ? (
          <>
            <Spinner /> 認可中…
          </>
        ) : (
          'kintone と連携'
        )}
      </button>
    </div>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className="animate-spin"
    >
      <path d="M12 2 a 10 10 0 0 1 0 20" />
    </svg>
  );
}
