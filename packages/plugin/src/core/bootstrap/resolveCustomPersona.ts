// Cowork Agent for kintone — Custom Agent の persona 解決 (#141)
//
// Custom Agent は persona (admin 手書き system prompt) を焼き込んでおり、base は含まない。
// session override の `system = base + persona` を組むため、焼き込み system を retrieveAgent で
// 取得する。毎会話 fetch しないよう agentId(+version) でメモ化し、編集 (applyAgentEdit) 時に
// invalidate する (#151 のメモ化と同じ思想)。

import { retrieveAgent } from '../managed-agents/resources';

// agentId → persona 取得 Promise。成功結果はキャッシュ、失敗時は破棄して次回再試行。
const cache = new Map<string, Promise<string>>();

/**
 * Custom Agent の persona (焼き込み system) を返す。取得失敗時は null (override せず継続)。
 */
export async function resolveCustomPersona(agentId: string): Promise<string | null> {
  let p = cache.get(agentId);
  if (!p) {
    p = retrieveAgent(agentId).then((a) => a.system ?? '');
    p.catch(() => cache.delete(agentId)); // 失敗はキャッシュしない
    cache.set(agentId, p);
  }
  try {
    return await p;
  } catch {
    return null;
  }
}

/** Custom Agent 編集後に呼び、キャッシュを破棄する。 */
export function invalidateCustomPersona(agentId: string): void {
  cache.delete(agentId);
}

/** テスト用: 全キャッシュを reset する。 */
export function _resetCustomPersonaCache(): void {
  cache.clear();
}
