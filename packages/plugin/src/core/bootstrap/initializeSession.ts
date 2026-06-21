// Cowork Agent for kintone — ブートストラップのオーケストレーション (純関数)
//
// 起動時に必要なリソース (built-in Agent / Custom Agent / Environment / 現ユーザーの所属 +
// admin 判定 / bundled skill) を解決し、初期 Agent を選ぶ。React / DOM / store に依存しない
// 純粋な async 関数として実装する (旧 useSession の useEffect 内ロジックを抽出)。
//
// localStorage 等の Web Storage は触らない。前回選択 Agent は `preferredAgentId` として
// 呼出側 (hook) から渡してもらう。

import { filterAgentsByAccess } from '../access/filterAgentsByAccess';
import { resolveIsAdmin } from '../admin/useIsAdmin';
import { getPluginConfig } from '../kintone/pluginConfig';
import { getCurrentSessionContext } from '../kintone/user';
import { fetchCurrentUserGroups, fetchCurrentUserOrganizations } from '../kintone/users';
import { resolveBundledSkillIds } from '../skills/resolveBundledSkillIds';

import { agentToRecord } from './agentRecord';
import { resolveDefaultAgent } from './resolveAgent';
import { listCustomAgents, resolveBuiltInAgents } from './resolveBuiltInAgents';
import { resolveBootstrapEnvironment } from './resolveEnvironment';

import type { AgentRecord } from './agentTypes';
import type { BuiltInAgentSet } from './resolveBuiltInAgents';
import type { AccessContext } from '../access/filterAgentsByAccess';

export interface InitializeSessionInput {
  /** kintone プラグイン ID。null の場合は Worker 未設定として旧フォールバック経路を通る。 */
  pluginId: string | null;
  /** 前回選択 Agent (localStorage 由来)。候補に含まれていれば初期選択に優先する。 */
  preferredAgentId?: string | null;
}

export interface InitializeSessionResult {
  /** 最終的に選択された Agent ID */
  agentId: string;
  /** Bootstrap Environment ID */
  environmentId: string;
  kintoneDomain: string;
  kintoneUserCode: string;
  /**
   * workerUrl ありで built-in 3 variant + Custom Agent を解決した場合のみ非 null。
   * Header プルダウン / Settings View 用の ACL フィルタ適用済み一覧。
   * null = 旧 resolveDefaultAgent フォールバック経路 (Phase 1b 互換)。
   */
  builtInAgents: AgentRecord[] | null;
  /** 現ユーザーの所属 (rich path のみ非 null) */
  currentUserAccess: AccessContext | null;
  /** cybozu.com 共通管理者か (rich path のみ非 null) */
  isAdmin: boolean | null;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
}

