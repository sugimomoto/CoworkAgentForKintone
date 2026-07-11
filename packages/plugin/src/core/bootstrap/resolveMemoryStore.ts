// Cowork Agent for kintone — Memory Store の解決 (find-or-create) + seed (#15)
//
// 2 レイヤーの store を扱う:
//   - preferences   … per-user 共有 (全エージェント共通の口調/業務用語)
//   - agent-context … per-user × agent (そのエージェント固有の学習/修正)
//
// identity は `store.name`（find のキー兼 mount slug 元）。memory store が metadata を
// 受けるかは未確定のため name を一意キーにする（metadata も送るが依存しない）。
// resolveUserVault と同じ in-flight 保護 + pickOldest でタブ並行の重複作成を防ぐ。

import { METADATA_SOURCE } from '../constants';
import {
  createMemory,
  createMemoryStore,
  isPathConflict,
  listMemoryStores,
} from '../managed-agents/memory';
import { pickOldest } from '../managed-agents/resources';

import type { MemoryStore } from '../managed-agents/types';

export interface PreferencesStoreContext {
  kintoneDomain: string;
  kintoneUserCode: string;
}
export interface AgentContextStoreContext extends PreferencesStoreContext {
  agentId: string;
}

/** seed する 1 ファイル。 */
interface SeedFile {
  path: string;
  content: string;
}

const PREFERENCES_SEED: SeedFile[] = [
  {
    path: '/preferences/general.md',
    content:
      '# 口調・出力スタイル\n\n<!-- 例: ですます調で回答する / 日付は YYYY/MM/DD -->\n',
  },
  {
    path: '/preferences/field-aliases.md',
    content:
      '# 業務用語・フィールドエイリアス\n\n<!-- 例: 「顧客名」= company_name / 「お客様アプリ」= app 5 -->\n',
  },
];

const AGENT_CONTEXT_SEED: SeedFile[] = [
  {
    path: '/context/notes.md',
    content: '# このエージェント固有のメモ\n\n<!-- 会話から学んだこのエージェント向けの前提・段取り -->\n',
  },
  {
    path: '/context/past-corrections.md',
    content:
      '# 過去の修正記録\n\n<!-- 例: 前回 ○○ と依頼したが △△ になった → 次回は □□ とする -->\n',
  },
];

/** identity を兼ねる store 名。find のキー・mount slug 元。 */
function preferencesStoreName(ctx: PreferencesStoreContext): string {
  return `cowork:pref:${ctx.kintoneDomain}:${ctx.kintoneUserCode}`;
}
function agentContextStoreName(ctx: AgentContextStoreContext): string {
  return `cowork:agentctx:${ctx.kintoneDomain}:${ctx.kintoneUserCode}:${ctx.agentId}`;
}

// name → 解決中 Promise。連投時の重複作成を防ぐ。
const inFlightByName = new Map<string, Promise<MemoryStore>>();

/**
 * name で既存 store を探し、無ければ作成 + seed する。
 * 作成直後に再 list して他タブ先行分があれば pickOldest（name 一致の最古）で吸収。
 */
async function ensureStoreByName(
  name: string,
  description: string,
  metadata: Record<string, string>,
  seed: SeedFile[],
): Promise<MemoryStore> {
  const cached = inFlightByName.get(name);
  if (cached) return cached;

  const promise = (async (): Promise<MemoryStore> => {
    try {
      const list = await listMemoryStores();
      const found = list.data.filter((s) => s.name === name && !s.archived_at);
      if (found.length > 0) return pickOldest(found);

      const created = await createMemoryStore({ name, description, metadata });
      // 重複チェック: 他タブが先に作っていれば最古を採用
      const verify = await listMemoryStores();
      const dupes = verify.data.filter((s) => s.name === name && !s.archived_at);
      const store = dupes.length > 1 ? pickOldest(dupes) : created;
      await seedFiles(store.id, seed); // 新規作成時のみ seed（best-effort）
      return store;
    } finally {
      inFlightByName.delete(name);
    }
  })();

  inFlightByName.set(name, promise);
  return promise;
}

