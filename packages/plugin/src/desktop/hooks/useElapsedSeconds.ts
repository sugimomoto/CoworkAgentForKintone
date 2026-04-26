// 経過秒数を 1s 刻みで返すフック。
// active=true の間だけインターバル稼働、active=false で 0 にリセット。

import { useEffect, useState } from 'react';

export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      // 既に 0 ならスキップ (inactive な card で毎 render 走るのを防ぐ)
      setSeconds((s) => (s === 0 ? s : 0));
      return;
    }
    const startedAt = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}
