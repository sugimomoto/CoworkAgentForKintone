import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { jsonResponse, makeSession } from '../../test/fixtures';

import { createUserSession, listUserSessions } from './resolveSession';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CTX = {
  agentId: 'agent_default',
  environmentId: 'env_1',
  kintoneDomain: 'example.cybozu.com',
  kintoneUserCode: 'sato',
};

describe('createUserSession', () => {
  it('Session を新規作成し、metadata と title を付与する', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSession({ id: 'sess_new' }), 201));

    const result = await createUserSession(CTX);

    expect(result.id).toBe('sess_new');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/sessions');
    expect((init as RequestInit).method).toBe('POST');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.agent).toBe('agent_default');
    expect(body.environment_id).toBe('env_1');
    expect(body.metadata).toEqual({
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
      agentId: 'agent_default',
    });
    expect(body.title).toMatch(/^新規会話 - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

describe('createUserSession (vault_ids)', () => {
  it('vaultId を指定すると vault_ids: [vaultId] が POST body に含まれる', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSession({ id: 'sess_v' }), 201));

    await createUserSession({
      ...CTX,
      vaultId: 'vault_x',
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.vault_ids).toEqual(['vault_x']);
  });

  it('vaultId 未指定なら vault_ids は body に含まれない (alpha 互換)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSession(), 201));

    await createUserSession(CTX);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.vault_ids).toBeUndefined();
  });
});

describe('listUserSessions', () => {
  it('agent_id + order=desc + limit=100 で listSessions を呼ぶ', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));

    await listUserSessions({
      agentId: 'agent_default',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/v1/sessions');
    expect(url).toContain('agent_id=agent_default');
    expect(url).toContain('order=desc');
    expect(url).toContain('limit=100');
  });

  it('一致する Session を新しい順 (API レスポンス順) で返す', async () => {
    const s1 = makeSession({ id: 'sess_1', created_at: '2026-04-25T10:00:00Z' });
    const s2 = makeSession({ id: 'sess_2', created_at: '2026-04-25T09:00:00Z' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [s1, s2], next_page: null }));

    const result = await listUserSessions({
      agentId: 'agent_default',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    });

    expect(result.map((s) => s.id)).toEqual(['sess_1', 'sess_2']);
  });

  it('他ユーザー / 他ドメイン / 他 source の Session を除外する', async () => {
    const mine = makeSession({ id: 'mine' });
    const otherUser = makeSession({
      id: 'other_user',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'tanaka',
        agentId: 'agent_default',
      },
    });
    const otherDomain = makeSession({
      id: 'other_domain',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'another.cybozu.com',
        kintoneUserCode: 'sato',
        agentId: 'agent_default',
      },
    });
    const otherSource = makeSession({
      id: 'other_source',
      metadata: {
        source: 'someone-else',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'sato',
        agentId: 'agent_default',
      },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [mine, otherUser, otherDomain, otherSource], next_page: null }),
    );

    const result = await listUserSessions({
      agentId: 'agent_default',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    });

    expect(result.map((s) => s.id)).toEqual(['mine']);
  });
});
