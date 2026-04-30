// Cowork Agent for kintone — ユーザー発話バブル
//
// デザイン仕様: docs/functional-design.md §5.6.2
//                docs/design_handoff_attachments/README.md §E (attachments ラベル)

import { KIND_ICON } from '../attachmentAssets';

import type { AttachmentKind } from '../../../core/files/types';

export interface UserMessageAttachmentLabel {
  filename: string;
  kind: AttachmentKind;
}

export interface UserMessageProps {
  text: string;
  /** 送信時に添付したファイル一覧。バブルの上に小さなラベル列として表示する */
  attachments?: UserMessageAttachmentLabel[];
}

export function UserMessage({ text, attachments }: UserMessageProps): JSX.Element {
  const hasAttachments = attachments && attachments.length > 0;

  return (
    <div className="msg-in flex flex-col items-end">
      {hasAttachments && (
        <div className="mb-[5px] flex flex-wrap justify-end gap-[4px]">
          {attachments.map((a, i) => (
            <span
              key={`${a.filename}-${i}`}
              className="inline-flex max-w-[220px] min-w-0 items-center gap-[5px] rounded-md border border-card-border bg-card py-[3px] pl-[6px] pr-[8px] text-[10.5px] text-muted"
            >
              <span className="flex flex-shrink-0 text-accent" style={{ width: 11 }}>
                {KIND_ICON[a.kind]}
              </span>
              <span className="truncate font-medium text-text">{a.filename}</span>
            </span>
          ))}
        </div>
      )}
      <div className="max-w-[85%] whitespace-pre-wrap rounded-bubble border border-user-border bg-user px-[14px] py-[10px] text-[13px] leading-[1.5] text-text">
        {text}
      </div>
    </div>
  );
}
