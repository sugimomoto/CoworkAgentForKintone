// Cowork Agent for kintone — desktop エントリ
//
// レコード一覧画面 (app.record.index.show) でチャットパネルをマウントする。

import { createRoot } from 'react-dom/client';

import { createKintoneProxyTransport } from '../core/kintone/proxyTransport';
import { setTransport } from '../core/managed-agents/client';
import { useChatStore } from '../store/chatStore';

import { App } from './App';

const ROOT_ID = 'cowork-agent-root';

function mountRoot(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;

  // パネル / FAB の position は App 内側で fixed 指定するので、
  // ルートコンテナ自体はレイアウトを取らない。
  const root = document.createElement('div');
  root.id = ROOT_ID;
  document.body.appendChild(root);
  return root;
}

(function (PLUGIN_ID: string | undefined) {
  if (typeof kintone === 'undefined' || !kintone) return;

  if (PLUGIN_ID) {
    // Anthropic API 呼出を kintone.plugin.app.proxy 経由にルーティング (CORS 回避)。
    // x-api-key は ConfigScreen で setProxyConfig 登録された固定ヘッダとして
    // kintone runtime が自動注入するため、JS 側からは渡さない。
    setTransport(createKintoneProxyTransport(PLUGIN_ID));
    // Plugin ID を store に保存。useUserBinding が /mint 呼出時に kintone proxy の
    // 第 1 引数として使う。
    useChatStore.getState().setPluginId(PLUGIN_ID);
  }

  kintone.events.on('app.record.index.show', (event) => {
    const root = mountRoot();
    if (!root.dataset['mounted']) {
      root.dataset['mounted'] = '1';
      createRoot(root).render(<App />);
    }
    return event;
  });
})((kintone as unknown as { $PLUGIN_ID?: string } | undefined)?.$PLUGIN_ID);
