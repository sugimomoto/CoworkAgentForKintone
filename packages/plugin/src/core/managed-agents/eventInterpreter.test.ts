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
    expect(interpretEvent(evt)).toEqual([
      { kind: 'add', message: { id: 'evt_1', kind: 'agent', text: 'こんにちは' } },
    ]);
  });

  it('user.message を user kind の add に変換 (セッション復元用)', () => {
    const evt = {
      id: 'evt_user_1',
      type: 'user.message',
      content: [{ type: 'text', text: 'こんにちは' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([
      { kind: 'add', message: { id: 'evt_user_1', kind: 'user', text: 'こんにちは' } },
    ]);
  });

  it('user.message: 隠し sentinel 付き text block は UI 表示用テキストから除外する (#27 fileKey メタ)', () => {
    const evt = {
      id: 'evt_user_2',
      type: 'user.message',
      content: [
        {
          type: 'text',
          text: '<!--cowork-agent:hidden-->\n【kintone に保存済の添付ファイル】\n- a.pdf (fileKey: fk-1)',
        },
        { type: 'text', text: '要約して' },
      ],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([
      { kind: 'add', message: { id: 'evt_user_2', kind: 'user', text: '要約して' } },
    ]);
  });

  it('agent.thinking を thinking kind の add に変換', () => {
    const evt: SessionEvent = { id: 'evt_2', type: 'agent.thinking', processed_at: '...' };
    expect(interpretEvent(evt)).toEqual([
      { kind: 'add', message: { id: 'evt_2', kind: 'thinking' } },
    ]);
  });

  it('agent.mcp_tool_use を tool kind (running) の add に変換 (kintone MCP)', () => {
    const evt = {
      id: 'mtu_1',
      type: 'agent.mcp_tool_use',
      name: 'kintone-get-apps',
      input: { name: '顧客' },
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([
      {
        kind: 'add',
        message: {
          id: 'mtu_1',
          kind: 'tool',
          name: 'kintone-get-apps',
          input: { name: '顧客' },
          status: 'running',
        },
      },
    ]);
  });

  it('agent.mcp_tool_result (success) を update-tool に変換 — mcp_tool_use_id でリンク', () => {
    const evt = {
      id: 'evt_mr1',
      type: 'agent.mcp_tool_result',
      mcp_tool_use_id: 'mtu_1',
      content: [{ type: 'text', text: '{"apps":[]}' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([
      {
        kind: 'update-tool',
        toolUseId: 'mtu_1',
        patch: {
          status: 'success',
          result: [{ type: 'text', text: '{"apps":[]}' }],
        },
      },
    ]);
  });

  it('agent.mcp_tool_result (is_error=true) を update-tool (error) に変換', () => {
    const evt = {
      id: 'evt_mr2',
      type: 'agent.mcp_tool_result',
      mcp_tool_use_id: 'mtu_2',
      is_error: true,
      content: [{ type: 'text', text: 'kintone API: app not found' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    const r = interpretEvent(evt);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
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
    expect(interpretEvent(evt)).toEqual([
      {
        kind: 'add',
        message: {
          id: 'tu_1',
          kind: 'tool',
          name: 'kintone-add-record',
          input: { app: '1', record: { x: { value: 'y' } } },
          status: 'running',
        },
      },
    ]);
  });

  it('agent.tool_result (is_error=false) を update-tool (success) に変換', () => {
    const evt = {
      id: 'evt_r1',
      type: 'agent.tool_result',
      tool_use_id: 'tu_1',
      content: [{ type: 'text', text: '{"id":"42"}' }],
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([
      {
        kind: 'update-tool',
        toolUseId: 'tu_1',
        patch: {
          status: 'success',
          result: [{ type: 'text', text: '{"id":"42"}' }],
        },
      },
    ]);
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
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      kind: 'update-tool',
      toolUseId: 'tu_2',
      patch: {
        status: 'error',
        errorText: 'kintone API error: app not found',
      },
    });
  });

  it('session.status_idle + requires_action を update-tool (pending-confirmation) に変換 (実 API 仕様)', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_1',
      type: 'session.status_idle',
      stop_reason: { type: 'requires_action', event_ids: ['tu_3'] },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toEqual([
      {
        kind: 'update-tool',
        toolUseId: 'tu_3',
        patch: { status: 'pending-confirmation' },
      },
    ]);
  });

  it('session.status_idle + tool_confirmation_required も同様に処理 (docs の名称も許容)', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_1b',
      type: 'session.status_idle',
      stop_reason: { type: 'tool_confirmation_required', event_ids: ['tu_3b'] },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toEqual([
      {
        kind: 'update-tool',
        toolUseId: 'tu_3b',
        patch: { status: 'pending-confirmation' },
      },
    ]);
  });

  it('session.status_idle + end_turn は空配列 (表示更新なし)', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_2',
      type: 'session.status_idle',
      stop_reason: { type: 'end_turn' },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toEqual([]);
  });

  it('session.status_idle + requires_action で event_ids 空配列は空配列', () => {
    const evt: SessionEvent = {
      id: 'evt_idle_3',
      type: 'session.status_idle',
      stop_reason: { type: 'requires_action', event_ids: [] },
      processed_at: '...',
    };
    expect(interpretEvent(evt)).toEqual([]);
  });

  it('未対応のイベント種別は空配列を返す', () => {
    const evt = {
      id: 'evt_unk',
      type: 'session.status_running',
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([]);
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
    expect(interpretEvent(evt)).toEqual([
      { kind: 'add', message: { id: 'evt_blocks', kind: 'agent', text: 'こんにちは、世界' } },
    ]);
  });

  it('agent.message の content が undefined のときは空文字に正規化', () => {
    const evt = {
      id: 'evt_4',
      type: 'agent.message',
      processed_at: '...',
    } as unknown as SessionEvent;
    expect(interpretEvent(evt)).toEqual([
      { kind: 'add', message: { id: 'evt_4', kind: 'agent', text: '' } },
    ]);
  });

  describe('agent.custom_tool_use (create_artifact)', () => {
    it('正常な input で upsert-artifact + add (artifact-ref) の 2 効果を返す', () => {
      const evt = {
        id: 'evt_ct_1',
        type: 'agent.custom_tool_use',
        name: 'create_artifact',
        input: {
          id: 'sales-2026q1',
          kind: 'markdown',
          title: '2026 Q1 売上',
          content: '# 売上レポート',
        },
        processed_at: '...',
      } as unknown as SessionEvent;
      const r = interpretEvent(evt);
      expect(r).toHaveLength(2);
      // event.id がそのまま custom_tool_use_id として返る
      expect(r[0]).toEqual({
        kind: 'upsert-artifact',
        toolUseId: 'evt_ct_1',
        input: {
          id: 'sales-2026q1',
          kind: 'markdown',
          title: '2026 Q1 売上',
          content: '# 売上レポート',
        },
      });
      expect(r[1]).toEqual({
        kind: 'add',
        message: {
          id: 'evt_ct_1',
          kind: 'artifact-ref',
          artifactId: 'sales-2026q1',
          title: '2026 Q1 売上',
          artifactKind: 'markdown',
        },
      });
    });

    it('入力不正 (id 欠落) は警告メッセージを返す', () => {
      const evt = {
        id: 'evt_ct_3',
        type: 'agent.custom_tool_use',
        name: 'create_artifact',
        input: { kind: 'markdown', title: 'T', content: 'x' },
        processed_at: '...',
      } as unknown as SessionEvent;
      const r = interpretEvent(evt);
      expect(r).toHaveLength(1);
      expect(r[0]?.kind).toBe('add');
    });

    it('未知のツール名 (create_artifact 以外) は空配列', () => {
      const evt = {
        id: 'evt_ct_4',
        type: 'agent.custom_tool_use',
        name: 'unknown_tool',
        input: {},
        processed_at: '...',
      } as unknown as SessionEvent;
      expect(interpretEvent(evt)).toEqual([]);
    });
  });

  describe('agent.custom_tool_use (update_plan, #128)', () => {
    it('正常な input で set-plan effect (toolUseId = event.id) を返す', () => {
      const evt = {
        id: 'evt_plan_1',
        type: 'agent.custom_tool_use',
        name: 'update_plan',
        input: {
          todos: [
            { content: '取得', status: 'completed', activeForm: '取得中' },
            { content: '集計', status: 'in_progress', activeForm: '集計中' },
          ],
        },
        processed_at: '...',
      } as unknown as SessionEvent;
      expect(interpretEvent(evt)).toEqual([
        {
          kind: 'set-plan',
          toolUseId: 'evt_plan_1',
          plan: [
            { content: '取得', status: 'completed', activeForm: '取得中' },
            { content: '集計', status: 'in_progress', activeForm: '集計中' },
          ],
        },
      ]);
    });

    it('空 todos は set-plan (plan=[]) を返し PlanPanel を消せる', () => {
      const evt = {
        id: 'evt_plan_2',
        type: 'agent.custom_tool_use',
        name: 'update_plan',
        input: { todos: [] },
        processed_at: '...',
      } as unknown as SessionEvent;
      expect(interpretEvent(evt)).toEqual([
        { kind: 'set-plan', toolUseId: 'evt_plan_2', plan: [] },
      ]);
    });

    it('入力不正 (todos が配列でない) でも set-plan (plan=[]) を返し tool を継続させる', () => {
      const evt = {
        id: 'evt_plan_3',
        type: 'agent.custom_tool_use',
        name: 'update_plan',
        input: { todos: 'oops' },
        processed_at: '...',
      } as unknown as SessionEvent;
      expect(interpretEvent(evt)).toEqual([
        { kind: 'set-plan', toolUseId: 'evt_plan_3', plan: [] },
      ]);
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
