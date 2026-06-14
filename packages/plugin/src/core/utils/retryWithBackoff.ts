// 指数バックオフ付きリトライユーティリティ
//
// fn を最大 maxAttempts 回まで試行する。失敗するたびに initialDelayMs から倍々で
// 待機し (maxDelayMs で頭打ち)、最終試行も失敗したら最後のエラーを throw する。
// AbortSignal が中断されたら待機中でも即座に AbortError で抜ける (無限リトライ防止)。

export interface RetryOptions {
  /** 最大試行回数 (default 5) */
  maxAttempts: number;
  /** 初回バックオフ (ms, default 1000) */
  initialDelayMs: number;
  /** バックオフ上限 (ms, default 10000) */
  maxDelayMs: number;
  /** 中断シグナル */
  signal?: AbortSignal;
}

const DEFAULTS: Omit<RetryOptions, 'signal'> = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
};

function abortError(): DOMException {
  return new DOMException('aborted', 'AbortError');
}

/** signal 対応の sleep。中断されたら AbortError で reject する。 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort);
  });
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULTS.maxAttempts;
  const initialDelayMs = opts?.initialDelayMs ?? DEFAULTS.initialDelayMs;
  const maxDelayMs = opts?.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const signal = opts?.signal;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw abortError();
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // 最終試行なら待たずに抜けて throw
      if (attempt === maxAttempts - 1) break;
      const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      await sleep(delay, signal); // 中断時はここで AbortError が伝播する
    }
  }
  throw lastErr;
}
