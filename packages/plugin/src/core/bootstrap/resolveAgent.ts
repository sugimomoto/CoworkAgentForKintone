// Cowork Agent for kintone — Default Agent の解決
//
// metadata でフィルタした既存 Default Agent があればそれを返す。
// 無ければ新規作成する。
//
// 【重複作成の防止】
//  - 同一プロセス内: in-flight Promise を共有し、並行呼び出しを 1 回の list+create に集約
//  - クロスプロセス (別タブ等): 作成後に再 list して重複検出し、最古の Agent を正として返す
//  - 常に created_at 昇順で先頭 (最古) を返す → どのプロセスから見ても同じ Agent を返す
//
// system プロンプトと tools 構成は Phase 1a (kintone 接続なし) 用。
// Phase 1b 以降で kintone 操作ガイドラインを system に追記する。

import { AGENT_TYPE, METADATA_SOURCE } from '../constants';
import {
  createAgent,
  findByMetadata,
  listAgents,
  pickOldest,
} from '../managed-agents/resources';

import type { Agent } from '../managed-agents/types';

/** Default Agent の表示名 (functional-design.md §3.1.3) */
export const DEFAULT_AGENT_NAME = 'Cowork Agent - Default';

/** Phase 1a 用の system プロンプト (kintone 接続なし、案内中心) */
export const DEFAULT_AGENT_SYSTEM_PROMPT = [
  'あなたは kintone の業務支援エージェント Cowork Agent です。',
  '現在セットアップ中で、kintone への接続機能はまだ有効化されていません。',
  'ユーザーからの質問には、kintone の基本的な使い方や今後できることの案内を中心に返答してください。',
].join('\n');

/**
 * Default Agent に与える組込ツール構成。
 * Managed Agents API は `configs` を array で受け取る仕様 (object 渡しだと
 * `tools.0.configs: value must be an array` 400 エラー)。
 * Phase 1a では `default_config` で全 tool を always_allow に一括設定する。
 */
export const DEFAULT_AGENT_TOOLS = [
  {
    type: 'agent_toolset_20260401',
    default_config: {
      enabled: true,
      permission_policy: { type: 'always_allow' },
    },
  },
] as const;

// ----- in-flight Promise 共有 ------------------------------------------------

let inFlight: Promise<Agent> | null = null;

/** テスト用: in-flight キャッシュをクリアする。プロダクションコードから呼ばないこと */
export function _resetResolveDefaultAgentCache(): void {
  inFlight = null;
}

// ----- 本体 -----------------------------------------------------------------

/**
 * プラグインが管理する Default Agent を取得する。なければ作成する。
 *
 * 並行呼び出しや別プロセスとのレース条件に対して:
 * - 同一プロセス内では in-flight Promise を共有
 * - 別プロセス (別タブ) で重複作成された場合は created_at 最古を返す
 */
export async function resolveDefaultAgent(): Promise<Agent> {
  if (inFlight) return inFlight;

  inFlight = doResolve();
  try {
    return await inFlight;
  } catch (err) {
    inFlight = null; // 失敗時はキャッシュ破棄、次回再試行を許可
    throw err;
  }
}

async function doResolve(): Promise<Agent> {
  // 1. 既存 Agent を探索
  const existing = await findDefaultAgents();
  if (existing.length > 0) {
    return pickOldest(existing);
  }

  // 2. 無ければ作成
  const created = await createAgent({
    model: 'claude-sonnet-4-6',
    name: DEFAULT_AGENT_NAME,
    system: DEFAULT_AGENT_SYSTEM_PROMPT,
    tools: [...DEFAULT_AGENT_TOOLS],
    metadata: {
      source: METADATA_SOURCE,
      type: AGENT_TYPE.default,
    },
  });

  // 3. 作成直後に再 list して重複チェック。他プロセスが先行していれば最古を返す
  const verified = await findDefaultAgents();
  if (verified.length > 1) {
    return pickOldest(verified);
  }
  return created;
}

async function findDefaultAgents(): Promise<Agent[]> {
  return findByMetadata<Agent>(
    (page) => listAgents({ page }),
    {
      source: METADATA_SOURCE,
      type: AGENT_TYPE.default,
    },
  );
}
