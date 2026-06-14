// 汎用の確認ダイアログ。親要素の上に絶対配置される overlay (relative な親に inset)。
// AgentDetailModal の削除確認から切り出した (Phase 3)。Phase 4 の Modal 共通化の先行成果物。

export interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  /** 確定ボタンの文言。default '削除する' */
  confirmLabel?: string;
  /** submitting 中の確定ボタン文言。default '処理中…' */
  busyLabel?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  /** overlay ルートの data-testid */
  testId?: string;
  /** 確定ボタンの data-testid */
  confirmTestId?: string;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = '削除する',
  busyLabel = '処理中…',
  submitting = false,
  onCancel,
  onConfirm,
  testId,
  confirmTestId,
}: ConfirmDialogProps): JSX.Element {
  return (
    <div
      {...(testId ? { 'data-testid': testId } : {})}
      className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/30"
    >
      <div className="w-[360px] rounded-[10px] border border-border bg-bg p-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="mb-[10px] text-[13px] font-semibold text-text">{title}</div>
        <div className="mb-[14px] text-[11.5px] leading-[1.5] text-muted">{message}</div>
        <div className="flex justify-end gap-[8px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-[7px] border border-border px-[12px] py-[5px] text-[11.5px] text-text"
          >
            キャンセル
          </button>
          <button
            type="button"
            {...(confirmTestId ? { 'data-testid': confirmTestId } : {})}
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="rounded-[7px] bg-warn px-[12px] py-[5px] text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
