// Cowork Agent for kintone — #47 ACL 用 cybozu.com User API ラッパー
//
// **重要 — エンドポイントは `/v1/...` (k 無し)**:
//   - /v1/users.json / /v1/groups.json / /v1/organizations.json (全件 list、admin 権限必要)
//   - /v1/user/groups.json?code=<userCode> (自分のグループ一覧、誰でも可)
//   - /v1/user/organizations.json?code=<userCode> (自分の組織一覧、誰でも可)
// これらは kintone REST API (`/k/v1/...`) ではなく cybozu.com 共通 User API。
// 実機検証済 (probe 2026-06-07): /v1/users.json は size>=10 必須、/k/v1/... は 404。
//
// 認証は **同一オリジン cookie** で透過する。Plugin は `*.cybozu.com` で動くので
// `fetch('/v1/users.json')` で直接叩ける (`kintone.api()` は /k/v1/ 用なので使わない)。
//
// kintone runtime 不在 (Vitest) / 取得失敗時は空配列を返す。UI 側 (`AccessPicker`) は
// 「候補なし」状態を出すだけで、保存済チップは保持される。

import type { AccessAxisKind, AccessEntry } from '../access/accessControl';

// ─── 内部ユーティリティ ────────────────────────────────────────

function hasKintoneRuntime(): boolean {
  return typeof (globalThis as { kintone?: unknown }).kintone !== 'undefined';
}

/**
 * cybozu.com User API を GET で叩く。
 * `path` は `/v1/users.json` のような絶対パス。Plugin と同一オリジンで動くので
 * cookie 認証が透過する。
 */