export async function initializeSession(
  input: InitializeSessionInput,
  opts?: { signal?: AbortSignal },
): Promise<InitializeSessionResult> {
  const signal = opts?.signal;
  const cfg = input.pluginId ? getPluginConfig(input.pluginId) : { workerUrl: null };
  const workerUrl = cfg.workerUrl ?? undefined;
  const kctx = getCurrentSessionContext();

  // Anthropic 側 source-of-truth から custom skill を解決 (Plugin Config は介在しない)。
  // name も保持し、各 variant の customSkillFilter(name) で role 別に attach を選ぶ。
  // 失敗時は skill 無しで bootstrap を続行 (admin が同期ボタンを押せば後で attach される)。
  let customSkills: Array<{ name: string; skillId: string }> = [];
  if (workerUrl) {
    try {
      const resolved = await resolveBundledSkillIds();
      customSkills = resolved
        .filter((r): r is typeof r & { skillId: string } => Boolean(r.skillId))
        .map((r) => ({ name: r.name, skillId: r.skillId }));
    } catch {
      // 解決失敗時は skill 無し継続 (Settings View 側でも fetch して UI 反映する)
    }
  }
  // フォールバック (resolveDefaultAgent) 用の id 配列 (こちらは role 別 filter なし)
  const customSkillIds: string[] = customSkills.map((s) => s.skillId);
  throwIfAborted(signal);

  const envPromise = resolveBootstrapEnvironment();

  // Customizer wedge V1: workerUrl があれば resolveBuiltInAgents (3 variant) を ensure。
  // 無い場合 (Bootstrap 未完了) は従来の resolveDefaultAgent にフォールバック (Phase 1b 互換)。
  if (workerUrl) {
    // Anthropic 側 (built-in 3 + Custom Agent + env) と kintone 側 (現ユーザーの所属 +
    // admin 判定) は独立しているので 2 グループに分けて並列 await。
    // どちらも失敗時は安全側 (空 / false) に倒して起動継続。
    const anthropicSide = Promise.all([
      resolveBuiltInAgents({
        workerUrl,
        kintoneDomain: kctx.kintoneDomain,
        ...(customSkills.length > 0 ? { customSkills } : {}),
      }),
      envPromise,
      listCustomAgents({ workerUrl, kintoneDomain: kctx.kintoneDomain }).catch(() => []),
    ]);
    const kintoneSide = Promise.all([
      fetchCurrentUserGroups(kctx.kintoneUserCode).catch(() => [] as string[]),
      fetchCurrentUserOrganizations(kctx.kintoneUserCode).catch(() => [] as string[]),
      resolveIsAdmin().catch(() => false),
    ]);
    const [[set, env, customAgents], [userGroups, userOrgs, adminResolved]] = await Promise.all([
      anthropicSide,
      kintoneSide,
    ]);
    throwIfAborted(signal);

    const access: AccessContext = {
      code: kctx.kintoneUserCode,
      groups: userGroups,
      organizations: userOrgs,
    };
    const allRecords = [
      ...toAgentRecords(set),
      ...customAgents.map((a) => agentToRecord(a)),
    ];
    const records = filterAgentsByAccess(allRecords, access, adminResolved);
    const agentId = selectInitialAgentId(records, input.preferredAgentId);

    return {
      agentId,
      environmentId: env.id,
      kintoneDomain: kctx.kintoneDomain,
      kintoneUserCode: kctx.kintoneUserCode,
      builtInAgents: records,
      currentUserAccess: access,
      isAdmin: adminResolved,
    };
  }

  // workerUrl 無し: 旧 resolveDefaultAgent で 1 つだけ ensure (Phase 1b 互換)
  const agentOptions: Parameters<typeof resolveDefaultAgent>[0] = {
    ...(customSkillIds.length > 0 ? { customSkillIds } : {}),
  };
  const [agent, env] = await Promise.all([resolveDefaultAgent(agentOptions), envPromise]);
  throwIfAborted(signal);

  return {
    agentId: agent.id,
    environmentId: env.id,
    kintoneDomain: kctx.kintoneDomain,
    kintoneUserCode: kctx.kintoneUserCode,
    builtInAgents: null,
    currentUserAccess: null,
    isAdmin: null,
  };
}

/**
 * 初期 Agent ID を決定する (localStorage 非依存版)。
 *   1. preferredAgentId が records に含まれていればそれ
 *   2. visibility=public + isDefault=true の Agent
 *   3. 最初の visibility=public な Agent
 *   4. fallback: records[0]
 */
export function selectInitialAgentId(
  records: AgentRecord[],
  preferredAgentId?: string | null,
): string {
  if (records.length === 0) return '';
  if (preferredAgentId && records.some((r) => r.id === preferredAgentId)) return preferredAgentId;
  const def = records.find((r) => r.visibility === 'public' && r.isDefault);
  if (def) return def.id;
  const pub = records.find((r) => r.visibility === 'public');
  if (pub) return pub.id;
  return records[0]!.id;
}

/**
 * resolveBuiltInAgents の戻り値 (Agent × 4 variant) を Plugin UI 用 AgentRecord[] に変換する。
 * variant が確定しているので purpose を明示で渡し、agentRecord.ts の共有変換 (保存後リフレッシュと
 * 同一ロジック) で iconKind / visibility / isDefault / quickActions 等を metadata 優先で補完する。
 */
function toAgentRecords(set: BuiltInAgentSet): AgentRecord[] {
  return [
    agentToRecord(set.business, 'business'),
    agentToRecord(set.customizerOpus, 'customizer-opus'),
    agentToRecord(set.customizerSonnet, 'customizer-sonnet'),
    agentToRecord(set.appDesigner, 'app-designer'),
  ];
}
