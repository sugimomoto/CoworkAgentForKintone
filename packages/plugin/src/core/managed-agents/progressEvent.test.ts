import { describe, expect, it } from 'vitest';

import { mapEventToProgressKind } from './progressEvent';

import type { SessionEvent } from './types';

const baseTs = '2026-06-01T00:00:00Z';

describe('mapEventToProgressKind', () => {
  it('agent.thinking → thinking', () => {
    const e: SessionEvent = { type: 'agent.thinking', id: 'e1', processed_at: baseTs };
    expect(mapEventToProgressKind(e)).toEqual({ kind: 'thinking' });
  });

  it('agent.tool_use → tool_use with name', () => {
    const e: SessionEvent = {
      type: 'agent.tool_use',
      id: 'e1',
      name: 'bash',
      input: {},
      processed_at: baseTs,
    };
    expect(mapEventToProgressKind(e)).toEqual({ kind: 'tool_use', toolName: 'bash' });
  });

  it('agent.mcp_tool_use → tool_use with name', () => {
    const e: SessionEvent = {
      type: 'agent.mcp_tool_use',
      id: 'e1',
      name: 'kintone-get-records',
      input: {},
      processed_at: baseTs,
    };
    expect(mapEventToProgressKind(e)).toEqual({
      kind: 'tool_use',
      toolName: 'kintone-get-records',
    });
  });

  it('agent.tool_result → tool_result', () => {
    const e: SessionEvent = {
      type: 'agent.tool_result',
      id: 'e1',
      tool_use_id: 'tu1',
      processed_at: baseTs,
    };
    expect(mapEventToProgressKind(e)).toEqual({ kind: 'tool_result' });
  });

  it('agent.mcp_tool_result → tool_result', () => {
    const e: SessionEvent = {
      type: 'agent.mcp_tool_result',
      id: 'e1',
      mcp_tool_use_id: 'tu1',
      processed_at: baseTs,
    };
    expect(mapEventToProgressKind(e)).toEqual({ kind: 'tool_result' });
  });

  it('agent.custom_tool_use → custom_tool_use', () => {
    const e: SessionEvent = {
      type: 'agent.custom_tool_use',
      id: 'e1',
      name: 'create_artifact',
      input: {},
      processed_at: baseTs,
    };
    expect(mapEventToProgressKind(e)).toEqual({ kind: 'custom_tool_use' });
  });

  it('agent.message → message', () => {
    const e: SessionEvent = {
      type: 'agent.message',
      id: 'e1',
      content: [{ type: 'text', text: 'hi' }],
      processed_at: baseTs,
    };
    expect(mapEventToProgressKind(e)).toEqual({ kind: 'message' });
  });

  it('session.status_running → null (進行表示の更新対象外)', () => {
    const e: SessionEvent = { type: 'session.status_running', id: 'e1', processed_at: baseTs };
    expect(mapEventToProgressKind(e)).toBeNull();
  });

  it('user.message → null', () => {
    const e: SessionEvent = { type: 'user.message', id: 'e1', content: 'hello' };
    expect(mapEventToProgressKind(e)).toBeNull();
  });

  it('未知 event は null', () => {
    const e = { type: 'span.model_request_start', id: 'e1' } as unknown as SessionEvent;
    expect(mapEventToProgressKind(e)).toBeNull();
  });
});
