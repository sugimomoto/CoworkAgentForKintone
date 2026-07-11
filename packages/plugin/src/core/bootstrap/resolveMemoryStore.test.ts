import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { resetTransport, setTransport } from '../managed-agents/client';

import {
  _resetResolveMemoryStoreCache,
  resolveAgentContextStore,
  resolveMemoryResources,
  resolveUserPreferencesStore,
} from './resolveMemoryStore';

type Call = { method: string; url: string; body: unknown };
let calls: Call[];
let stores: Array<{ id: string; name: string; type: 'memory_store'; created_at: string; archived_at: null }>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// 疑似 API: memory_stores の list/create と memories の create を最小実装
function install(): void {
  setTransport((url, init) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });
    // create memory (seed)
    if (/\/memories$/.test(url) && method === 'POST') {
      return Promise.resolve(json({ id: 'mem_x', type: 'memory', path: body.path, content_sha256: 's', content_size_bytes: 1 }));
    }
    // create store
    if (/\/v1\/memory_stores$/.test(url) && method === 'POST') {
      const s = { id: `memstore_${stores.length + 1}`, name: body.name, type: 'memory_store' as const, created_at: '2026-07-11T00:00:00Z', archived_at: null };
      stores.push(s);
      return Promise.resolve(json(s));
    }
    // list stores
    if (/\/v1\/memory_stores(\?|$)/.test(url) && method === 'GET') {
      return Promise.resolve(json({ data: stores, next_page: null }));
    }
    return Promise.resolve(json({ error: { message: 'unexpected' } }, 500));
  });
}

beforeEach(() => {
  calls = [];
  stores = [];
  _resetResolveMemoryStoreCache();
  install();
});
afterEach(() => {
  resetTransport();
  _resetResolveMemoryStoreCache();
});

const ctx = { kintoneDomain: 'acme.cybozu.com', kintoneUserCode: 'sato' };

describe('resolveUserPreferencesStore', () => {
  it('既存 store があれば再利用し、作成も seed もしない', async () => {
    stores.push({ id: 'memstore_pref', name: 'cowork:pref:acme.cybozu.com:sato', type: 'memory_store', created_at: '2026-01-01T00:00:00Z', archived_at: null });
    const store = await resolveUserPreferencesStore(ctx);
    expect(store.id).toBe('memstore_pref');
    expect(calls.some((c) => c.method === 'POST' && /\/v1\/memory_stores$/.test(c.url))).toBe(false);
    expect(calls.some((c) => /\/memories$/.test(c.url))).toBe(false);
  });

  it('無ければ作成し、seed ファイルを create する', async () => {
    const store = await resolveUserPreferencesStore(ctx);
    expect(store.name).toBe('cowork:pref:acme.cybozu.com:sato');
    // create store が呼ばれた
    expect(calls.some((c) => c.method === 'POST' && /\/v1\/memory_stores$/.test(c.url))).toBe(true);
    // seed 2 ファイル
    const seedPosts = calls.filter((c) => /\/memories$/.test(c.url) && c.method === 'POST');
    expect(seedPosts.map((c) => (c.body as { path: string }).path)).toEqual([
      '/preferences/general.md',
      '/preferences/field-aliases.md',
    ]);
  });

  it('連続呼出（in-flight）でも 1 回しか作成しない', async () => {
    const [a, b] = await Promise.all([
      resolveUserPreferencesStore(ctx),
      resolveUserPreferencesStore(ctx),
    ]);
    expect(a.id).toBe(b.id);
    const creates = calls.filter((c) => c.method === 'POST' && /\/v1\/memory_stores$/.test(c.url));
    expect(creates).toHaveLength(1);
  });
});

describe('resolveAgentContextStore', () => {
  it('name に agentId を含め、ユーザー/エージェントごとに分離する', async () => {
    const store = await resolveAgentContextStore({ ...ctx, agentId: 'agent_biz' });
    expect(store.name).toBe('cowork:agentctx:acme.cybozu.com:sato:agent_biz');
    const seedPosts = calls.filter((c) => /\/memories$/.test(c.url) && c.method === 'POST');
    expect(seedPosts.map((c) => (c.body as { path: string }).path)).toEqual([
      '/context/notes.md',
      '/context/past-corrections.md',
    ]);
  });

  it('別ユーザーは別 store 名になる', async () => {
    const s1 = await resolveAgentContextStore({ ...ctx, agentId: 'agent_biz' });
    _resetResolveMemoryStoreCache();
    const s2 = await resolveAgentContextStore({ kintoneDomain: 'acme.cybozu.com', kintoneUserCode: 'tanaka', agentId: 'agent_biz' });
    expect(s1.name).not.toBe(s2.name);
  });
});

describe('resolveMemoryResources', () => {
  it('2 store を解決し read_write の resources[] を返す', async () => {
    const res = await resolveMemoryResources({ ...ctx, agentId: 'agent_biz' });
    expect(res).toHaveLength(2);
    expect(res.every((r) => r.type === 'memory_store' && r.access === 'read_write')).toBe(true);
    expect(res.every((r) => typeof r.instructions === 'string' && r.instructions.length > 0)).toBe(true);
  });

  it('片方の store 解決が失敗しても、成功した分だけ返す（会話は止めない）', async () => {
    // create store を失敗させる → find も空なので両方 throw → catch で除外
    setTransport((url, init) => {
      const method = init.method ?? 'GET';
      if (/\/v1\/memory_stores$/.test(url) && method === 'POST') {
        return Promise.resolve(json({ error: { message: 'boom' } }, 500));
      }
      if (/\/v1\/memory_stores(\?|$)/.test(url) && method === 'GET') {
        // preferences は既存を返す・agent-context は無し
        return Promise.resolve(json({ data: [{ id: 'memstore_pref', name: 'cowork:pref:acme.cybozu.com:sato', type: 'memory_store', created_at: '2026-01-01T00:00:00Z', archived_at: null }], next_page: null }));
      }
      return Promise.resolve(json({ error: { message: 'x' } }, 500));
    });
    const res = await resolveMemoryResources({ ...ctx, agentId: 'agent_biz' });
    expect(res).toHaveLength(1);
    expect(res[0]!.memory_store_id).toBe('memstore_pref');
  });
});
