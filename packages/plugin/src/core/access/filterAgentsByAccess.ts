// Cowork Agent for kintone — #47 ACL filter (純関数)
//
// AgentRecord 配列を「現在のユーザーが見られるもの」だけに絞り込む純関数。
// useSession の bootstrap で `setBuiltInAgents` に渡す直前に適用する。

import type { AgentRecord } from '../bootstrap/agentTypes';

export interface AccessContext {
  /** kintone ログインユーザーコード */
  code: string;
  /** 所属グループコード一覧 */
  groups: readonly string[];
  /** 所属組織コード一覧 */
  organizations: readonly string[];
}

/**
 * 公開先 ACL に基づいて Agent をフィルタする。
 *
 * 判定階層:
 *   1. admin (true) → 全 Agent 通す (private 含む) — admin 完全免除
 *   2. admin 未解決 (null) → 全 Agent 通す (一時的、解決後に再 filter)
 *   3. visibility === 'private' → 除外 (旧挙動と同じ)
 *   4. 3 配列すべて空 → 全員 OK (後方互換)
 *   5. いずれか指定あり → OR 結合 (allowedUsers OR allowedGroups OR allowedOrganizations)
 *
 * `ctx === null` (= kintone runtime 不在 or API 失敗) のときは
 * 「3 配列空 + public のもの」だけを通す保守的挙動とする。
 */
export function filterAgentsByAccess(
  agents: readonly AgentRecord[],
  ctx: AccessContext | null,
  isAdmin: boolean | null,
): AgentRecord[] {
  if (isAdmin === true || isAdmin === null) return [...agents];
  return agents.filter((a) => canAccess(a, ctx));
}

function canAccess(agent: AgentRecord, ctx: AccessContext | null): boolean {
  if (agent.visibility !== 'public') return false;
  if (isAccessOpen(agent)) return true;
  if (!ctx) return false;
  if (agent.allowedUsers.includes(ctx.code)) return true;
  if (agent.allowedGroups.some((g) => ctx.groups.includes(g))) return true;
  if (agent.allowedOrganizations.some((o) => ctx.organizations.includes(o))) return true;
  return false;
}

/** 3 配列がすべて空のとき = 「全員に公開」状態。 */
export function isAccessOpen(agent: AgentRecord): boolean {
  return (
    agent.allowedUsers.length === 0 &&
    agent.allowedGroups.length === 0 &&
    agent.allowedOrganizations.length === 0
  );
}
