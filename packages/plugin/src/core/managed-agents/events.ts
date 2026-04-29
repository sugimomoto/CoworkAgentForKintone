// Cowork Agent for kintone — Session のイベント送受信
//
// kintone.proxy は SSE 非対応のため、ポーリング方式で実装する。
// `since` カーソルは Managed Agents API 未サポートのため、
// クライアント側で「既知の最後のイベント ID」と突合して差分を抽出する。

import { debug } from '../debug';

import { apiRequest } from './client';

import type { ListResponse, SessionEvent } from './types';

// ----- メッセージ送信 -------------------------------------------------------

/** ユーザーメッセージのコンテンツ (Anthropic API 形式) */
export type UserMessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: string; [k: string]: unknown }>;

/** ユーザーメッセージを Session に送る (POST /v1/sessions/{id}/events) */
export async function postUserMessage(
  sessionId: string,
  content: UserMessageContent,
): Promise<void> {
  const normalized: Array<{ type: string; [k: string]: unknown }> =
    typeof content === 'string' ? [{ type: 'text', text: content }] : content;

  await apiRequest('POST', `/v1/sessions/${sessionId}/events`, {
    events: [
      {
        type: 'user.message',
        content: normalized,
      },
    ],
  });
}

/** Agent の進行中ターンを中断する (Anthropic 側で `user.interrupt` を送る) */
export async function postUserInterrupt(sessionId: string): Promise<void> {
  await apiRequest('POST', `/v1/sessions/${sessionId}/events`, {
    events: [{ type: 'user.interrupt' }],
  });
}

/**
 * `permission_policy: always_ask` のツール実行に対して許可 / 拒否を返す。
 * 拒否時は `denyMessage` を Agent に渡せる (任意)。
 */
export async function postToolConfirmation(
  sessionId: string,
  toolUseId: string,
  result: 'allow' | 'deny',
  denyMessage?: string,
): Promise<void> {
  const event: Record<string, unknown> = {
    type: 'user.tool_confirmation',
    tool_use_id: toolUseId,
    result,
  };
  if (result === 'deny' && denyMessage) event['deny_message'] = denyMessage;

  await apiRequest('POST', `/v1/sessions/${sessionId}/events`, {
    events: [event],
  });
}

/**
 * Custom Tool (e.g. create_artifact) の結果を Agent に返す。
 *
 * `agent.custom_tool_use` を観測した plugin が、対応する `user.custom_tool_result` を
 * 投げないと session.status_idle (stop_reason='custom_tool_use') のままターンが止まる。
 * 内容は文字列 (JSON 文字列を推奨)。
 */
export async function postCustomToolResult(
  sessionId: string,
  toolUseId: string,
  result: { ok: true; artifactId: string } | { ok: false; error: string },
): Promise<void> {
  // Anthropic Managed Agents API は content を **content block の配列**で要求する。
  // 単純文字列を送ると `events.0.content: value must be an array` で 400 になる。
  const text = result.ok
    ? JSON.stringify({ ok: true, artifactId: result.artifactId })
    : JSON.stringify({ ok: false, error: result.error });
  const body = {
    events: [
      {
        type: 'user.custom_tool_result',
        custom_tool_use_id: toolUseId,
        content: [{ type: 'text', text }],
        is_error: !result.ok,
      },
    ],
  };
  debug('CustomTool', 'POST /events (user.custom_tool_result)', {
    sessionId,
    toolUseId,
    ok: result.ok,
  });
  await apiRequest('POST', `/v1/sessions/${sessionId}/events`, body);
}

// ----- イベント取得 ---------------------------------------------------------

export interface ListEventsParams {
  limit?: number;
  page?: string;
  order?: 'asc' | 'desc';
}

function buildEventsQuery(params?: ListEventsParams): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

/** Session のイベントを 1 ページ取得する */
export async function listEvents(
  sessionId: string,
  params?: ListEventsParams,
): Promise<ListResponse<SessionEvent>> {
  const result = await apiRequest<ListResponse<SessionEvent>>(
    'GET',
    `/v1/sessions/${sessionId}/events${buildEventsQuery(params)}`,
  );
  if (result === null) {
    throw new Error('Unexpected null response from listEvents');
  }
  return result;
}

/**
 * Session のイベント差分を取得する。
 *
 * - `sinceEventId === undefined`: 全イベントを (asc 順で) 返す (初回ロード)
 * - `sinceEventId` が指定されたとき: desc 順でページを walk し `sinceEventId` に到達したら停止、
 *   それより後のイベントだけ asc 順で返す。長期 Session で全件 asc 取得して破棄する無駄を避ける。
 * - `sinceEventId` が見つからない場合: 全件返す (新規セッション扱い)
 *
 * @param sessionId 対象 Session ID
 * @param sinceEventId 既知の最後のイベント ID
 */
const PAGE_LIMIT = 100;
const MAX_PAGES = 100; // 安全弁: 10,000 件まで walk-back

export async function fetchAllEventsSince(
  sessionId: string,
  sinceEventId: string | undefined,
): Promise<SessionEvent[]> {
  if (sinceEventId === undefined) {
    return await fetchAllAscending(sessionId);
  }

  const newer: SessionEvent[] = [];
  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await listEvents(sessionId, {
      order: 'desc',
      limit: PAGE_LIMIT,
      ...(page ? { page } : {}),
    });
    for (const evt of res.data) {
      if (evt.id === sinceEventId) {
        return newer.reverse();
      }
      newer.push(evt);
    }
    if (!res.next_page) break;
    page = res.next_page;
  }
  // sinceEventId が見つからなかった: 安全側で全件返す (asc 順で取り直し)
  return await fetchAllAscending(sessionId);
}

async function fetchAllAscending(sessionId: string): Promise<SessionEvent[]> {
  const all: SessionEvent[] = [];
  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await listEvents(sessionId, {
      order: 'asc',
      limit: PAGE_LIMIT,
      ...(page ? { page } : {}),
    });
    all.push(...res.data);
    if (!res.next_page) break;
    page = res.next_page;
  }
  return all;
}
