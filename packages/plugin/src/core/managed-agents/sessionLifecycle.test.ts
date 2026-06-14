import { describe, expect, it } from 'vitest';

import { isTerminated } from './sessionLifecycle';

import type { Session, SessionEvent } from './types';

const sessionState = (over: Partial<Pick<Session, 'status' | 'archived_at'>>) =>
  ({ status: 'idle', archived_at: null, ...over }) as Pick<Session, 'status' | 'archived_at'>;

describe('isTerminated — session-state', () => {
  it('archived_at があれば終了', () => {
    expect(
      isTerminated({ kind: 'session-state', session: sessionState({ archived_at: '2026-06-14T00:00:00Z' }) }),
    ).toBe(true);
  });

  it("status === 'terminated' なら終了", () => {
    expect(
      isTerminated({ kind: 'session-state', session: sessionState({ status: 'terminated' }) }),
    ).toBe(true);
  });

  it('running / idle / rescheduling かつ archived_at=null なら終了でない', () => {
    for (const status of ['running', 'idle', 'rescheduling'] as const) {
      expect(isTerminated({ kind: 'session-state', session: sessionState({ status }) })).toBe(false);
    }
  });

  it('archived_at が無い (undefined) なら終了でない', () => {
    expect(
      isTerminated({
        kind: 'session-state',
        session: { status: 'idle' } as Pick<Session, 'status' | 'archived_at'>,
      }),
    ).toBe(false);
  });
});

describe('isTerminated — event', () => {
  it('session.status_terminated なら終了', () => {
    const event = {
      type: 'session.status_terminated',
      id: 'evt_1',
      processed_at: '2026-06-14T00:00:00Z',
    } as SessionEvent;
    expect(isTerminated({ kind: 'event', event })).toBe(true);
  });

  it('session.status_running / status_idle は終了でない', () => {
    const running = {
      type: 'session.status_running',
      id: 'evt_2',
      processed_at: '2026-06-14T00:00:00Z',
    } as SessionEvent;
    expect(isTerminated({ kind: 'event', event: running })).toBe(false);
  });
});
