// Cowork Agent for kintone — 添付チップ (Composer の上に並ぶ)
//
// 仕様: docs/design_handoff_attachments/README.md §C
// 3 状態 (ready / reading / error) を file.status から判別。
// アイコン SVG は reference/attachments.jsx から移植。

import { formatAttachmentSize, kindLabel, KIND_ICON } from './attachmentAssets';

import type { AttachedFile } from '../../core/files/types';

export interface AttachmentChipProps {
  file: AttachedFile;
  onRemove: () => void;
}

export function AttachmentChip({ file, onRemove }: AttachmentChipProps): JSX.Element {
  const isReading = file.status === 'reading';
  const isError = file.status === 'error';

  // 状態別のスタイル (ハンドオフ §C-1〜C-3)
  const containerCls = isError
    ? 'border-warn/55 bg-warn-soft text-warn'
    : isReading
      ? 'border-card-border bg-card-hi'
      : 'border-card-border bg-card';

  const iconTileCls = isError
    ? 'bg-[#fff6e8] text-warn'
    : 'bg-accent-soft text-accent';

  const sublineCls = isError ? 'text-warn/80' : 'text-muted';
  const filenameCls = isError ? 'text-warn' : 'text-text';

  const subline = isReading
    ? '読込中…'
    : isError
      ? file.errorText ?? 'エラー'
      : `${kindLabel(file.kind)} · ${formatAttachmentSize(file.size)}`;

  return (
    <div
      data-attachment-chip
      data-status={file.status}
      title={isError ? file.errorText : `${file.filename} (${formatAttachmentSize(file.size)})`}
      className={`inline-flex max-w-[220px] min-w-0 flex-shrink-0 items-center gap-[7px] rounded-lg border px-[6px] py-[6px] pl-[9px] ${containerCls}`}
    >
      {/* icon tile (18×18, border-radius 5px) */}
      <span
        className={`relative flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] ${iconTileCls}`}
      >
        {isReading ? (
          <span
            data-attach-spinner
            className="msg-attach-spinner h-[11px] w-[11px] rounded-full border-[1.5px] border-card-border"
            style={{ borderTopColor: 'var(--cw-accent)' }}
          />
        ) : isError ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 1l5 9.5H1L6 1z" />
            <path d="M6 4.5v2.2M6 8.5v.01" />
          </svg>
        ) : (
          KIND_ICON[file.kind]
        )}
      </span>

      {/* filename + subline */}
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span
          className={`truncate text-[11.5px] font-medium ${filenameCls}`}
        >
          {file.filename}
        </span>
        <span
          className={`truncate text-[9.5px] tabular-nums ${sublineCls}`}
        >
          {subline}
        </span>
      </div>

      {/* close button (reading 中は非表示) */}
      {!isReading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="削除"
          className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded p-0 ${sublineCls} bg-transparent`}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
          </svg>
        </button>
      )}
    </div>
  );
}
