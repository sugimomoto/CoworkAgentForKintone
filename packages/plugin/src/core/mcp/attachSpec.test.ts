import { describe, expect, it } from 'vitest';

import {
  buildAttachedMcpServers,
  buildAttachedMcpToolsets,
  parseMcpAttachments,
  serializeMcpAttachments,
} from './attachSpec';

import type { McpServerDef } from './registry';

const CATALOG: McpServerDef[] = [
  {
    id: 'gh',
    name: 'GitHub',
    url: 'https://gh.example/mcp',
    authType: 'bearer',
    tools: [{ name: 'get_issue' }, { name: 'create_issue' }, { name: 'delete_repo' }],
  },
  { id: 'pub', name: 'Public', url: 'https://pub.example/mcp', authType: 'none' },
];

describe('buildAttachedMcpServers', () => {
  it('attach 済み（enabledTools 1件以上 & カタログ存在）のみ mcp_servers 化', () => {
    const servers = buildAttachedMcpServers(
      [
        { serverId: 'gh', enabledTools: ['get_issue'] },
        { serverId: 'pub', enabledTools: [] }, // 空 = 対象外
        { serverId: 'ghost', enabledTools: ['x'] }, // カタログ不在 = 対象外
      ],
      CATALOG,
    );
    expect(servers).toEqual([{ type: 'url', name: 'gh', url: 'https://gh.example/mcp' }]);
  });
});

describe('buildAttachedMcpToolsets', () => {
  it('tools/list キャッシュがあれば全ツール列挙し選択のみ enabled', () => {
    const toolsets = buildAttachedMcpToolsets([{ serverId: 'gh', enabledTools: ['get_issue', 'create_issue'] }], CATALOG);
    expect(toolsets).toHaveLength(1);
    const ts = toolsets[0] as { mcp_server_name: string; configs: Array<{ name: string; enabled: boolean }> };
    expect(ts.mcp_server_name).toBe('gh');
    expect(ts.configs).toEqual([
      { name: 'get_issue', enabled: true, permission_policy: { type: 'always_allow' } },
      { name: 'create_issue', enabled: true, permission_policy: { type: 'always_allow' } },
      { name: 'delete_repo', enabled: false, permission_policy: { type: 'always_allow' } },
    ]);
  });

  it('tools キャッシュ無しのサーバーは enabledTools を直接 configs に', () => {
    const catalog: McpServerDef[] = [{ id: 's', name: 'S', url: 'https://e/mcp', authType: 'bearer' }];
    const toolsets = buildAttachedMcpToolsets([{ serverId: 's', enabledTools: ['a', 'b'] }], catalog);
    const ts = toolsets[0] as { configs: Array<{ name: string; enabled: boolean }> };
    expect(ts.configs.map((c) => c.name)).toEqual(['a', 'b']);
    expect(ts.configs.every((c) => c.enabled)).toBe(true);
  });
});

describe('parse/serialize McpAttachments', () => {
  it('ラウンドトリップ', () => {
    const att = [{ serverId: 'gh', enabledTools: ['get_issue'] }];
    expect(parseMcpAttachments(serializeMcpAttachments(att))).toEqual(att);
  });
  it('不正・型不一致は空配列', () => {
    expect(parseMcpAttachments('{bad')).toEqual([]);
    expect(parseMcpAttachments(undefined)).toEqual([]);
    expect(parseMcpAttachments(JSON.stringify([{ serverId: 'x' }]))).toEqual([]); // enabledTools 欠落
  });
});
