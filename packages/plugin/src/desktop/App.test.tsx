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
});
