// Session の「終了 (terminated)」判定の単一ソース。
//
// 「終了」は 2 つの経路で観測される:
//   1. session-state: retrieveSession の結果 (archived_at がある / status === 'terminated')
//      — archive は events stream に流れないため Session リソースを見ないと検知できない
//   2. event: events stream の `session.status_terminated`
// これらを useEventPoller の各所に散らさず本関数に集約する。
//
// 注意: ここでの「終了 (terminated)」は Session 自体が完全終了した状態。
// 1 ターンの終了 (end_turn 等) は別概念で、eventInterpreter.isTerminalEvent が担う。

import type { Session, SessionEvent } from './types';

export type TerminationSignal =
  | { kind: 'session-state'; session: Pick<Session, 'status' | 'archived_at'> }
  | { kind: 'event'; event: SessionEvent };

/** signal が Session の終了を示すなら true。 */
export function isTerminated(signal: TerminationSignal): boolean {
  if (signal.kind === 'session-state') {
    const { status, archived_at } = signal.session;
    if (archived_at !== null && archived_at !== undefined) return true;
    return status === 'terminated';
  }
  return signal.event.type === 'session.status_terminated';
}
