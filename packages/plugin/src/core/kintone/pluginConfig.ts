// kintone.plugin.app.getConfig からプラグイン設定値を読み取るヘルパ。
// admin が ConfigScreen で保存した値を end-user 側 JS から参照する用途。
//
// secret 値 (Anthropic API Key / MINT_API_KEY) は setProxyConfig 側に保管され
// JS から取り出せない。ここから取れるのは「URL や登録済みフラグ」など
// 公開しても問題ない設定のみ。

const CONFIG_KEY_WORKER_URL = 'workerUrl';

interface PluginConfig {
  workerUrl: string | null;
}

/**
 * Plugin ID 配下の通常 config を取得する。
 */
export function getPluginConfig(pluginId: string): PluginConfig {
  if (typeof kintone === 'undefined' || !kintone) {
    return { workerUrl: null };
  }
  const raw = kintone.plugin.app.getConfig(pluginId) ?? {};
  const workerUrl = raw[CONFIG_KEY_WORKER_URL];
  return {
    workerUrl: typeof workerUrl === 'string' && workerUrl.length > 0 ? workerUrl : null,
  };
}
