// Cowork Agent for kintone — Managed Agents API リソース操作
//
// Agent / Environment / Vault / Session の list / create / retrieve を提供する。
// Managed Agents API はサーバ側 metadata フィルタを未サポートのため、
// 全件取得 → クライアント側で `filterByMetadata` でフィルタするフローを取る。

import { apiRequest } from './client';

import type {
  Agent,
  Environment,
  ListResponse,
  ManagedAgentsMetadata,
  NetworkingConfig,
  PackagesConfig,
  Session,
  Vault,
} from './types';

// ----- 共通 -----------------------------------------------------------------

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

async function get<T>(path: string, params?: object): Promise<T> {
  const result = await apiRequest<T>('GET', `${path}${buildQuery(params)}`);
  if (result === null) {
    throw new Error(`Unexpected null response from GET ${path}`);
  }
  return result;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const result = await apiRequest<T>('POST', path, body);
  if (result === null) {
    throw new Error(`Unexpected null response from POST ${path}`);
  }
  return result;
}

// ----- Agents ---------------------------------------------------------------

export interface AgentsListParams {
  limit?: number | undefined;
  page?: string | undefined;
  include_archived?: boolean | undefined;
  'created_at[gte]'?: string;
  'created_at[lte]'?: string;
}

export interface CreateAgentParams {
  model: string | { id: string; speed?: 'standard' | 'fast' };
  name: string;
  description?: string;
  system?: string;
  tools?: unknown[];
  metadata?: ManagedAgentsMetadata;
}

export function listAgents(params?: AgentsListParams): Promise<ListResponse<Agent>> {
  return get<ListResponse<Agent>>('/v1/agents', params);
}

export function createAgent(params: CreateAgentParams): Promise<Agent> {
  return post<Agent>('/v1/agents', params);
}

export function retrieveAgent(id: string): Promise<Agent> {
  return get<Agent>(`/v1/agents/${id}`);
}

// ----- Environments ---------------------------------------------------------

export interface EnvironmentsListParams {
  limit?: number | undefined;
  page?: string | undefined;
  include_archived?: boolean | undefined;
}

export interface CreateEnvironmentParams {
  name: string;
  description?: string;
  config?: {
    type: 'cloud';
    networking?: NetworkingConfig;
    packages?: PackagesConfig;
  };
  metadata?: ManagedAgentsMetadata;
}

export function listEnvironments(params?: EnvironmentsListParams): Promise<ListResponse<Environment>> {
  return get<ListResponse<Environment>>('/v1/environments', params);
}

export function createEnvironment(params: CreateEnvironmentParams): Promise<Environment> {
  return post<Environment>('/v1/environments', params);
}

export function retrieveEnvironment(id: string): Promise<Environment> {
  return get<Environment>(`/v1/environments/${id}`);
}

// ----- Vaults ---------------------------------------------------------------

export interface VaultsListParams {
  limit?: number | undefined;
  page?: string | undefined;
  include_archived?: boolean | undefined;
}

export interface CreateVaultParams {
  display_name: string;
  metadata?: ManagedAgentsMetadata;
}

export function listVaults(params?: VaultsListParams): Promise<ListResponse<Vault>> {
  return get<ListResponse<Vault>>('/v1/vaults', params);
}

export function createVault(params: CreateVaultParams): Promise<Vault> {
  return post<Vault>('/v1/vaults', params);
}

export function retrieveVault(id: string): Promise<Vault> {
  return get<Vault>(`/v1/vaults/${id}`);
}

// ----- Sessions -------------------------------------------------------------

export interface SessionsListParams {
  agent_id?: string | undefined;
  agent_version?: number | undefined;
  limit?: number | undefined;
  page?: string | undefined;
  include_archived?: boolean | undefined;
  order?: 'asc' | 'desc' | undefined;
  'created_at[gt]'?: string | undefined;
  'created_at[gte]'?: string | undefined;
  'created_at[lt]'?: string | undefined;
  'created_at[lte]'?: string | undefined;
}

export interface CreateSessionParams {
  agent: string | { id: string; type: 'agent'; version?: number };
  environment_id: string;
  vault_ids?: string[];
  title?: string;
  metadata?: ManagedAgentsMetadata;
  resources?: unknown[];
}

export function listSessions(params?: SessionsListParams): Promise<ListResponse<Session>> {
  return get<ListResponse<Session>>('/v1/sessions', params);
}

export function createSession(params: CreateSessionParams): Promise<Session> {
  return post<Session>('/v1/sessions', params);
}

export function retrieveSession(id: string): Promise<Session> {
  return get<Session>(`/v1/sessions/${id}`);
}

// ----- ヘルパ ---------------------------------------------------------------

/**
 * `next_page` カーソルを使って全ページを順に取得し、平坦化された data 配列を返す。
 *
 * @example
 * const all = await listAll((page) => listAgents(page === undefined ? {} : { page }));
 */
export async function listAll<T>(
  fetchPage: (page?: string) => Promise<ListResponse<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let page: string | undefined;
  // 安全弁: 100 ページまでしか辿らない (ページサイズ最大 100 = 10,000 件)
  for (let i = 0; i < 100; i++) {
    const res: ListResponse<T> = await fetchPage(page);
    all.push(...res.data);
    if (!res.next_page) break;
    page = res.next_page;
  }
  return all;
}

/**
 * クライアント側で metadata 条件にマッチするアイテムだけを抽出する。
 * Managed Agents API はサーバ側 metadata フィルタを未サポートのため、
 * 全件取得後にこのヘルパで絞り込む。
 *
 * @param items metadata を持つリソース配列
 * @param criteria 全条件 AND でマッチさせる key-value ペア (空オブジェクトは全件返す)
 */
export function filterByMetadata<T extends { metadata: ManagedAgentsMetadata }>(
  items: T[],
  criteria: ManagedAgentsMetadata,
): T[] {
  const entries = Object.entries(criteria);
  if (entries.length === 0) return items.slice();
  return items.filter((item) => {
    const md = item.metadata ?? {};
    return entries.every(([k, v]) => md[k] === v);
  });
}

/**
 * 全ページ取得 + クライアント側 metadata フィルタの統合ヘルパ。
 * Managed Agents API はサーバ側 metadata フィルタ未サポートのため、
 * リソース解決系のコードでは本ヘルパを使うことを推奨。
 *
 * @example
 *   await findByMetadata(
 *     (page) => listAgents({ page }),
 *     { source: METADATA_SOURCE, type: 'default' },
 *   );
 */
export async function findByMetadata<T extends { metadata: ManagedAgentsMetadata }>(
  fetchPage: (page?: string) => Promise<ListResponse<T>>,
  criteria: ManagedAgentsMetadata,
): Promise<T[]> {
  const all = await listAll(fetchPage);
  return filterByMetadata(all, criteria);
}

/**
 * 配列から `created_at` 昇順で最古のリソースを返す。
 * 別タブ/別プロセスが race で重複作成した場合、全プロセスから同じリソース (最古) を選ぶための
 * 決定論的な選択戦略。
 */
export function pickOldest<T extends { created_at: string }>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pickOldest called on empty array');
  }
  let oldest = items[0]!;
  for (let i = 1; i < items.length; i++) {
    const item = items[i]!;
    if (item.created_at.localeCompare(oldest.created_at) < 0) {
      oldest = item;
    }
  }
  return oldest;
}
