import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../store/chatStore';

import { App } from './App';
import { PANEL_OPEN_STORAGE_KEY } from './hooks/usePanelOpenState';

// useSession / useEventPoller の中身は別テストで担保。ここでは bootstrap を no-op にする
vi.mock('./hooks/useSession', () => ({
  useSession: () => ({ startNewConversation: vi.fn() }),
}));
vi.mock('./hooks/useEventPoller', () => ({
  useEventPoller: () => undefined,
}));

beforeEach(() => {
  localStorage.clear();
  useChatStore.getState().reset();
});

afterEach(() => {
  localStorage.clear();
});

describe('App', () => {
  it('初期状態 (localStorage 未設定) ではパネルが開いた状態でレンダリングされる', () => {
    render(<App />);
    const panel = screen.getByTestId('cowork-agent-panel');
    expect(panel.dataset['open']).toBe('1');
    expect(screen.queryByTestId('cowork-agent-fab')).toBeNull();
  });

  it('localStorage に false が保存されていれば FAB のみ表示される', () => {
    localStorage.setItem(PANEL_OPEN_STORAGE_KEY, 'false');
    render(<App />);
    const panel = screen.getByTestId('cowork-agent-panel');
    expect(panel.dataset['open']).toBe('0');
    expect(screen.getByTestId('cowork-agent-fab')).toBeInTheDocument();
  });

  it('Header の閉じるボタンでパネルが閉じ FAB が表示される', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('閉じる'));
    expect(screen.getByTestId('cowork-agent-panel').dataset['open']).toBe('0');
    expect(screen.getByTestId('cowork-agent-fab')).toBeInTheDocument();
    expect(localStorage.getItem(PANEL_OPEN_STORAGE_KEY)).toBe('false');
  });

  it('FAB クリックでパネルが再表示される', () => {
    localStorage.setItem(PANEL_OPEN_STORAGE_KEY, 'false');
    render(<App />);
    fireEvent.click(screen.getByTestId('cowork-agent-fab'));
    expect(screen.getByTestId('cowork-agent-panel').dataset['open']).toBe('1');
    expect(screen.queryByTestId('cowork-agent-fab')).toBeNull();
    expect(localStorage.getItem(PANEL_OPEN_STORAGE_KEY)).toBe('true');
  });

  it('⌘+K でパネルがトグルする (Mac)', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByTestId('cowork-agent-panel').dataset['open']).toBe('0');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByTestId('cowork-agent-panel').dataset['open']).toBe('1');
  });

  it('Ctrl+K でも同様にトグルする (Windows/Linux)', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('cowork-agent-panel').dataset['open']).toBe('0');
  });

  it('修飾キーなしの k だけではトグルしない', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k' });
    expect(screen.getByTestId('cowork-agent-panel').dataset['open']).toBe('1');
  });

  describe('パネル幅リサイズ', () => {
    it('既定幅は 380px', () => {
      render(<App />);
      const panel = screen.getByTestId('cowork-agent-panel');
      expect(panel.style.width).toBe('380px');
    });

    it('リサイズハンドルが存在する', () => {
      render(<App />);
      expect(screen.getByTestId('cowork-agent-resize-handle')).toBeInTheDocument();
    });

    it('左にドラッグするとパネル幅が拡大、右にドラッグすると縮小する', () => {
      render(<App />);
      const handle = screen.getByTestId('cowork-agent-resize-handle');

      // mousedown @ x=1000、mousemove @ x=900 で 100px 左にドラッグ → 幅 +100
      fireEvent.mouseDown(handle, { clientX: 1000 });
      fireEvent.mouseMove(window, { clientX: 900 });
      fireEvent.mouseUp(window);

      const panel = screen.getByTestId('cowork-agent-panel');
      expect(panel.style.width).toBe('480px'); // 380 + 100
    });

    it('幅は MIN/MAX に clamp される', () => {
      render(<App />);
      const handle = screen.getByTestId('cowork-agent-resize-handle');

      // 大きく左にドラッグ → MAX(1600) で止まる
      fireEvent.mouseDown(handle, { clientX: 2000 });
      fireEvent.mouseMove(window, { clientX: 0 });
      fireEvent.mouseUp(window);

      const panel = screen.getByTestId('cowork-agent-panel');
      expect(panel.style.width).toBe('1600px');
    });
  });
});
