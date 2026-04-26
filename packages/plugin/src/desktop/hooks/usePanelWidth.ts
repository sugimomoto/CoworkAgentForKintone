// パネル横幅 (px) を localStorage で永続化するフック。
//
// ドラッグハンドルから setWidth を呼び、reload 後も同じ幅で開く。

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cowork-agent.panel-width';
export const PANEL_WIDTH_DEFAULT = 380;
export const PANEL_WIDTH_MIN = 320;
export const PANEL_WIDTH_MAX = 800;

function readStored(): number {
  if (typeof window === 'undefined') return PANEL_WIDTH_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return PANEL_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return PANEL_WIDTH_DEFAULT;
    return clamp(n);
  } catch {
    return PANEL_WIDTH_DEFAULT;
  }
}

function clamp(n: number): number {
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(n)));
}

export function usePanelWidth(): [number, (next: number) => void] {
  const [width, setWidthState] = useState<number>(() => readStored());

  const setWidth = useCallback((next: number) => {
    const clamped = clamp(next);
    setWidthState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // localStorage 不可 (private mode 等) は無視
    }
  }, []);

  // 別タブで変更されたら同期
  useEffect(() => {
    const handler = (e: StorageEvent): void => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      const n = Number.parseInt(e.newValue, 10);
      if (Number.isFinite(n)) setWidthState(clamp(n));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return [width, setWidth];
}
