import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ApiError, resetTransport, setTransport } from './client';
import {
  createMemory,
  createMemoryStore,
  deleteMemory,
  isPathConflict,
  isPreconditionFailed,
  listMemories,
  listMemoryStores,
  retrieveMemory,
  updateMemory,
} from './memory';

type Call = { url: string; init: RequestInit };
let calls: Call[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mock(res: Response | (() => Response)): void {
  setTransport((url, init) => {
    calls.push({ url, init });
    return Promise.resolve(typeof res === 'function' ? res() : res);
  });
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  resetTransport();
});

const betaOf = (init: RequestInit): string | undefined =>
  (init.headers as Record<string, string>)['anthropic-beta'];

describe('memory client — beta ヘッダ', () => {
  it('全ての memory 呼出で anthropic-beta を agent-memory-2026-07-22 に置換する', async () => {
    mock(jsonResponse({ id: 'memstore_1', name: 'x', type: 'memory_store' }));
    await createMemoryStore({ name: 'x' });
    expect(betaOf(calls[0]!.init)).toBe('agent-memory-2026-07-22');
  });
});

describe('memory store CRUD', () => {
  it('createMemoryStore は POST /v1/memory_stores に name/description を送る', async () => {
    mock(jsonResponse({ id: 'memstore_1', name: 'Pref', type: 'memory_store' }));
    const store = await createMemoryStore({ name: 'Pref', description: 'desc' });
    expect(store.id).toBe('memstore_1');
    expect(calls[0]!.url).toMatch(/\/v1\/memory_stores$/);
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ name: 'Pref', description: 'desc' });
  });

  it('listMemoryStores は GET /v1/memory_stores、include_archived を query 化', async () => {
    mock(jsonResponse({ data: [], next_page: null }));
    await listMemoryStores({ include_archived: true });
    expect(calls[0]!.url).toMatch(/\/v1\/memory_stores\?include_archived=true$/);
    expect(calls[0]!.init.method).toBe('GET');
  });
});

describe('memory CRUD', () => {
  it('listMemories は path_prefix/depth/view を query 化する', async () => {
    mock(jsonResponse({ data: [], next_page: null }));
    await listMemories('memstore_1', { path_prefix: '/', depth: 1, view: 'basic' });
    expect(calls[0]!.url).toMatch(
      /\/v1\/memory_stores\/memstore_1\/memories\?path_prefix=%2F&depth=1&view=basic$/,
    );
  });

  it('createMemory は path/content を POST する', async () => {
    mock(jsonResponse({ id: 'mem_1', type: 'memory', path: '/a.md', content_sha256: 's', content_size_bytes: 1 }));
    await createMemory('memstore_1', { path: '/a.md', content: 'hi' });
    expect(calls[0]!.url).toMatch(/\/v1\/memory_stores\/memstore_1\/memories$/);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ path: '/a.md', content: 'hi' });
  });

  it('retrieveMemory は view=full を付けられる', async () => {
    mock(jsonResponse({ id: 'mem_1', type: 'memory', path: '/a.md', content: 'x', content_sha256: 's', content_size_bytes: 1 }));
    await retrieveMemory('memstore_1', 'mem_1', { view: 'full' });
    expect(calls[0]!.url).toMatch(/\/memories\/mem_1\?view=full$/);
  });

  it('updateMemory は precondition を body に載せる', async () => {
    mock(jsonResponse({ id: 'mem_1', type: 'memory', path: '/a.md', content_sha256: 's2', content_size_bytes: 2 }));
    await updateMemory('memstore_1', 'mem_1', {
      content: 'new',
      precondition: { type: 'content_sha256', content_sha256: 'abc' },
    });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      content: 'new',
      precondition: { type: 'content_sha256', content_sha256: 'abc' },
    });
  });

  it('deleteMemory は DELETE を送る', async () => {
    mock(new Response(null, { status: 204 }));
    await deleteMemory('memstore_1', 'mem_1');
    expect(calls[0]!.init.method).toBe('DELETE');
    expect(calls[0]!.url).toMatch(/\/memories\/mem_1$/);
  });
});

describe('エラー判定', () => {
  it('isPreconditionFailed は memory_precondition_failed_error を検出', () => {
    const err = new ApiError(409, 'x', { error: { type: 'memory_precondition_failed_error' } });
    expect(isPreconditionFailed(err)).toBe(true);
    expect(isPathConflict(err)).toBe(false); // precondition は path 衝突ではない
  });

  it('isPathConflict は memory_path_conflict_error を検出', () => {
    const err = new ApiError(409, 'x', { error: { type: 'memory_path_conflict_error' } });
    expect(isPathConflict(err)).toBe(true);
    expect(isPreconditionFailed(err)).toBe(false);
  });

  it('type 不明の 409 は path 衝突扱い (proxy 保険)、非 ApiError は false', () => {
    expect(isPathConflict(new ApiError(409, 'x'))).toBe(true);
    expect(isPathConflict(new Error('nope'))).toBe(false);
    expect(isPreconditionFailed(new Error('nope'))).toBe(false);
  });
});
