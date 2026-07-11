// Cowork Agent for kintone — Memory Stores API クライアント (#15)
//
// Anthropic Managed Agents の Memory Store CRUD。既存 resources.ts と同じく
// apiRequest の薄いラッパだが、**memory store 系だけ beta ヘッダを
// `agent-memory-2026-07-22` に置換**して送る (session attach 側の
// `managed-agents-2026-04-01` と混ぜると 400 になるため)。
//
// API 正本: .claude/skills/ClaudeManagedAgents/references/memory.md

import { MEMORY_AGENTS_BETA } from '../constants';

import { ApiError, apiRequest } from './client';

import type {
  ListResponse,
  ManagedAgentsMetadata,
  Memory,
  MemoryListItem,
  MemoryStore,
} from './types';

/** memory store 系呼出に必ず付ける beta ヘッダ (単独で置換)。 */
const MEMORY_HEADERS = { 'anthropic-beta': MEMORY_AGENTS_BETA } as const;

function buildQuery(params?: object): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

async function memGet<T>(path: string): Promise<T> {
  const result = await apiRequest<T>('GET', path, undefined, { ...MEMORY_HEADERS });
  if (result === null) throw new Error(`Unexpected null response from GET ${path}`);
  return result;
}

async function memPost<T>(path: string, body: unknown): Promise<T> {
  const result = await apiRequest<T>('POST', path, body, { ...MEMORY_HEADERS });
  if (result === null) throw new Error(`Unexpected null response from POST ${path}`);
  return result;
}

// ----- Memory Store ---------------------------------------------------------

export interface CreateMemoryStoreParams {
  name: string;
  description?: string;
  metadata?: ManagedAgentsMetadata;
}

export interface ListMemoryStoresParams {
  include_archived?: boolean;
}

export function createMemoryStore(params: CreateMemoryStoreParams): Promise<MemoryStore> {
  return memPost<MemoryStore>('/v1/memory_stores', params);
}

export function listMemoryStores(
  params?: ListMemoryStoresParams,
): Promise<ListResponse<MemoryStore>> {
  return memGet<ListResponse<MemoryStore>>(`/v1/memory_stores${buildQuery(params)}`);
}

export function retrieveMemoryStore(id: string): Promise<MemoryStore> {
  return memGet<MemoryStore>(`/v1/memory_stores/${id}`);
}

export function updateMemoryStore(
  id: string,
  params: { name?: string; description?: string },
): Promise<MemoryStore> {
  return memPost<MemoryStore>(`/v1/memory_stores/${id}`, params);
}

/** archive は片道 (unarchive 不可)。 */
export async function archiveMemoryStore(id: string): Promise<void> {
  await apiRequest<unknown>('POST', `/v1/memory_stores/${id}/archive`, {}, { ...MEMORY_HEADERS });
}

// ----- Memory (store 配下) --------------------------------------------------

export interface ListMemoriesParams {
  /** 末尾 '/' 必須・path セグメント単位で一致。 */
  path_prefix?: string;
  /** 省略/0 = 配下サブツリー全部、1 = 直下のみ。 */
  depth?: 0 | 1;
  /** basic = メタのみ / full = content も含む。 */
  view?: 'basic' | 'full';
  order_by?: string;
}

export function listMemories(
  storeId: string,
  params?: ListMemoriesParams,
): Promise<ListResponse<MemoryListItem>> {
  return memGet<ListResponse<MemoryListItem>>(
    `/v1/memory_stores/${storeId}/memories${buildQuery(params)}`,
  );
}

export function createMemory(
  storeId: string,
  params: { path: string; content: string },
): Promise<Memory> {
  return memPost<Memory>(`/v1/memory_stores/${storeId}/memories`, params);
}

export function retrieveMemory(
  storeId: string,
  memoryId: string,
  params?: { view?: 'basic' | 'full' },
): Promise<Memory> {
  return memGet<Memory>(
    `/v1/memory_stores/${storeId}/memories/${memoryId}${buildQuery(params)}`,
  );
}

export interface UpdateMemoryParams {
  content?: string;
  /** path 変更 (rename)。 */
  path?: string;
  /** 楽観ロック。直前 retrieve の content_sha256 を載せる。 */
  precondition?: { type: 'content_sha256'; content_sha256: string };
}

export function updateMemory(
  storeId: string,
  memoryId: string,
  params: UpdateMemoryParams,
): Promise<Memory> {
  return memPost<Memory>(`/v1/memory_stores/${storeId}/memories/${memoryId}`, params);
}

export async function deleteMemory(storeId: string, memoryId: string): Promise<void> {
  await apiRequest<unknown>(
    'DELETE',
    `/v1/memory_stores/${storeId}/memories/${memoryId}`,
    undefined,
    { ...MEMORY_HEADERS },
  );
}

// ----- エラー判定ヘルパー ---------------------------------------------------

/** ApiError から Anthropic のエラー type コードを取り出す。 */
function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const body = err.body as { error?: { type?: unknown } } | undefined;
  const type = body?.error?.type;
  return typeof type === 'string' ? type : undefined;
}

/** content_sha256 precondition 不一致 (楽観ロック衝突)。編集保存の 409 判定に使う。 */
export function isPreconditionFailed(err: unknown): boolean {
  return errorCode(err) === 'memory_precondition_failed_error';
}

/**
 * path 衝突 (create / rename で既存 path)。冪等 seed で握りつぶす判定に使う。
 * precondition 失敗も 409 だが type が異なるので、そちらは除外する。
 */
export function isPathConflict(err: unknown): boolean {
  const code = errorCode(err);
  if (code === 'memory_path_conflict_error') return true;
  // body が壊れて type を取れない proxy 経由の保険: 409 かつ precondition でない
  return err instanceof ApiError && err.status === 409 && !isPreconditionFailed(err);
}
