// Cowork Agent for kintone — config エントリ
// kintone プラグイン設定画面でマウントされる

import { createRoot } from 'react-dom/client';

import { ConfigScreen } from './ConfigScreen';

(function (PLUGIN_ID: string | undefined) {
  const pluginId = PLUGIN_ID ?? '';

  function mount(): void {
    const existing = document.getElementById('cowork-agent-config-root');
    if (existing) return;

    const container = document.createElement('div');
    container.id = 'cowork-agent-config-root';
    container.className = 'cowork-agent-root';
    document.body.appendChild(container);

    createRoot(container).render(<ConfigScreen pluginId={pluginId} />);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})((kintone as unknown as { $PLUGIN_ID?: string } | undefined)?.$PLUGIN_ID);
