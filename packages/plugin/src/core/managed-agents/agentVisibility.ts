// Cowork Agent for kintone — Agent 公開トグル (visibility) 永続化ヘルパー
//
// AgentsListPane の公開トグル切替で呼ばれる。Anthropic は metadata 全体を replace
// する仕様なので、retrieve → merge → update の 3 ステップを 1 関数にまとめる。
//
// 仕様: design.md §4.5 / §11 R1 (Agent ID 安定化) / tasklist.md P4.5.1

import { retrieveAgent, updateAgent } from './resources';

/**
 * Agent.metadata.visibility を public ↔ private に切替える。
 *
 * 動作:
 *   1. `retrieveAgent(id)` で最新 metadata を取得
 *   2. `{ ...existing, visibility: next }` で merge
 *   3. `updateAgent(id, { metadata: merged })` で新 version を作成 (Agent ID 不変)
 *
 * Agent ID 不変なので chatStore.builtInAgents の要素は id でそのまま再利用できる。
 */
export async function setAgentVisibility(
  agentId: string,
  next: 'public' | 'private',
): Promise<void> {
  const existing = await retrieveAgent(agentId);
  const mergedMetadata = {
    ...(existing.metadata ?? {}),
    visibility: next,
  };
  await updateAgent(agentId, { metadata: mergedMetadata });
}
