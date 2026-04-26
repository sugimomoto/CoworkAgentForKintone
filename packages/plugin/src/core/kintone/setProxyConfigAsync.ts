// kintone.plugin.app.setProxyConfig のコールバック API を Promise 化するヘルパ。
// 設定画面 (admin) でしか呼べないので、ConfigScreen 専用に近い位置で使われる。

export function setProxyConfigAsync(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  headers: Record<string, string>,
  data: Record<string, string> = {},
): Promise<void> {
  if (typeof kintone === 'undefined' || !kintone.plugin?.app?.setProxyConfig) {
    return Promise.reject(
      new Error('kintone.plugin.app.setProxyConfig is not available (Plugin 設定画面でのみ呼出可能)'),
    );
  }
  return new Promise((resolve) => {
    kintone!.plugin.app.setProxyConfig(url, method, headers, data, () => resolve());
  });
}
