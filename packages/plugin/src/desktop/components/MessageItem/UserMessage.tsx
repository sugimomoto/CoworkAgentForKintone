// Cowork Agent for kintone — ユーザー発話バブル
//
// デザイン仕様: docs/functional-design.md §5.6.2

export interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps): JSX.Element {
  return (
    <div className="msg-in flex justify-end">
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-bubble border border-user-border bg-user px-[14px] py-[10px] text-[13px] leading-[1.5] text-text"
      >
        {text}
      </div>
    </div>
  );
}
