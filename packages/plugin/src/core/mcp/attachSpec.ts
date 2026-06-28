// #42 M4: Agent の attach（McpAttachment[]）から Anthropic Managed Agents の
// mcp_servers / tools(mcp_toolset) を組み立てる純関数 + metadata 往復シリアライズ。
//
// attach は agent metadata に JSON で永続化し、保存時にカタログ（McpServerDef[]）と突合して
// mcp_servers（{type:'url', name=serverId, url}）と mcp_toolset（enabled tools）を生成する。
// name は serverId を使い、kintone/notify の server name と衝突しない。

import type { McpAttachment, McpServerDef } from './registry';

/** #42: agent metadata に attach（McpAttachment[]）を JSON で保存するキー。 */
export const META_KEY_MCP_ATTACHMENTS = 'mcpAttachments';

const ALWAYS_ALLOW = { type: 'always_allow' as const };

/** attach 済み（enabledTools 1件以上 & カタログに存在）のサーバーのみ対象にする。 */
function activeAttachments(
  attachments: readonly McpAttachment[],
  catalog: readonly McpServerDef[],
): Array<{ att: McpAttachment; def: McpServerDef }> {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const out: Array<{ att: McpAttachment; def: McpServerDef }> = [];
  for (const att of attachments) {
    const def = byId.get(att.serverId);
    if (def && att.enabledTools.length > 0) out.push({ att, def });
  }
  return out;
}

/** attach 済みサーバーの mcp_servers エントリ（{type:'url', name=serverId, url}）。 */
export function buildAttachedMcpServers(
  attachments: readonly McpAttachment[],
  catalog: readonly McpServerDef[],
): Array<Record<string, unknown>> {
  return activeAttachments(attachments, catalog).map(({ att, def }) => ({
    type: 'url',
    name: att.serverId,
    url: def.url,
  }));
}

/** attach 済みサーバーの mcp_toolset（選択ツールのみ enabled）。 */
export function buildAttachedMcpToolsets(
  attachments: readonly McpAttachment[],
  catalog: readonly McpServerDef[],
): Array<Record<string, unknown>> {
  return activeAttachments(attachments, catalog).map(({ att, def }) => {
    const allTools = (def.tools ?? []).map((t) => t.name);
    const enabledSet = new Set(att.enabledTools);
    // tools/list キャッシュがあれば全ツールを列挙して per-tool enable、無ければ enabledTools を直接 configs に。
    const names = allTools.length > 0 ? allTools : att.enabledTools;
    return {
      type: 'mcp_toolset',
      mcp_server_name: att.serverId,
      default_config: { enabled: false, permission_policy: ALWAYS_ALLOW },
      configs: names.map((name) => ({
        name,
        enabled: enabledSet.has(name),
        permission_policy: ALWAYS_ALLOW,
      })),
    };
  });
}

// ── metadata 往復（agent metadata に JSON で保存） ──

export function serializeMcpAttachments(attachments: readonly McpAttachment[]): string {
  return JSON.stringify(attachments);
}

export function parseMcpAttachments(raw: unknown): McpAttachment[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (a): a is McpAttachment =>
      !!a &&
      typeof a === 'object' &&
      typeof (a as McpAttachment).serverId === 'string' &&
      Array.isArray((a as McpAttachment).enabledTools),
  );
}
