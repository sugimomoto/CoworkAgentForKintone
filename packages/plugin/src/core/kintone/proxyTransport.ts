// Cowork Agent for kintone — kintone.plugin.app.proxy 経由の Transport 実装
//
// Anthropic API への呼び出しはブラウザから直接行うと CORS でブロックされるため、
// kintone のサーバサイドプロキシ (kintone.plugin.app.proxy) 経由でルーティングする。
//
// 前提: kintone プラグイン管理画面の「プロキシ設定」で
//        URL パターン (https://api.anthropic.com/...) が登録されていること。

import type { Transport } from '../managed-agents/client';

/** kintone.plugin.app.proxy を Transport インタフェースに合わせて包む */
export function createKintoneProxyTransport(pluginId: string): Transport {
  return async (url, init) => {
    if (typeof kintone === 'undefined' || !kintone) {
      throw new Error('kintone JavaScript API is not available');
    }

    const method = init.method ?? 'GET';
    const headers = (init.headers ?? {}) as Record<string, string>;
    const data =
      typeof init.body === 'string'
        ? init.body
        : init.body === undefined || init.body === null
          ? ''
          : JSON.stringify(init.body);

    const [body, status] = await kintone.plugin.app.proxy(
      pluginId,
      url,
      method,
      headers,
      data,
    );

    // Response constructor: 1xx / 204 / 205 / 304 では body を null にする必要あり
    const noBodyStatuses = new Set([101, 103, 204, 205, 304]);
    const responseBody = noBodyStatuses.has(status) ? null : body;
    return new Response(responseBody, { status });
  };
}
