import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createAgent,
  createEnvironment,
  createSession,
  createVault,
  filterByMetadata,
  findByMetadata,
  listAgents,
  listAll,
  listEnvironments,
  listSessions,
  listVaults,
  retrieveAgent,
  retrieveSession,
} from './resources';

import type { Agent, Environment, ListResponse, Session, Vault } from './types';

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

describe('listAgents', () => {
  it('GET /v1/agents を呼び、ListResponse を返す', async () => {
    const expected: ListResponse<Agent> = { data: [], next_page: null };
    fetchMock.mockResolvedValue(jsonResponse(expected));

    const result = await listAgents();

    expect(result).toEqual(expected);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.anthropic.com/v1/agents');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('GET');
  });

  it('クエリパラメータをエンコードして送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));

    await listAgents({ limit: 50, page: 'tok123', include_archived: true });

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('limit=50');
    expect(url).toContain('page=tok123');
    expect(url).toContain('include_archived=true');
  });
});

describe('createAgent', () => {
  it('POST /v1/agents に body を送る', async () => {
    const created = { id: 'agent_1', name: 'X', type: 'agent' } as unknown as Agent;
    fetchMock.mockResolvedValue(jsonResponse(created, 201));

    const params = {
      model: 'claude-sonnet-4-6',
      name: 'X',
      metadata: { source: 'cowork-agent-for-kintone' },
    };
    const result = await createAgent(params);

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/agents');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe(JSON.stringify(params));
  });
});

describe('retrieveAgent', () => {
  it('GET /v1/agents/{id} を呼ぶ', async () => {
    const agent = { id: 'agent_1', name: 'X', type: 'agent' } as unknown as Agent;
    fetchMock.mockResolvedValue(jsonResponse(agent));

    const result = await retrieveAgent('agent_1');

    expect(result).toEqual(agent);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.anthropic.com/v1/agents/agent_1');
  });
});

describe('Environments', () => {
  it('listEnvironments は GET /v1/environments を呼ぶ', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));
    await listEnvironments();
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.anthropic.com/v1/environments');
  });

  it('createEnvironment は POST /v1/environments に body を送る', async () => {
    const created = { id: 'env_1', type: 'environment' } as unknown as Environment;
    fetchMock.mockResolvedValue(jsonResponse(created, 201));
    const params = {
      name: 'cowork',
      config: {
        type: 'cloud' as const,
        networking: { type: 'limited' as const, allowed_hosts: ['example.cybozu.com'] },
      },
      metadata: { source: 'cowork-agent-for-kintone' },
    };
    const result = await createEnvironment(params);
    expect(result).toEqual(created);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(params));
  });
});

describe('Vaults', () => {
  it('listVaults は GET /v1/vaults を呼ぶ', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));
    await listVaults();
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.anthropic.com/v1/vaults');
  });

  it('createVault は display_name と metadata を POST する', async () => {
    const created = { id: 'vault_1', type: 'vault' } as unknown as Vault;
    fetchMock.mockResolvedValue(jsonResponse(created, 201));
    const params = { display_name: 'Cowork - sato@example.cybozu.com', metadata: { source: 'x' } };
    const result = await createVault(params);
    expect(result).toEqual(created);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe(JSON.stringify(params));
  });

  // setVaultKeys テストは削除 (Phase 1b-2 改訂で createVaultCredential に置換、P1 で再追加)
});

describe('Sessions', () => {
  it('listSessions は GET /v1/sessions に agent_id クエリを付ける', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], next_page: null }));
    await listSessions({ agent_id: 'agent_1', order: 'desc' });
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/v1/sessions');
    expect(url).toContain('agent_id=agent_1');
    expect(url).toContain('order=desc');
  });

  it('createSession は agent / environment_id / vault_ids を POST する', async () => {
    const created = { id: 'sess_1', type: 'session' } as unknown as Session;
    fetchMock.mockResolvedValue(jsonResponse(created, 201));
    const params = {
      agent: 'agent_1',
      environment_id: 'env_1',
      vault_ids: ['vault_1'],
      metadata: { source: 'x' },
    };
    const result = await createSession(params);
    expect(result).toEqual(created);
  });

  it('retrieveSession は GET /v1/sessions/{id} を呼ぶ', async () => {
    const sess = { id: 'sess_1', type: 'session' } as unknown as Session;
    fetchMock.mockResolvedValue(jsonResponse(sess));
    await retrieveSession('sess_1');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.anthropic.com/v1/sessions/sess_1');
  });
});

describe('listAll (auto-pagination)', () => {
  it('next_page が無くなるまでページングして全件返す', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'a1' }, { id: 'a2' }], next_page: 'page2' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'a3' }], next_page: null }),
      );

    const result = await listAll((page) =>
      listAgents(page === undefined ? {} : { page }) as unknown as Promise<ListResponse<{ id: string }>>,
    );

    expect(result).toEqual([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('next_page が null なら 1 ページで終わる', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: 'x' }], next_page: null }));
    const result = await listAll((page) =>
      listAgents(page === undefined ? {} : { page }) as unknown as Promise<ListResponse<{ id: string }>>,
    );
    expect(result).toEqual([{ id: 'x' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('filterByMetadata', () => {
  const items = [
    { id: '1', metadata: { source: 'cowork-agent-for-kintone', type: 'default' } },
    { id: '2', metadata: { source: 'cowork-agent-for-kintone', type: 'custom' } },
    { id: '3', metadata: { source: 'other' } },
    { id: '4', metadata: {} },
  ];

  it('全条件にマッチするアイテムだけを返す', () => {
    const result = filterByMetadata(items, { source: 'cowork-agent-for-kintone', type: 'default' });
    expect(result).toEqual([items[0]]);
  });

  it('1 条件で複数マッチ', () => {
    const result = filterByMetadata(items, { source: 'cowork-agent-for-kintone' });
    expect(result).toEqual([items[0], items[1]]);
  });

  it('空の条件はすべて返す', () => {
    expect(filterByMetadata(items, {})).toEqual(items);
  });

  it('metadata なしのアイテムには空条件以外マッチしない', () => {
    const result = filterByMetadata(items, { source: 'x' });
    expect(result).toEqual([]);
  });
});

describe('findByMetadata (listAll + filterByMetadata の統合ヘルパ)', () => {
  it('全ページ取得してクライアント側でフィルタする', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: 'a1', metadata: { source: 'cowork-agent-for-kintone' } },
            { id: 'a2', metadata: { source: 'other' } },
          ],
          next_page: 'page2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 'a3', metadata: { source: 'cowork-agent-for-kintone' } }],
          next_page: null,
        }),
      );

    const result = await findByMetadata(
      (page) =>
        listAgents({ page }) as unknown as Promise<
          ListResponse<{ id: string; metadata: Record<string, string> }>
        >,
      { source: 'cowork-agent-for-kintone' },
    );

    expect(result.map((r) => r.id)).toEqual(['a1', 'a3']);
  });

  it('空の criteria なら全件返す', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: 'a1', metadata: {} }, { id: 'a2', metadata: { x: 'y' } }],
        next_page: null,
      }),
    );

    const result = await findByMetadata(
      (page) =>
        listAgents({ page }) as unknown as Promise<
          ListResponse<{ id: string; metadata: Record<string, string> }>
        >,
      {},
    );

    expect(result).toHaveLength(2);
  });
});
