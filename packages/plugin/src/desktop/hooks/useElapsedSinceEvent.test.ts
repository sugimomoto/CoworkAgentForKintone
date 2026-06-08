import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useElapsedSinceEvent } from './useElapsedSinceEvent';

describe('useElapsedSinceEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lastEventAt が null のときは 0 を返す', () => {
    const { result } = renderHook(() => useElapsedSinceEvent(null));
    expect(result.current).toBe(0);
  });

  it('lastEventAt 指定で初期値 0、1 秒経過で 1', () => {
    const start = Date.now();
    const { result } = renderHook(() => useElapsedSinceEvent(start));
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(6);
  });

  it('lastEventAt が更新されたら 0 にリセット', () => {
    const start = Date.now();
    const { result, rerender } = renderHook(({ at }) => useElapsedSinceEvent(at), {
      initialProps: { at: start },
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(3);

    // 新しい event が来た想定で lastEventAt を現在時刻に更新
    rerender({ at: Date.now() });
    expect(result.current).toBe(0);
  });

  it('null に切り替わったら 0 に戻る', () => {
    const start = Date.now();
    const { result, rerender } = renderHook<number, { at: number | null }>(
      ({ at }) => useElapsedSinceEvent(at),
      { initialProps: { at: start } },
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(2);

    rerender({ at: null });
    expect(result.current).toBe(0);
  });
});
