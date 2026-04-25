import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePanelOpenState, PANEL_OPEN_STORAGE_KEY } from './usePanelOpenState';

beforeEach(() => {
  localStorage.clear();
});

describe('usePanelOpenState', () => {
  it('初回は既定値 (true) を返す', () => {
    const { result } = renderHook(() => usePanelOpenState());
    expect(result.current[0]).toBe(true);
  });

  it('setIsOpen で state と localStorage 両方が更新される', () => {
    const { result } = renderHook(() => usePanelOpenState());

    act(() => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(PANEL_OPEN_STORAGE_KEY)).toBe('false');
  });

  it('再マウント時に localStorage から復元される', () => {
    localStorage.setItem(PANEL_OPEN_STORAGE_KEY, 'false');
    const { result } = renderHook(() => usePanelOpenState());
    expect(result.current[0]).toBe(false);
  });

  it('壊れた値 (JSON でない) は既定値に戻る', () => {
    localStorage.setItem(PANEL_OPEN_STORAGE_KEY, 'garbage');
    const { result } = renderHook(() => usePanelOpenState());
    expect(result.current[0]).toBe(true);
  });

  it('true に戻した値も localStorage に保存される', () => {
    const { result } = renderHook(() => usePanelOpenState());
    act(() => result.current[1](false));
    act(() => result.current[1](true));
    expect(localStorage.getItem(PANEL_OPEN_STORAGE_KEY)).toBe('true');
  });
});
