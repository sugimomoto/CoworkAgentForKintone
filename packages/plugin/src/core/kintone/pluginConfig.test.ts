import { describe, expect, it } from 'vitest';

import { getPluginConfig, parseMcpServers, serializeMcpServers } from './pluginConfig';

import type { McpServerDef } from '../mcp/registry';

describe('parseMcpServers', () => {
  it('有効な配列をそのまま返す', () => {
    const servers: McpServerDef[] = [
      { id: 's1', name: 'GitHub', url: 'https://e.com/mcp', authType: 'bearer' },
    ];
    expect(parseMcpServers(JSON.stringify(servers))).toEqual(servers);
  });

  it('不正 JSON / 非文字列 / 非配列 は空配列', () => {
    expect(parseMcpServers('{bad json')).toEqual([]);
    expect(parseMcpServers(undefined)).toEqual([]);
    expect(parseMcpServers('')).toEqual([]);
    expect(parseMcpServers(JSON.stringify({ id: 's' }))).toEqual([]);
  });

  it('必須キーを欠く要素は除外する', () => {
    const raw = JSON.stringify([
      { id: 's1', name: 'ok', url: 'https://e.com', authType: 'none' },
      { id: 's2', name: 'missing url', authType: 'none' },
      { name: 'no id', url: 'https://e.com', authType: 'none' },
      null,
      'string',
    ]);
    const out = parseMcpServers(raw);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('s1');
  });

  it('serialize → parse のラウンドトリップ', () => {
    const servers: McpServerDef[] = [
      { id: 's1', name: 'X', url: 'https://e.com', authType: 'oauth', clientId: 'cid' },
    ];
    expect(parseMcpServers(serializeMcpServers(servers))).toEqual(servers);
  });
});

describe('getPluginConfig', () => {
  it('kintone 不在時は空 config（mcpServers=[]）', () => {
    // jsdom 環境では kintone は未定義
    const cfg = getPluginConfig('plugin_x');
    expect(cfg.workerUrl).toBeNull();
    expect(cfg.oauthClientId).toBeNull();
    expect(cfg.mcpServers).toEqual([]);
  });
});
