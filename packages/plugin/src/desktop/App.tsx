// Cowork Agent for kintone — desktop ルートコンポーネント
//
// パネル開閉トグル + FAB + ⌘K/Ctrl+K キーバインド + 左端ドラッグでの横幅リサイズ。
// ChatPanel は常時マウントしておき、閉じるときは display:none で隠すだけにすることで
// useSession の bootstrap や useEventPoller を維持する (再オープン時の再解決コストを回避)。

import { useEffect, useRef } from 'react';

import { ChatPanel } from './ChatPanel';
import { usePanelOpenState } from './hooks/usePanelOpenState';
import {
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  usePanelWidth,
} from './hooks/usePanelWidth';

export function App(): JSX.Element {
  const [isOpen, setIsOpen] = usePanelOpenState();
  const [width, setWidth] = usePanelWidth();

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, setIsOpen]);

  return (
    <>
      <div
        data-testid="cowork-agent-panel"
        data-open={isOpen ? '1' : '0'}
        className="fixed bottom-0 right-0 top-0 z-[100]"
        style={{ display: isOpen ? 'block' : 'none', width: `${width}px` }}
      >
        <ResizeHandle width={width} onResize={setWidth} />
        <ChatPanel onClose={() => setIsOpen(false)} />
      </div>
      {!isOpen && <Fab onClick={() => setIsOpen(true)} />}
    </>
  );
}

/**
 * パネル左端のドラッグハンドル。mousedown で global mousemove/mouseup を張って
 * window.innerWidth - clientX を新しい幅として親に通知する。
 */
function ResizeHandle({
  width,
  onResize,
}: {
  width: number;
  onResize: (next: number) => void;
}): JSX.Element {
  const startRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    startRef.current = { startX: e.clientX, startWidth: width };

    const handleMove = (ev: MouseEvent): void => {
      const start = startRef.current;
      if (!start) return;
      // 右側固定パネルなので、X 軸を「左に動かす = 幅が増える」に反転
      const dx = start.startX - ev.clientX;
      onResize(start.startWidth + dx);
    };
    const handleUp = (): void => {
      startRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div
      data-testid="cowork-agent-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="パネルの幅を変更"
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      aria-valuenow={width}
      onMouseDown={handleMouseDown}
      className="absolute left-0 top-0 bottom-0 w-[6px] -translate-x-[3px] cursor-col-resize hover:bg-accent/30 active:bg-accent/50 z-[110]"
    />
  );
}

function Fab({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      data-testid="cowork-agent-fab"
      aria-label="Cowork Agent を開く"
      onClick={onClick}
      className="fixed bottom-[20px] right-[20px] z-[100] flex h-[56px] w-[56px] items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(13,148,136,0.4)] transition-transform hover:scale-105"
      style={{ background: 'linear-gradient(135deg, var(--cw-accent), rgba(13,148,136,0.75))' }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
