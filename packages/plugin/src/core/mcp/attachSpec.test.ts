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
  it('attach 有効（mode=all か subset で 1件以上 & カタログ存在）のみ mcp_servers 化', () => {
    const servers = buildAttachedMcpServers(
      [
        { serverId: 'gh', mode: 'subset', enabledTools: ['get_issue'] },
        { serverId: 'pub', mode: 'all', enabledTools: [] }, // mode=all は対象
        { serverId: 'ghost', mode: 'all', enabledTools: [] }, // カタログ不在 = 対象外
      ],
      CATALOG,
    );
    expect(servers).toEqual([
      { type: 'url', name: 'gh', url: 'https://gh.example/mcp' },
      { type: 'url', name: 'pub', url: 'https://pub.example/mcp' },
    ]);
  });

  it('subset で enabledTools 空 = 対象外', () => {
    const servers = buildAttachedMcpServers([{ serverId: 'gh', mode: 'subset', enabledTools: [] }], CATALOG);
    expect(servers).toEqual([]);
  });
});

describe('buildAttachedMcpToolsets', () => {
  it('mode=all は default_config.enabled=true・configs 空（ツール一覧不要）', () => {
    const toolsets = buildAttachedMcpToolsets([{ serverId: 'pub', mode: 'all', enabledTools: [] }], CATALOG);
    expect(toolsets).toEqual([
      {
        type: 'mcp_toolset',
        mcp_server_name: 'pub',
        default_config: { enabled: true, permission_policy: { type: 'always_allow' } },
        configs: [],
      },
    ]);
  });

  it('subset: tools/list キャッシュがあれば全ツール列挙し選択のみ enabled', () => {
    const toolsets = buildAttachedMcpToolsets(
      [{ serverId: 'gh', mode: 'subset', enabledTools: ['get_issue', 'create_issue'] }],
      CATALOG,
    );
    expect(toolsets).toHaveLength(1);
    const ts = toolsets[0] as {
      mcp_server_name: string;
      default_config: { enabled: boolean };
      configs: Array<{ name: string; enabled: boolean }>;
    };
    expect(ts.mcp_server_name).toBe('gh');
    expect(ts.default_config.enabled).toBe(false);
    expect(ts.configs).toEqual([
      { name: 'get_issue', enabled: true, permission_policy: { type: 'always_allow' } },
      { name: 'create_issue', enabled: true, permission_policy: { type: 'always_allow' } },
      { name: 'delete_repo', enabled: false, permission_policy: { type: 'always_allow' } },
    ]);
  });

  it('subset: tools キャッシュ無しのサーバーは enabledTools を直接 configs に', () => {
    const catalog: McpServerDef[] = [{ id: 's', name: 'S', url: 'https://e/mcp', authType: 'bearer' }];
    const toolsets = buildAttachedMcpToolsets([{ serverId: 's', mode: 'subset', enabledTools: ['a', 'b'] }], catalog);
    const ts = toolsets[0] as { configs: Array<{ name: string; enabled: boolean }> };
    expect(ts.configs.map((c) => c.name)).toEqual(['a', 'b']);
    expect(ts.configs.every((c) => c.enabled)).toBe(true);
  });
});

describe('parse/serialize McpAttachments', () => {
  it('ラウンドトリップ（all / subset）', () => {
    const att = [
      { serverId: 'gh', mode: 'subset' as const, enabledTools: ['get_issue'] },
      { serverId: 'pub', mode: 'all' as const, enabledTools: [] },
    ];
    expect(parseMcpAttachments(serializeMcpAttachments(att))).toEqual(att);
  });
  it('mode 欠落の旧データは enabledTools 有無で all/subset を推定', () => {
    expect(parseMcpAttachments(JSON.stringify([{ serverId: 'gh', enabledTools: ['x'] }]))).toEqual([
      { serverId: 'gh', mode: 'subset', enabledTools: ['x'] },
    ]);
    expect(parseMcpAttachments(JSON.stringify([{ serverId: 'pub', enabledTools: [] }]))).toEqual([
      { serverId: 'pub', mode: 'all', enabledTools: [] },
    ]);
  });
  it('不正は空配列 / enabledTools 欠落は all 扱い', () => {
    expect(parseMcpAttachments('{bad')).toEqual([]);
    expect(parseMcpAttachments(undefined)).toEqual([]);
    expect(parseMcpAttachments(JSON.stringify([{ serverId: 'x' }]))).toEqual([
      { serverId: 'x', mode: 'all', enabledTools: [] },
    ]);
  });
});