async function getJson(path: string, query?: Record<string, string | number>): Promise<unknown> {
  const url = query
    ? `${path}?${new URLSearchParams(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ).toString()}`
    : path;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}`);
  }
  return res.json();
}

/**
 * 全件取得 (offset paging)。cybozu.com User API は size=100 が上限、size>=10 が必須。
 * 1000 件超のテナントは Phase 1 ではサポート外 (Phase 2 で再設計)。
 */
async function fetchAllPages(
  path: string,
  arrayKey: 'users' | 'groups' | 'organizations',
): Promise<Array<Record<string, unknown>>> {
  if (!hasKintoneRuntime()) return [];
  const PAGE_SIZE = 100;
  const MAX_PAGES = 10; // 安全弁: 1000 件まで
  const all: Array<Record<string, unknown>> = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    try {
      const res = await getJson(path, { size: PAGE_SIZE, offset: i * PAGE_SIZE });
      const obj = res as Record<string, unknown>;
      const arr = obj[arrayKey];
      if (!Array.isArray(arr) || arr.length === 0) break;
      all.push(...(arr as Array<Record<string, unknown>>));
      if (arr.length < PAGE_SIZE) break;
    } catch {
      // 1 ページでも失敗したらそこまでの結果を返す (= partial OK)
      break;
    }
  }
  return all;
}

// ─── 現ユーザーの所属取得 ───────────────────────────────────────

/** 現ユーザーが属するグループコード一覧 (失敗時は [])。エンドユーザー権限で OK。 */
export async function fetchCurrentUserGroups(userCode: string): Promise<string[]> {
  if (!hasKintoneRuntime()) return [];
  try {
    const res = await getJson('/v1/user/groups.json', { code: userCode });
    const groups = (res as { groups?: Array<{ code?: string }> }).groups;
    if (!Array.isArray(groups)) return [];
    return groups
      .map((g) => g.code)
      .filter((c): c is string => typeof c === 'string' && c.length > 0);
  } catch {
    return [];
  }
}

/** 現ユーザーが属する組織コード一覧 (失敗時は [])。エンドユーザー権限で OK。 */
export async function fetchCurrentUserOrganizations(userCode: string): Promise<string[]> {
  if (!hasKintoneRuntime()) return [];
  try {
    const res = await getJson('/v1/user/organizations.json', { code: userCode });
    // organizationTitles: [{ organization: { code, name }, title: {...} }]
    const orgs = (
      res as {
        organizationTitles?: Array<{ organization?: { code?: string } }>;
      }
    ).organizationTitles;
    if (!Array.isArray(orgs)) return [];
    return orgs
      .map((o) => o.organization?.code)
      .filter((c): c is string => typeof c === 'string' && c.length > 0);
  } catch {
    return [];
  }
}

// ─── ディレクトリ全件キャッシュ + substring 検索 ────────────────

let userCache: AccessEntry[] | null = null;
let groupCache: AccessEntry[] | null = null;
let organizationCache: AccessEntry[] | null = null;

async function getUserDirectory(): Promise<AccessEntry[]> {
  if (userCache) return userCache;
  const all = await fetchAllPages('/v1/users.json', 'users');
  userCache = all
    .map<AccessEntry | null>((u) => {
      const code = typeof u.code === 'string' ? u.code : '';
      const name = typeof u.name === 'string' ? u.name : code;
      if (!code) return null;
      const email = typeof u.email === 'string' && u.email.length > 0 ? u.email : undefined;
      return email ? { code, name, meta: email } : { code, name };
    })
    .filter((e): e is AccessEntry => e !== null);
  return userCache;
}

async function getGroupDirectory(): Promise<AccessEntry[]> {
  if (groupCache) return groupCache;
  const all = await fetchAllPages('/v1/groups.json', 'groups');
  groupCache = all
    .map<AccessEntry | null>((g) => {
      const code = typeof g.code === 'string' ? g.code : '';
      const name = typeof g.name === 'string' ? g.name : code;
      if (!code) return null;
      return { code, name };
    })
    .filter((e): e is AccessEntry => e !== null);
  return groupCache;
}

async function getOrganizationDirectory(): Promise<AccessEntry[]> {
  if (organizationCache) return organizationCache;
  const all = await fetchAllPages('/v1/organizations.json', 'organizations');
  organizationCache = all
    .map<AccessEntry | null>((o) => {
      const code = typeof o.code === 'string' ? o.code : '';
      const name = typeof o.name === 'string' ? o.name : code;
      if (!code) return null;
      const parent =
        typeof o.parentCode === 'string' && o.parentCode.length > 0
          ? `→ ${o.parentCode}`
          : undefined;
      return parent ? { code, name, meta: parent } : { code, name };
    })
    .filter((e): e is AccessEntry => e !== null);
  return organizationCache;
}

const SEARCH_LIMIT = 10;

function filterByQuery(
  entries: readonly AccessEntry[],
  query: string,
  exclude: readonly string[],
): AccessEntry[] {
  const q = query.trim().toLowerCase();
  const excludeSet = new Set(exclude);
  const out: AccessEntry[] = [];
  for (const e of entries) {
    if (excludeSet.has(e.code)) continue;
    if (q.length === 0 || matchEntry(e, q)) {
      out.push(e);
      if (out.length >= SEARCH_LIMIT) break;
    }
  }
  return out;
}

function matchEntry(entry: AccessEntry, q: string): boolean {
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.code.toLowerCase().includes(q)) return true;
  if (entry.meta && entry.meta.toLowerCase().includes(q)) return true;
  return false;
}

/** ユーザーディレクトリの incremental search (失敗時は []) */
export async function searchUsers(
  query: string,
  opts: { exclude: readonly string[] },
): Promise<AccessEntry[]> {
  try {
    const dir = await getUserDirectory();
    return filterByQuery(dir, query, opts.exclude);
  } catch {
    return [];
  }
}

export async function searchGroups(
  query: string,
  opts: { exclude: readonly string[] },
): Promise<AccessEntry[]> {
  try {
    const dir = await getGroupDirectory();
    return filterByQuery(dir, query, opts.exclude);
  } catch {
    return [];
  }
}

export async function searchOrganizations(
  query: string,
  opts: { exclude: readonly string[] },
): Promise<AccessEntry[]> {
  try {
    const dir = await getOrganizationDirectory();
    return filterByQuery(dir, query, opts.exclude);
  } catch {
    return [];
  }
}

/**
 * AccessPicker.resolveEntries 用: 既に保存済の code を name 付き AccessEntry に解決する。
 * キャッシュ済ディレクトリから lookup する。未知 code は除外。
 */
export async function resolveAccessEntries(
  kind: AccessAxisKind,
  codes: readonly string[],
): Promise<AccessEntry[]> {
  if (codes.length === 0) return [];
  try {
    const dir =
      kind === 'user'
        ? await getUserDirectory()
        : kind === 'group'
          ? await getGroupDirectory()
          : await getOrganizationDirectory();
    const map = new Map(dir.map((e) => [e.code, e] as const));
    return codes
      .map((c) => map.get(c))
      .filter((e): e is AccessEntry => e !== undefined);
  } catch {
    return [];
  }
}

/** テスト用: モジュールキャッシュをクリア */
export function _resetUsersCache(): void {
  userCache = null;
  groupCache = null;
  organizationCache = null;
}
