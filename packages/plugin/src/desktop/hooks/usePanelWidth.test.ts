import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  usePanelWidth,
} from './usePanelWidth';

const KEY = 'cowork-agent.panel-width';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('usePanelWidth', () => {
  it('localStorage 未設定なら DEFAULT を返す', () => {
    const { result } = renderHook(() => usePanelWidth());
    expect(result.current[0]).toBe(PANEL_WIDTH_DEFAULT);
  });

  it('localStorage の値があればそれを clamp して返す', () => {
    window.localStorage.setItem(KEY, '500');
    const { result } = renderHook(() => usePanelWidth());
    expect(result.current[0]).toBe(500);
  });

  it('範囲外の値は clamp される (下限)', () => {
    window.localStorage.setItem(KEY, '100');
    const { result } = renderHook(() => usePanelWidth());
    expect(result.current[0]).toBe(PANEL_WIDTH_MIN);
  });

  it('範囲外の値は clamp される (上限)', () => {
    window.localStorage.setItem(KEY, '9999');
    const { result } = renderHook(() => usePanelWidth());
    expect(result.current[0]).toBe(PANEL_WIDTH_MAX);
  });

  it('NaN や不正値は DEFAULT に戻る', () => {
    window.localStorage.setItem(KEY, 'abc');
    const { result } = renderHook(() => usePanelWidth());
    expect(result.current[0]).toBe(PANEL_WIDTH_DEFAULT);
  });

  it('setWidth で localStorage に保存される (clamp 後)', () => {
    const { result } = renderHook(() => usePanelWidth());
    act(() => result.current[1](600));
    expect(result.current[0]).toBe(600);
    expect(window.localStorage.getItem(KEY)).toBe('600');
  });

  it('setWidth は clamp する', () => {
    const { result } = renderHook(() => usePanelWidth());
    act(() => result.current[1](100));
    expect(result.current[0]).toBe(PANEL_WIDTH_MIN);
    act(() => result.current[1](9999));
    expect(result.current[0]).toBe(PANEL_WIDTH_MAX);
  });
});
