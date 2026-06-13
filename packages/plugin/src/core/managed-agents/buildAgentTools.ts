// Cowork Agent for kintone — Agent 編集 UI 用 tools[] ビルダー (#40)
//
// AgentDetailModal が選択した kintone MCP ツールを Anthropic Managed Agents API の
// `tools[]` 配列に組み立てる。既存 `resolveAgent.ts:buildAgentTools` (built-in 用) と
// 構造は同じだが、per-tool の enabled flag を draft の `enabledTools` に従って切替える。

import {
  DESTRUCTIVE_TOOL_NAMES,
  KINTONE_TOOL_NAMES,
  type KintoneToolName,
} from '../bootstrap/builtInAgents';
import {
  CREATE_ARTIFACT_TOOL,
  KINTONE_MCP_SERVER_NAME,
} from '../bootstrap/resolveAgent';

/**
 * Agent 編集 UI の draft.enabledTools を Anthropic Managed Agents API tools[] 形式に
 * 変換する。
 *
 * 含まれる要素:
 *   - `agent_toolset_20260401` (bash/read/write 等の基本ツール、常に always_allow)
 *   - `CREATE_ARTIFACT_TOOL` (Plugin 側で処理する custom tool)
 *   - `mcp_toolset` kintone (configs[] で per-tool enable / permission_policy)
 *
 * `enabledTools` に含まれない kintone ツールは `enabled: false` で送る。
 * destructive (`kintone-delete-records` 等) は `permission_policy.type='always_ask'`。
 */
export function buildAgentTools(
  enabledTools: ReadonlySet<KintoneToolName> | readonly KintoneToolName[],
): Array<Record<string, unknown>> {
  const enabledSet =
    enabledTools instanceof Set
      ? enabledTools
      : new Set<KintoneToolName>(enabledTools as readonly KintoneToolName[]);

  return [
    {
      type: 'agent_toolset_20260401',
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
    },
    CREATE_ARTIFACT_TOOL as unknown as Record<string, unknown>,
    {
      type: 'mcp_toolset',
      mcp_server_name: KINTONE_MCP_SERVER_NAME,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
      configs: KINTONE_TOOL_NAMES.map((name: KintoneToolName) => ({
        name,
        enabled: enabledSet.has(name),
        permission_policy: {
          type: DESTRUCTIVE_TOOL_NAMES.has(name)
            ? ('always_ask' as const)
            : ('always_allow' as const),
        },
      })),
    },
  ];
}

/**
 * Anthropic Managed Agents API tools[] レスポンスから、現在 enabled になっている
 * kintone ツール名集合を抽出する。AgentDetailModal の form 初期化に使う。
 */
export function extractEnabledTools(tools: unknown): KintoneToolName[] {
  if (!Array.isArray(tools)) return [];
  const mcp = tools.find(
    (t): t is { configs?: unknown } =>
      typeof t === 'object' &&
      t !== null &&
      (t as { type?: unknown }).type === 'mcp_toolset' &&
      (t as { mcp_server_name?: unknown }).mcp_server_name === KINTONE_MCP_SERVER_NAME,
  );
  if (!mcp || !Array.isArray(mcp.configs)) {
    // mcp_toolset が無い = enabled 情報無し → 全部 enabled 扱い (default_config に従う)
    return [...KINTONE_TOOL_NAMES];
  }
  const out: KintoneToolName[] = [];
  for (const cfg of mcp.configs) {
    if (
      typeof cfg === 'object' &&
      cfg !== null &&
      typeof (cfg as { name?: unknown }).name === 'string' &&
      (cfg as { enabled?: unknown }).enabled !== false
    ) {
      const name = (cfg as { name: string }).name as KintoneToolName;
      if ((KINTONE_TOOL_NAMES as readonly string[]).includes(name)) {
        out.push(name);
      }
    }
  }
  return out;
}
