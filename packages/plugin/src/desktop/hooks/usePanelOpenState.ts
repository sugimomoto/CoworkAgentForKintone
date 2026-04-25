// Cowork Agent for kintone — チャットパネル開閉状態を localStorage に永続化
//
// 認証情報や会話データではない単なる UI 状態なので、localStorage 保存は許容 (§3.2 / §5.7.4)

import { useCallback, useState } from 'react';

export const PANEL_OPEN_STORAGE_KEY = 'cowork-agent:isOpen' as const;

function readInitial(): boolean {
  try {
    const raw = localStorage.getItem(PANEL_OPEN_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // localStorage が使えない環境では既定値 true
  }
  return true;
}

export function usePanelOpenState(): [boolean, (next: boolean) => void] {
  const [isOpen, setIsOpenInternal] = useState<boolean>(readInitial);

  const setIsOpen = useCallback((next: boolean) => {
    setIsOpenInternal(next);
    try {
      localStorage.setItem(PANEL_OPEN_STORAGE_KEY, String(next));
    } catch {
      // localStorage が使えない場合は state だけ更新
    }
  }, []);

  return [isOpen, setIsOpen];
}
