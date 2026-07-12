import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { resetTransport, setTransport } from '../managed-agents/client';

import {
  _resetStoredPersonaCache,
  invalidateStoredPersona,
  resolveStoredPersona,
} from './resolveStoredPersona';

let calls: number;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockAgentSystem(system: string | undefined): void {
  setTransport((url) => {
    calls++;
    return Promise.resolve(json({ id: 'agent_c', type: 'agent', system, metadata: {}, model: { id: 'x' }, created_at: '', updated_at: '', version: 1 }));
  });
}

beforeEach(() => {
  calls = 0;
  _resetStoredPersonaCache();
});
afterEach(() => {
  resetTransport();
  _resetStoredPersonaCache();
});

describe('resolveStoredPersona (#141)', () => {
  it('焼き込み system を返し、2 回目はキャッシュから (fetch 1 回)', async () => {
    mockAgentSystem('CUSTOM PERSONA');
    expect(await resolveStoredPersona('agent_c')).toBe('CUSTOM PERSONA');
    expect(await resolveStoredPersona('agent_c')).toBe('CUSTOM PERSONA');
    expect(calls).toBe(1);
  });

  it('invalidate すると再 fetch する', async () => {
    mockAgentSystem('P1');
    await resolveStoredPersona('agent_c');
    invalidateStoredPersona('agent_c');
    await resolveStoredPersona('agent_c');
    expect(calls).toBe(2);
  });

  it('system 未設定は空文字を返す', async () => {
    mockAgentSystem(undefined);
    expect(await resolveStoredPersona('agent_c')).toBe('');
  });

  it('取得失敗は null (override せず継続) + キャッシュしない', async () => {
    setTransport(() => Promise.resolve(json({ error: { message: 'boom' } }, 500)));
    expect(await resolveStoredPersona('agent_x')).toBeNull();
    // 失敗はキャッシュされないので次回も試行する
    mockAgentSystem('RECOVERED');
    expect(await resolveStoredPersona('agent_x')).toBe('RECOVERED');
  });
});
