// 表示トグル付きパスワード入力。ConfigScreen の secret 系フィールドで重複していた
// 「password input + 右端の 表示/隠す ボタン」を集約 (Phase 4 PR-AB)。
// show 状態はコンポーネント内に閉じる。

import { useState } from 'react';

export interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
}

export function PasswordInput({ value, onChange, id, placeholder }: PasswordInputProps): JSX.Element {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...(id ? { id } : {})}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...(placeholder !== undefined ? { placeholder } : {})}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-[8px] border border-card-border bg-bg px-[12px] py-[8px] pr-[64px] font-mono text-[12px] text-text outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] px-[6px] py-[2px] text-[10px] text-muted hover:text-accent"
      >
        {show ? '隠す' : '表示'}
      </button>
    </div>
  );
}
