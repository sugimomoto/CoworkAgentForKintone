// 「指定した epoch ms 以降の経過秒」を 1s 刻みで返すフック。
// `useElapsedSeconds(active: boolean)` の bool トリガ版に対し、こちらは絶対時刻トリガ版。
// lastEventAt が変わったタイミングで自動的に 0 にリセットされ、新しい起点から測り直す。

import { useEffect, useState } from 'react';

export function useElapsedSinceEvent(lastEventAt: number | null): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (lastEventAt === null) {
      setSeconds(0);
      return;
    }
    const tick = (): void => {
      setSeconds(Math.floor((Date.now() - lastEventAt) / 1000));
    };
    tick(); // マウント / lastEventAt 変更直後に即時 0 を反映
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastEventAt]);
  return seconds;
}
