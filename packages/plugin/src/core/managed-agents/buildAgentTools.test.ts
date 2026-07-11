// buildAgentTools / extractEnabledTools の単体テスト (#40)

import { describe, expect, it } from 'vitest';

import { KINTONE_TOOL_NAMES } from '../bootstrap/builtInAgents';

import { buildAgentTools, extractEnabledTools } from './buildAgentTools';

describe('buildAgentTools (#40)', () => {
  it('全 tools enabled で組み立てる', () => {
    const tools = buildAgentTools(KINTONE_TOOL_NAMES);
    // agent_toolset / create_artifact / update_plan(#128) / mcp_toolset(kintone) / mcp_toolset(notify) の 5 要素 (#13)
    expect(tools).toHaveLength(5);
    expect(tools[0]).toMatchObject({ type: 'agent_toolset_20260401' });
    expect(tools[1]).toMatchObject({ type: 'custom', name: 'create_artifact' });
    expect(tools[2]).toMatchObject({ type: 'custom', name: 'update_plan' });
    expect(tools[3]).toMatchObject({ type: 'mcp_toolset', mcp_server_name: 'kintone' });
    expect(tools[4]).toMatchObject({ type: 'mcp_toolset', mcp_server_name: 'notify' });
  });

  it('mcp_toolset.configs は KINTONE_TOOL_NAMES 全件 (順序維持)', () => {
    const tools = buildAgentTools(KINTONE_TOOL_NAMES);
    const mcp = tools[3] as { configs: Array<{ name: string; enabled: boolean }> };
    expect(mcp.configs).toHaveLength(KINTONE_TOOL_NAMES.length);
    expect(mcp.configs.map((c) => c.name)).toEqual([...KINTONE_TOOL_NAMES]);
    for (const cfg of mcp.configs) {
      expect(cfg.enabled).toBe(true);
    }
  });

  it('部分 ON: enabled flag が正しく反映される', () => {
    const tools = buildAgentTools(['kintone-get-records', 'kintone-add-record']);
    const mcp = tools[3] as { configs: Array<{ name: string; enabled: boolean }> };
    const byName = Object.fromEntries(mcp.configs.map((c) => [c.name, c.enabled]));
    expect(byName['kintone-get-records']).toBe(true);
    expect(byName['kintone-add-record']).toBe(true);
    expect(byName['kintone-delete-records']).toBe(false);
    expect(byName['kintone-get-apps']).toBe(false);
  });

  it('destructive ツール (kintone-delete-records) は always_ask', () => {
    const tools = buildAgentTools(KINTONE_TOOL_NAMES);
    const mcp = tools[3] as {
      configs: Array<{ name: string; permission_policy: { type: string } }>;
    };
    const del = mcp.configs.find((c) => c.name === 'kintone-delete-records')!;
    expect(del.permission_policy.type).toBe('always_ask');
    // 非破壊系は always_allow
    const get = mcp.configs.find((c) => c.name === 'kintone-get-records')!;
    expect(get.permission_policy.type).toBe('always_allow');
  });

  it('Set 渡しでも動く', () => {
    const tools = buildAgentTools(new Set(['kintone-get-records']));
    const mcp = tools[3] as { configs: Array<{ name: string; enabled: boolean }> };
    const byName = Object.fromEntries(mcp.configs.map((c) => [c.name, c.enabled]));
    expect(byName['kintone-get-records']).toBe(true);
    expect(byName['kintone-delete-records']).toBe(false);
  });
});

describe('extractEnabledTools (#40)', () => {
  it('tools[] から mcp_toolset.configs を読み取って enabled=true の tool 名を返す', () => {
    const tools = buildAgentTools(['kintone-get-records', 'kintone-add-record']);
    const enabled = extractEnabledTools(tools);
    expect(enabled.sort()).toEqual(['kintone-add-record', 'kintone-get-records']);
  });

  it('mcp_toolset が無いと全 tool を enabled 扱い (= default_config 継承)', () => {
    const tools = [{ type: 'agent_toolset_20260401' }];
    expect(extractEnabledTools(tools)).toEqual([...KINTONE_TOOL_NAMES]);
  });

  it('mcp_toolset.configs が空配列なら enabled tool 0 件', () => {
    const tools = [
      { type: 'mcp_toolset', mcp_server_name: 'kintone', configs: [] },
    ];
    expect(extractEnabledTools(tools)).toEqual([]);
  });

  it('未知の tool 名はスキップ', () => {
    const tools = [
      {
        type: 'mcp_toolset',
        mcp_server_name: 'kintone',
        configs: [
          { name: 'unknown-tool', enabled: true },
          { name: 'kintone-get-records', enabled: true },
        ],
      },
    ];
    expect(extractEnabledTools(tools)).toEqual(['kintone-get-records']);
  });
});
