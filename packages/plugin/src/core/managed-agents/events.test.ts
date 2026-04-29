import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  fetchAllEventsSince,
  listEvents,
  postCustomToolResult,
  postToolConfirmation,
  postUserInterrupt,
  postUserMessage,
} from './events';

import type { ListResponse, SessionEvent } from './types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postUserMessage', () => {
  it('POST /v1/sessions/{id}/events に user.message を送る', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postUserMessage('sess_1', 'Hello agent');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/sessions/sess_1/events');
    expect((init as RequestInit).method).toBe('POST');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      events: [
        {
          type: 'user.message',
          content: [{ type: 'text', text: 'Hello agent' }],
        },
      ],
    });
  });

  it('content 配列を直接渡せる', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postUserMessage('sess_1', [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }]);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.events[0].content).toEqual([
      { type: 'text', text: 'A' },
      { type: 'text', text: 'B' },
    ]);
  });
});

describe('listEvents', () => {
  it('GET /v1/sessions/{id}/events を呼ぶ', async () => {
    const expected: ListResponse<SessionEvent> = { data: [], next_page: null };
    fetchMock.mockResolvedValue(jsonResponse(expected));

    const result = await listEvents('sess_1');

    expect(result).toEqual(expected);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/v1/sessions/sess_1/events');
  });

  it('order と page を渡せる', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));

    await listEvents('sess_1', { order: 'asc', page: 'tok123', limit: 100 });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('order=asc');
    expect(url).toContain('page=tok123');
    expect(url).toContain('limit=100');
  });
});

describe('fetchAllEventsSince', () => {
  it('sinceEventId 指定: desc 順でページを walk して新規分を asc 順で返す', async () => {
    // 既知 (sinceEventId=evt_1) より新しいイベント evt_2, evt_3 を返したい。
    // 新実装は desc (newest first) で取得して、sinceEventId 到達まで walk する。
    const e2: SessionEvent = {
      id: 'evt_2',
      type: 'agent.message',
      content: 'hi',
      processed_at: '...',
    };
    const e3: SessionEvent = {
      id: 'evt_3',
      type: 'agent.message',
      content: 'how',
      processed_at: '...',
    };
    // desc 順なので [evt_3, evt_2, evt_1] の順で返却される。途中で evt_1 に当たる
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          e3,
          e2,
          { id: 'evt_1', type: 'agent.thinking', processed_at: '...' } as SessionEvent,
        ],
        next_page: null,
      }),
    );

    const result = await fetchAllEventsSince('sess_1', 'evt_1');

    // 返却は asc 順 (最古→最新)
    expect(result).toEqual([e2, e3]);
    // GET は 1 回 (desc walk で sinceEventId に到達して停止)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('order=desc');
  });

  it('sinceEventId が undefined のとき asc 順で全件返す (初回ロード)', async () => {
    const e1: SessionEvent = { id: 'evt_1', type: 'agent.message', content: 'a', processed_at: '...' };
    const e2: SessionEvent = { id: 'evt_2', type: 'agent.message', content: 'b', processed_at: '...' };

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [e1, e2], next_page: null }));

    const result = await fetchAllEventsSince('sess_1', undefined);

    expect(result).toEqual([e1, e2]);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('order=asc');
  });

  it('初回ロードで次ページがあればページングして連結する', async () => {
    const e1: SessionEvent = { id: 'evt_1', type: 'agent.thinking', processed_at: '...' };
    const e2: SessionEvent = { id: 'evt_2', type: 'agent.thinking', processed_at: '...' };
    const e3: SessionEvent = { id: 'evt_3', type: 'agent.thinking', processed_at: '...' };

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [e1, e2], next_page: 'page2' }))
      .mockResolvedValueOnce(jsonResponse({ data: [e3], next_page: null }));

    const result = await fetchAllEventsSince('sess_1', undefined);

    expect(result).toEqual([e1, e2, e3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('差分取得で次ページに sinceEventId が見つかれば、それまでの新規分を返す', async () => {
    const e10: SessionEvent = { id: 'evt_10', type: 'agent.thinking', processed_at: '...' };
    const e9: SessionEvent = { id: 'evt_9', type: 'agent.message', content: 'x', processed_at: '...' };
    const e8: SessionEvent = { id: 'evt_8', type: 'agent.thinking', processed_at: '...' };
    // 1 ページ目 (desc): [evt_10, evt_9] (next_page あり)
    // 2 ページ目 (desc): [evt_8, evt_5] — evt_5 が sinceEventId
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [e10, e9], next_page: 'p2' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [e8, { id: 'evt_5', type: 'agent.thinking', processed_at: '...' } as SessionEvent],
          next_page: 'p3', // 通常は到達しない
        }),
      );

    const result = await fetchAllEventsSince('sess_1', 'evt_5');

    expect(result).toEqual([e8, e9, e10]); // asc 順
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sinceEventId が見つからない場合は asc 順 fallback で全件返す (新セッション扱い)', async () => {
    const e1: SessionEvent = { id: 'evt_x', type: 'agent.message', content: 'a', processed_at: '...' };

    // 1 段階目: desc walk で sinceEventId が見つからない (next_page=null で終了)
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [e1], next_page: null }));
    // 2 段階目: asc fallback で全件取得
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [e1], next_page: null }));

    const result = await fetchAllEventsSince('sess_1', 'evt_unknown');

    expect(result).toEqual([e1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('postUserInterrupt', () => {
  it('user.interrupt を POST する', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postUserInterrupt('sess_1');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/sessions/sess_1/events');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ events: [{ type: 'user.interrupt' }] });
  });
});

describe('postToolConfirmation', () => {
  it('result=allow は user.tool_confirmation を送る (deny_message なし)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postToolConfirmation('sess_1', 'tu_42', 'allow');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/sessions/sess_1/events');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      events: [{ type: 'user.tool_confirmation', tool_use_id: 'tu_42', result: 'allow' }],
    });
  });

  it('result=deny + denyMessage は deny_message を含める', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postToolConfirmation('sess_1', 'tu_42', 'deny', 'ユーザが却下しました');

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.events[0]).toEqual({
      type: 'user.tool_confirmation',
      tool_use_id: 'tu_42',
      result: 'deny',
      deny_message: 'ユーザが却下しました',
    });
  });

  it('result=allow のときに denyMessage を渡しても無視される', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postToolConfirmation('sess_1', 'tu_42', 'allow', 'ignored');

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.events[0]).not.toHaveProperty('deny_message');
  });
});

describe('postCustomToolResult', () => {
  it('成功結果は user.custom_tool_result + content (JSON 文字列) で送る', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postCustomToolResult('sess_1', 'tu_99', { ok: true, artifactId: 'a1' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/sessions/sess_1/events');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.events[0]).toEqual({
      type: 'user.custom_tool_result',
      custom_tool_use_id: 'tu_99',
      content: [{ type: 'text', text: JSON.stringify({ ok: true, artifactId: 'a1' }) }],
      is_error: false,
    });
  });

  it('失敗結果は is_error=true で content にエラー文を含む', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await postCustomToolResult('sess_1', 'tu_99', { ok: false, error: 'invalid input' });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.events[0]).toEqual({
      type: 'user.custom_tool_result',
      custom_tool_use_id: 'tu_99',
      content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'invalid input' }) }],
      is_error: true,
    });
  });
});
