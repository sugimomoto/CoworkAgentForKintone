// kintone.plugin.app.getConfig からプラグイン設定値を読み取るヘルパ。
// admin が ConfigScreen で保存した値を end-user 側 JS から参照する用途。
//
// secret 値 (Anthropic API Key / OAuth client_secret) は setProxyConfig 側に
// 固定ヘッダで保管され、Plugin JS からは getConfig で読み出せない。
// ここから取れるのは「URL や client_id など公開しても問題ない設定」のみ。
//
// 注意: skill 同期情報 (旧 skillsMapping / skillsVersion) は Anthropic Workspace に
// 一元化したため、ここでは保持しない。代わりに `resolveBundledSkillIds` が
// `/v1/skills?source=custom` を fetch して display_title で照合する。

import type { McpServerDef } from '../mcp/registry';

const CONFIG_KEY_WORKER_URL = 'workerUrl';
const CONFIG_KEY_OAUTH_CLIENT_ID = 'oauthClientId';
// #42: 追加 MCP Server のカタログ（テナント共有）。JSON 文字列で保存。
// client_secret は含まない（setProxyConfig 側に保管）。
const CONFIG_KEY_MCP_SERVERS = 'mcpServers';

export interface PluginConfig {
  workerUrl: string | null;
  oauthClientId: string | null;
  /** #42 追加 MCP Server 定義。未設定 / 不正 JSON なら空配列。 */
  mcpServers: McpServerDef[];
}

const EMPTY_CONFIG: PluginConfig = {
  workerUrl: null,
  oauthClientId: null,
  mcpServers: [],
};

/** mcpServers の JSON 文字列を安全にパースする。不正・型不一致なら空配列。 */
export function parseMcpServers(raw: unknown): McpServerDef[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (s): s is McpServerDef =>
      !!s &&
      typeof s === 'object' &&
      typeof (s as McpServerDef).id === 'string' &&
      typeof (s as McpServerDef).name === 'string' &&
      typeof (s as McpServerDef).url === 'string' &&
      typeof (s as McpServerDef).authType === 'string',
  );
}

/**
 * Plugin ID 配下の通常 config を取得する。
 */
export function getPluginConfig(pluginId: string): PluginConfig {
  if (typeof kintone === 'undefined' || !kintone) {
    return { ...EMPTY_CONFIG, mcpServers: [] };
  }
  const raw = kintone.plugin.app.getConfig(pluginId) ?? {};
  const pickStr = (key: string): string | null => {
    const v = raw[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  return {
    workerUrl: pickStr(CONFIG_KEY_WORKER_URL),
    oauthClientId: pickStr(CONFIG_KEY_OAUTH_CLIENT_ID),
    mcpServers: parseMcpServers(raw[CONFIG_KEY_MCP_SERVERS]),
  };
}

/** mcpServers を Plugin Config 保存用の JSON 文字列にする。 */
export function serializeMcpServers(servers: McpServerDef[]): string {
  return JSON.stringify(servers);
}

export const PLUGIN_CONFIG_KEYS = {
  WORKER_URL: CONFIG_KEY_WORKER_URL,
  OAUTH_CLIENT_ID: CONFIG_KEY_OAUTH_CLIENT_ID,
  MCP_SERVERS: CONFIG_KEY_MCP_SERVERS,
} as const;
