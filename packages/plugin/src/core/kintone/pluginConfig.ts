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

const CONFIG_KEY_WORKER_URL = 'workerUrl';
const CONFIG_KEY_OAUTH_CLIENT_ID = 'oauthClientId';

export interface PluginConfig {
  workerUrl: string | null;
  oauthClientId: string | null;
}

const EMPTY_CONFIG: PluginConfig = {
  workerUrl: null,
  oauthClientId: null,
};

/**
 * Plugin ID 配下の通常 config を取得する。
 */
export function getPluginConfig(pluginId: string): PluginConfig {
  if (typeof kintone === 'undefined' || !kintone) {
    return { ...EMPTY_CONFIG };
  }
  const raw = kintone.plugin.app.getConfig(pluginId) ?? {};
  const pickStr = (key: string): string | null => {
    const v = raw[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  return {
    workerUrl: pickStr(CONFIG_KEY_WORKER_URL),
    oauthClientId: pickStr(CONFIG_KEY_OAUTH_CLIENT_ID),
  };
}

export const PLUGIN_CONFIG_KEYS = {
  WORKER_URL: CONFIG_KEY_WORKER_URL,
  OAUTH_CLIENT_ID: CONFIG_KEY_OAUTH_CLIENT_ID,
} as const;
