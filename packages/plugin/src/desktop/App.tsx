// Cowork Agent for kintone — desktop ルートコンポーネント
//
// パネル開閉トグル + FAB + ⌘K/Ctrl+K キーバインドを担当する。
// ChatPanel は常時マウントしておき、閉じるときは display:none で隠すだけにすることで
// useSession の bootstrap や useEventPoller を維持する (再オープン時の再解決コストを回避)。

import { useEffect } from 'react';

import { ChatPanel } from './ChatPanel';
import { usePanelOpenState } from './hooks/usePanelOpenState';

export function App(): JSX.Element {
  const [isOpen, setIsOpen] = usePanelOpenState();

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
        className="fixed bottom-0 right-0 top-0 w-[380px] z-[100]"
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        <ChatPanel onClose={() => setIsOpen(false)} />
      </div>
      {!isOpen && <Fab onClick={() => setIsOpen(true)} />}
    </>
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
