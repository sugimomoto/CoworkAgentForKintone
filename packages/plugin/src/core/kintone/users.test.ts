// kintone users.ts のテスト (#47)
//
// cybozu.com User API (/v1/...) を fetch で叩く実装。
// hasKintoneRuntime() で kintone runtime の有無を判定するため、
// テストでは globalThis.kintone を疑似 set してから fetch を mock する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetUsersCache,
  fetchCurrentUserGroups,
  fetchCurrentUserOrganizations,
  resolveAccessEntries,
  searchGroups,
  searchOrganizations,
  searchUsers,
} from './users';

let fetchMock: ReturnType<typeof vi.fn>;

function mockJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  _resetUsersCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // hasKintoneRuntime() が true を返すよう疑似 set
  (globalThis as { kintone?: unknown }).kintone = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { kintone?: unknown }).kintone;
});

describe('fetchCurrentUserGroups (/v1/user/groups.json)', () => {
  it('200 で groups[].code を抽出', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        groups: [
          { id: '1', code: 'sales-dept', name: '営業部' },
          { id: '2', code: 'managers', name: 'マネージャー' },
        ],
      }),
    );
    const result = await fetchCurrentUserGroups('sato');
    expect(result).toEqual(['sales-dept', 'managers']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/v1/user/groups.json?code=sato');
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('reject (HTTP 500) → []', async () => {
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 500 }));
    expect(await fetchCurrentUserGroups('sato')).toEqual([]);
  });

  it('groups が配列でない → []', async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ groups: null }));
    expect(await fetchCurrentUserGroups('sato')).toEqual([]);
  });

  it('kintone runtime 不在 → fetch 呼ばずに []', async () => {
    delete (globalThis as { kintone?: unknown }).kintone;
    expect(await fetchCurrentUserGroups('sato')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchCurrentUserOrganizations (/v1/user/organizations.json)', () => {
  it('organizationTitles から code を抽出', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        organizationTitles: [
          { organization: { code: 'org-tokyo', name: '東京' }, title: {} },
          { organization: { code: 'org-sales', name: '営業' }, title: {} },
        ],
      }),
    );
    const result = await fetchCurrentUserOrganizations('sato');
    expect(result).toEqual(['org-tokyo', 'org-sales']);
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/user/organizations.json?code=sato',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('reject → []', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await fetchCurrentUserOrganizations('sato')).toEqual([]);
  });
});

describe('searchUsers (キャッシュ + substring 検索)', () => {
  function seedUserDirectory(): void {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        users: [
          { code: 'sato', name: '佐藤太郎', email: 'sato@example.com' },
          { code: 'tanaka', name: '田中花子', email: 'tanaka@example.com' },
          { code: 'yamada', name: '山田次郎', email: 'yamada@example.com' },
        ],
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ users: [] })); // ページ 2 で打ち切り
  }

  it('全件 fetch → substring filter で hit', async () => {
    seedUserDirectory();
    const result = await searchUsers('田中', { exclude: [] });
    expect(result.map((e) => e.code)).toEqual(['tanaka']);
  });

  it('exclude で既選択は候補から消える', async () => {
    seedUserDirectory();
    const result = await searchUsers('', { exclude: ['sato'] });
    expect(result.map((e) => e.code)).toEqual(['tanaka', 'yamada']);
  });

  it('空 query は exclude 適用後の上限まで返す', async () => {
    seedUserDirectory();
    const result = await searchUsers('', { exclude: [] });
    expect(result).toHaveLength(3);
  });

  it('2 回目の呼出はキャッシュから返す (fetch しない)', async () => {
    seedUserDirectory();
    await searchUsers('', { exclude: [] });
    const callsBefore = fetchMock.mock.calls.length;
    await searchUsers('佐藤', { exclude: [] });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('email でも hit する (meta フィールドも検索対象)', async () => {
    seedUserDirectory();
    const result = await searchUsers('yamada@example', { exclude: [] });
    expect(result.map((e) => e.code)).toEqual(['yamada']);
  });

  it('URL に size=100, offset=0 が付く', async () => {
    seedUserDirectory();
    await searchUsers('', { exclude: [] });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/v1/users.json?');
    expect(url).toContain('size=100');
    expect(url).toContain('offset=0');
  });
});

describe('searchGroups / searchOrganizations', () => {
  it('groups: 全件 fetch → 検索', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        groups: [
          { code: 'sales-dept', name: '営業部' },
          { code: 'managers', name: 'マネージャー' },
        ],
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ groups: [] }));
    const result = await searchGroups('営業', { exclude: [] });
    expect(result.map((e) => e.code)).toEqual(['sales-dept']);
    expect(fetchMock.mock.calls[0]![0]).toContain('/v1/groups.json');
  });

  it('organizations: 階層 meta を保持', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        organizations: [
          { code: 'org-tokyo', name: '東京本社' },
          { code: 'org-sales', name: '営業部', parentCode: 'org-tokyo' },
        ],
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ organizations: [] }));
    const result = await searchOrganizations('', { exclude: [] });
    expect(result[1]!.meta).toBe('→ org-tokyo');
    expect(fetchMock.mock.calls[0]![0]).toContain('/v1/organizations.json');
  });
});

describe('resolveAccessEntries', () => {
  it('既知 code を name 付きで返し、未知 code は除外', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        users: [
          { code: 'sato', name: '佐藤太郎', email: 'sato@example.com' },
          { code: 'tanaka', name: '田中花子' },
        ],
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ users: [] }));
    const result = await resolveAccessEntries('user', ['sato', 'unknown', 'tanaka']);
    expect(result.map((e) => e.code)).toEqual(['sato', 'tanaka']);
  });

  it('codes が空 → 即 [] を返し fetch は呼ばない', async () => {
    const result = await resolveAccessEntries('user', []);
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
