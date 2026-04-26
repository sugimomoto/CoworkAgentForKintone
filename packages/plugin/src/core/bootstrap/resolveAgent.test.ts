import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { jsonResponse, makeAgent } from '../../test/fixtures';

import { _resetResolveDefaultAgentCache, resolveDefaultAgent } from './resolveAgent';

import type { Agent, ListResponse } from '../managed-agents/types';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  _resetResolveDefaultAgentCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetResolveDefaultAgentCache();
});

describe('resolveDefaultAgent', () => {
  it('既存の Default Agent が見つかればそれを返す (作成しない)', async () => {
    const existing = makeAgent({ id: 'agent_existing' });
    const list: ListResponse<Agent> = { data: [existing], next_page: null };
    fetchMock.mockResolvedValueOnce(jsonResponse(list));

    const result = await resolveDefaultAgent();

    expect(result.id).toBe('agent_existing');
    // GET /v1/agents が 1 回だけ呼ばれ、POST は呼ばれていないこと
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]?.method).toBe('GET');
  });

  it('Default Agent が存在しなければ作成して返す', async () => {
    const empty: ListResponse<Agent> = { data: [], next_page: null };
    fetchMock.mockResolvedValueOnce(jsonResponse(empty));

    const created = makeAgent({ id: 'agent_new' });
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));

    // 作成後の verification list (重複なし)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [created], next_page: null }),
    );

    const result = await resolveDefaultAgent();

    expect(result.id).toBe('agent_new');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // 2 回目は POST /v1/agents
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('https://api.anthropic.com/v1/agents');
    expect((init as RequestInit).method).toBe('POST');

    // body に metadata.source / type / promptVersion が含まれること
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.metadata).toEqual({
      source: 'cowork-agent-for-kintone',
      type: 'default',
      promptVersion: 'v5',
    });
    // tools に agent_toolset_20260401 が含まれること (bash + write + read)
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBeGreaterThan(0);
    expect(body.tools[0].type).toBe('agent_toolset_20260401');
  });

  it('プラグイン外の Agent (source 違い) は無視する', async () => {
    const other = makeAgent({
      id: 'agent_other',
      metadata: { source: 'someone-else', type: 'default' },
    });
    const empty: ListResponse<Agent> = { data: [other], next_page: null };
    fetchMock.mockResolvedValueOnce(jsonResponse(empty));

    const created = makeAgent({ id: 'agent_new' });
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [other, created], next_page: null }),
    );

    const result = await resolveDefaultAgent();

    expect(result.id).toBe('agent_new');
  });

  it('type が default 以外 (custom) の Agent は無視する', async () => {
    const custom = makeAgent({
      id: 'agent_custom',
      metadata: { source: 'cowork-agent-for-kintone', type: 'custom' },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [custom], next_page: null }));
    const created = makeAgent({ id: 'agent_new' });
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [custom, created], next_page: null }),
    );

    const result = await resolveDefaultAgent();

    expect(result.id).toBe('agent_new');
  });

  it('複数ページにまたがる Agent もフィルタする', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ data: [makeAgent({ id: 'a1', metadata: { source: 'x' } })], next_page: 'page2' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [makeAgent({ id: 'a2_default' })], next_page: null }),
      );

    const result = await resolveDefaultAgent();

    expect(result.id).toBe('a2_default');
  });

  // --- 競合対策 (Default Agent の重複作成防止) -----------------------------

  it('既存 Agent が複数ある場合は最も古いもの (created_at 最小) を返す', async () => {
    const older = makeAgent({ id: 'agent_older', created_at: '2026-04-01T00:00:00Z' });
    const newer = makeAgent({ id: 'agent_newer', created_at: '2026-04-25T00:00:00Z' });
    // API default は desc なので新しい順。並べ替えが効いていれば older を返すはず
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [newer, older], next_page: null }),
    );

    const result = await resolveDefaultAgent();

    expect(result.id).toBe('agent_older');
  });

  it('作成後の verification で重複を検出したら最古の Agent を返す', async () => {
    // 初回 list: 空 → create 発火
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
    const mine = makeAgent({ id: 'agent_mine', created_at: '2026-04-25T12:00:00Z' });
    fetchMock.mockResolvedValueOnce(jsonResponse(mine, 201));
    // verification list: 他プロセスが先に作っていた古い Agent が見つかる
    const older = makeAgent({ id: 'agent_older_race', created_at: '2026-04-25T11:59:59Z' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [older, mine], next_page: null }),
    );

    const result = await resolveDefaultAgent();

    // 自分が作ったもの (mine) ではなく、race で負けた側 (older) を返す
    expect(result.id).toBe('agent_older_race');
  });

  it('同一プロセス内の並行呼び出しは 1 回だけ create する (in-flight 共有)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
    const created = makeAgent({ id: 'agent_created_once' });
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [created], next_page: null }),
    );

    const [r1, r2, r3] = await Promise.all([
      resolveDefaultAgent(),
      resolveDefaultAgent(),
      resolveDefaultAgent(),
    ]);

    expect(r1.id).toBe('agent_created_once');
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
    // list + create + verify = 3 回だけ。並行呼び出しでも増えない
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('create 失敗時は in-flight キャッシュを破棄し、次の呼び出しで再試行できる', async () => {
    // 1 回目: list 空 → create 失敗
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'server error' } }, 500),
    );

    await expect(resolveDefaultAgent()).rejects.toThrow();

    // 2 回目: 同じ流れで成功
    const success = makeAgent({ id: 'agent_retry_success' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse(success, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [success], next_page: null }),
    );

    const result = await resolveDefaultAgent();
    expect(result.id).toBe('agent_retry_success');
  });

  describe('workerUrl オプション', () => {
    it('workerUrl + kintoneDomain 指定時は /mcp/<domain> 形式の mcp_servers + mcp_toolset を含む Agent を作成', async () => {
      // list 空 → create → 検証 list
      const created = makeAgent({ id: 'agent_with_mcp' });
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
      fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [created], next_page: null }));

      await resolveDefaultAgent({
        workerUrl: 'https://worker.example.com',
        kintoneDomain: 'tenant.cybozu.com',
      });

      // create 呼出 (2 番目の fetch) の body を検証
      const createCall = fetchMock.mock.calls[1]!;
      const init = createCall[1] as RequestInit;
      const body = JSON.parse(init.body as string);

      expect(body.mcp_servers).toEqual([
        { type: 'url', name: 'kintone', url: 'https://worker.example.com/mcp/tenant.cybozu.com' },
      ]);
      const tools = body.tools as Array<{ type: string; mcp_server_name?: string }>;
      const mcpToolset = tools.find((t) => t.type === 'mcp_toolset');
      expect(mcpToolset?.mcp_server_name).toBe('kintone');
      expect(body.metadata.workerUrl).toBe('https://worker.example.com');
      expect(body.metadata.kintoneDomain).toBe('tenant.cybozu.com');
    });

    it('mcp_toolset.configs: kintone-delete-records だけ always_ask、他は always_allow', async () => {
      const created = makeAgent({ id: 'agent_with_mcp' });
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
      fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [created], next_page: null }));

      await resolveDefaultAgent({
        workerUrl: 'https://worker.example.com',
        kintoneDomain: 'tenant.cybozu.com',
      });

      const init = fetchMock.mock.calls[1]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      const mcpToolset = (body.tools as Array<{ type: string; configs?: Array<{ name: string; permission_policy: { type: string } }> }>).find(
        (t) => t.type === 'mcp_toolset',
      );
      const configs = mcpToolset?.configs ?? [];

      const policyOf = (name: string): string | undefined =>
        configs.find((c) => c.name === name)?.permission_policy.type;

      expect(policyOf('kintone-delete-records')).toBe('always_ask');
      // 残り 9 ツールは全部 always_allow
      for (const name of [
        'kintone-get-apps',
        'kintone-get-app',
        'kintone-get-form-fields',
        'kintone-get-records',
        'kintone-add-record',
        'kintone-add-records',
        'kintone-update-record',
        'kintone-update-records',
        'kintone-add-record-comment',
      ]) {
        expect(policyOf(name)).toBe('always_allow');
      }
    });

    it('workerUrl 指定が異なれば別の Agent として解決される (in-flight キャッシュも分離)', async () => {
      const a = makeAgent({
        id: 'agent_a',
        metadata: { source: 'cowork-agent-for-kintone', type: 'default', promptVersion: 'v5', workerUrl: 'https://a.example', kintoneDomain: 'a.cybozu.com' },
      });
      const b = makeAgent({
        id: 'agent_b',
        metadata: { source: 'cowork-agent-for-kintone', type: 'default', promptVersion: 'v5', workerUrl: 'https://b.example', kintoneDomain: 'b.cybozu.com' },
      });

      // a の解決: list で a が返る
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [a], next_page: null }));
      // b の解決: list で b が返る
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [b], next_page: null }));

      const ra = await resolveDefaultAgent({ workerUrl: 'https://a.example', kintoneDomain: 'a.cybozu.com' });
      const rb = await resolveDefaultAgent({ workerUrl: 'https://b.example', kintoneDomain: 'b.cybozu.com' });

      expect(ra.id).toBe('agent_a');
      expect(rb.id).toBe('agent_b');
    });
  });
});