/** seed ファイルを create。path 衝突（既 seed 済み）や一時失敗は握りつぶす（best-effort）。 */
async function seedFiles(storeId: string, seed: SeedFile[]): Promise<void> {
  for (const f of seed) {
    try {
      await createMemory(storeId, { path: f.path, content: f.content });
    } catch (err) {
      if (isPathConflict(err)) continue; // 既に存在（冪等）
      // それ以外の一時失敗も seed は必須ではないので無視（agent が後で作れる）
    }
  }
}

/** ユーザー共有 preferences store を解決する（find-or-create + seed）。 */
export function resolveUserPreferencesStore(ctx: PreferencesStoreContext): Promise<MemoryStore> {
  return ensureStoreByName(
    preferencesStoreName(ctx),
    `${ctx.kintoneUserCode} の個人設定（口調・日付表記・業務用語）。タスク開始時に必ず確認し、新しい好みが分かったら追記すること。`,
    {
      source: METADATA_SOURCE,
      kind: 'preferences',
      kintoneDomain: ctx.kintoneDomain,
      kintoneUserCode: ctx.kintoneUserCode,
    },
    PREFERENCES_SEED,
  );
}

/** エージェント固有 agent-context store を解決する（find-or-create + seed）。 */
export function resolveAgentContextStore(ctx: AgentContextStoreContext): Promise<MemoryStore> {
  return ensureStoreByName(
    agentContextStoreName(ctx),
    `このエージェント固有の学習・修正記録。タスク開始時に確認し、判明した修正点・前提を追記すること。`,
    {
      source: METADATA_SOURCE,
      kind: 'agent-context',
      kintoneDomain: ctx.kintoneDomain,
      kintoneUserCode: ctx.kintoneUserCode,
      agentId: ctx.agentId,
    },
    AGENT_CONTEXT_SEED,
  );
}

// ----- Session attach 用 resources 構築 --------------------------------------

/** createUserSession に渡す memory_store resource。 */
export interface MemoryResource {
  type: 'memory_store';
  memory_store_id: string;
  access: 'read_write' | 'read_only';
  instructions: string;
}

const PREFERENCES_INSTRUCTIONS =
  'あなたと利用者の個人設定。タスク開始時に必ず該当ファイルを確認し、口調・日付表記・業務用語・過去の修正を反映すること。' +
  '新しい好みや業務用語が判明したら追記する。パスワードや API キー等の機微情報は絶対に書き込まない。';

const AGENT_CONTEXT_INSTRUCTIONS =
  'このエージェント固有の学習・修正記録。タスク開始時に確認し、判明した前提・修正点を追記すること。機微情報は書き込まない。';

/**
 * Memory トグル ON 時に attach する 2 store を解決し resources[] を組み立てる。
 * 各 store の解決失敗は握りつぶす（その store を attach しないだけ・会話は継続）。
 */
export async function resolveMemoryResources(
  ctx: AgentContextStoreContext,
): Promise<MemoryResource[]> {
  const [pref, agentCtx] = await Promise.all([
    resolveUserPreferencesStore(ctx).catch(() => null),
    resolveAgentContextStore(ctx).catch(() => null),
  ]);
  const out: MemoryResource[] = [];
  if (pref) {
    out.push({
      type: 'memory_store',
      memory_store_id: pref.id,
      access: 'read_write',
      instructions: PREFERENCES_INSTRUCTIONS,
    });
  }
  if (agentCtx) {
    out.push({
      type: 'memory_store',
      memory_store_id: agentCtx.id,
      access: 'read_write',
      instructions: AGENT_CONTEXT_INSTRUCTIONS,
    });
  }
  return out;
}

/** テスト用: in-flight キャッシュを reset する。 */
export function _resetResolveMemoryStoreCache(): void {
  inFlightByName.clear();
}
