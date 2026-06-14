import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retryWithBackoff } from './retryWithBackoff';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('retryWithBackoff', () => {
  it('1 回目で成功すれば即返す (リトライしない)', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const p = retryWithBackoff(fn);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('3 回目で成功する', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');
    const p = retryWithBackoff(fn, { initialDelayMs: 1000 });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('maxAttempts 超過で最後のエラーを reject する', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const p = retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 1000 });
    p.catch(() => {}); // unhandled rejection 抑制
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('バックオフは 1s → 2s → 4s で延びる (上限まで)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    const p = retryWithBackoff(fn, { maxAttempts: 4, initialDelayMs: 1000, maxDelayMs: 10000 });
    p.catch(() => {});
    await Promise.resolve(); // attempt 0 (同期呼出) の reject を flush
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1); // まだ 1s 未満
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2); // 1s 後に attempt 1

    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3); // +2s で attempt 2

    await vi.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(4); // +4s で attempt 3 (最終)
    await expect(p).rejects.toThrow('x');
  });

  it('maxDelayMs で頭打ちになる', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    const p = retryWithBackoff(fn, { maxAttempts: 6, initialDelayMs: 1000, maxDelayMs: 3000 });
    p.catch(() => {});
    await Promise.resolve();
    // 1s, 2s, 3s(cap), 3s(cap), 3s(cap) の順で 6 回試行
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fn).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fn).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fn).toHaveBeenCalledTimes(6);
    await expect(p).rejects.toThrow('x');
  });

  it('signal abort で待機中に AbortError で中断し、以降リトライしない', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    const controller = new AbortController();
    const p = retryWithBackoff(fn, { signal: controller.signal, initialDelayMs: 1000 });
    p.catch(() => {});
    await Promise.resolve(); // attempt 0 失敗 → sleep 中
    expect(fn).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(fn).toHaveBeenCalledTimes(1); // 中断後は再試行しない
  });

  it('開始時点で abort 済みなら一度も呼ばずに AbortError', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const controller = new AbortController();
    controller.abort();
    await expect(retryWithBackoff(fn, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fn).not.toHaveBeenCalled();
  });
});
