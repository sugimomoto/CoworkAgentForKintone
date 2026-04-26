import { describe, it, expect } from 'vitest';

import { interpretEvent, isTerminalEvent } from './eventInterpreter';

import type { SessionEvent } from './types';

describe('interpretEvent', () => {
  it('agent.message を agent kind の add に変換', () => {
    const evt: SessionEvent = {
      id: 'evt_1',
      type: 'agent.message',
      content: 'こんにちは',
      processed_at: '2026-04-25T00:00:00Z',
    };
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: { id: 'evt_1', kind: 'agent', text: 'こんにちは' },
    });
  });

  it('user.message を user kind の add に変換 (セッション復元用)', () => {
    const evt = {
      id: 'evt_user_1',
      type: 'user.message',
      content: [{ type: 'text', text: 'こんにちは' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: { id: 'evt_user_1', kind: 'user', text: 'こんにちは' },
    });
  });

  it('agent.thinking を thinking kind の add に変換', () => {
    const evt: SessionEvent = { id: 'evt_2', type: 'agent.thinking', processed_at: '...' };
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: { id: 'evt_2', kind: 'thinking' },
    });
  });

  it('agent.mcp_tool_use を tool kind (running) の add に変換 (kintone MCP)', () => {
    const evt = {
      id: 'mtu_1',
      type: 'agent.mcp_tool_use',
      name: 'kintone-get-apps',
      input: { name: '顧客' },
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: {
        id: 'mtu_1',
        kind: 'tool',
        name: 'kintone-get-apps',
        input: { name: '顧客' },
        status: 'running',
      },
    });
  });

  it('agent.mcp_tool_result (success) を update-tool に変換', () => {
    const evt = {
      id: 'evt_mr1',
      type: 'agent.mcp_tool_result',
      tool_use_id: 'mtu_1',
      content: [{ type: 'text', text: '{"apps":[]}' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'update-tool',
      toolUseId: 'mtu_1',
      patch: {
        status: 'success',
        result: [{ type: 'text', text: '{"apps":[]}' }],
      },
    });
  });

  it('agent.mcp_tool_result (is_error=true) を update-tool (error) に変換', () => {
    const evt = {
      id: 'evt_mr2',
      type: 'agent.mcp_tool_result',
      tool_use_id: 'mtu_2',
      is_error: true,
      content: [{ type: 'text', text: 'kintone API: app not found' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toMatchObject({
      kind: 'update-tool',
      toolUseId: 'mtu_2',
      patch: { status: 'error', errorText: 'kintone API: app not found' },
    });
  });

  it('agent.tool_use を tool kind (running) の add に変換', () => {
    const evt = {
      id: 'tu_1',
      type: 'agent.tool_use',
      name: 'kintone-add-record',
      input: { app: '1', record: { x: { value: 'y' } } },
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: {
        id: 'tu_1',
        kind: 'tool',
        name: 'kintone-add-record',
        input: { app: '1', record: { x: { value: 'y' } } },
        status: 'running',
      },
    });
  });

  it('agent.tool_result (is_error=false) を update-tool (success) に変換', () => {
    const evt = {
      id: 'evt_r1',
      type: 'agent.tool_result',
      tool_use_id: 'tu_1',
      content: [{ type: 'text', text: '{"id":"42"}' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'update-tool',
      toolUseId: 'tu_1',
      patch: {
        status: 'success',
        result: [{ type: 'text', text: '{"id":"42"}' }],
      },
    });
  });

  it('agent.tool_result (is_error=true) を update-tool (error + errorText) に変換', () => {
    const evt = {
      id: 'evt_r2',
      type: 'agent.tool_result',
      tool_use_id: 'tu_2',
      is_error: true,
      content: [{ type: 'text', text: 'kintone API error: app not found' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    const r = interpretEvent(evt);
    expect(r).toMatchObject({
      kind: 'update-tool',
      toolUseId: 'tu_2',
      patch: {
        status: 'error',
        errorText: 'kintone API error: app not found',
      },
    });
  });

  it('session.status_idle + tool_confirmation_required を update-tool (pending-confirmation) に変換', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_1',
      type: 'session.status_idle',
      stop_reason: { type: 'tool_confirmation_required', event_ids: ['tu_3'] },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toEqual({
      kind: 'update-tool',
      toolUseId: 'tu_3',
      patch: { status: 'pending-confirmation' },
    });
  });

  it('session.status_idle + end_turn は null (interpretEvent は表示更新を返さない)', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_2',
      type: 'session.status_idle',
      stop_reason: { type: 'end_turn' },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toBeNull();
  });

  it('session.status_idle + tool_confirmation_required で event_ids 空配列は null', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_3',
      type: 'session.status_idle',
      stop_reason: { type: 'tool_confirmation_required', event_ids: [] },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toBeNull();
  });

  it('未対応のイベント種別は null を返す', () => {
    const evt = {
      id: 'evt_unk',
      type: 'session.status_running',
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toBeNull();
  });

  it('agent.message の content が text ブロック配列のとき text を連結する', () => {
    const evt = {
      id: 'evt_blocks',
      type: 'agent.message',
      content: [
        { type: 'text', text: 'こんにちは' },
        { type: 'text', text: '、世界' },
      ],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: { id: 'evt_blocks', kind: 'agent', text: 'こんにちは、世界' },
    });
  });

  it('agent.message の content が undefined のときは空文字に正規化', () => {
    const evt = {
      id: 'evt_4',
      type: 'agent.message',
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual({
      kind: 'add',
      message: { id: 'evt_4', kind: 'agent', text: '' },
    });
  });
});

describe('isTerminalEvent', () => {
  it('session.status_idle + stop_reason.end_turn は terminal', () => {
    const evt: SessionEvent = {
      id: 'evt_1',
      type: 'session.status_idle',
      stop_reason: { type: 'end_turn' },
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(true);
  });

  it('session.status_idle + stop_reason.retries_exhausted も terminal', () => {
    const evt: SessionEvent = {
      id: 'evt_2',
      type: 'session.status_idle',
      stop_reason: { type: 'retries_exhausted' },
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(true);
  });

  it('session.status_idle + tool_confirmation_required は terminal ではない (応答待ち)', () => {
    const evt: SessionEvent = {
      id: 'evt_3',
      type: 'session.status_idle',
      stop_reason: { type: 'tool_confirmation_required' },
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(false);
  });

  it('agent.message は terminal ではない', () => {
    const evt: SessionEvent = {
      id: 'evt_4',
      type: 'agent.message',
      content: 'x',
      processed_at: '...',
    };
    expect(isTerminalEvent(evt)).toBe(false);
  });
});
