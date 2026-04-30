// 添付チップ列 + footer (件数 / 合計サイズ / 警告)。
// 仕様: docs/design_handoff_attachments/README.md §D

import { FILE_LIMITS } from '../../core/files/types';

import { AttachmentChip } from './AttachmentChip';
import { formatAttachmentSize, WARN_ICON } from './attachmentAssets';

import type { AttachedFile } from '../../core/files/types';

export interface AttachmentChipRowProps {
  files: AttachedFile[];
  onRemove: (localId: string) => void;
}

export function AttachmentChipRow({ files, onRemove }: AttachmentChipRowProps): JSX.Element | null {
  if (files.length === 0) return null;

  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  const showWarn = totalBytes >= FILE_LIMITS.warnTotalBytes;

  return (
    <div className="flex flex-col gap-[6px] px-[10px] pt-[8px]">
      <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
        {files.map((f) => (
          <AttachmentChip key={f.localId} file={f} onRemove={() => onRemove(f.localId)} />
        ))}
      </div>
      <div
        className={`flex items-center gap-[6px] pl-[2px] text-[10px] ${showWarn ? 'text-warn' : 'text-subtle'}`}
      >
        <span>{files.length}件</span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums">{formatAttachmentSize(totalBytes)}</span>
        {showWarn && (
          <>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-[3px]">
              {WARN_ICON}
              合計サイズが大きめです
            </span>
          </>
        )}
      </div>
    </div>
  );
}
