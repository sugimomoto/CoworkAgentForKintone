// Cowork Agent for kintone — desktop エントリ
//
// レコード一覧画面 (app.record.index.show) でチャットパネルをマウントする。

import { createRoot } from 'react-dom/client';

import { getPluginConfig } from '../core/kintone/pluginConfig';
import { createKintoneProxyTransport } from '../core/kintone/proxyTransport';
import { setApiBase, setTransport } from '../core/managed-agents/client';
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

/**
 * デバッグログを有効化する。`?coworkDebug=1` が URL にあるときだけ window フラグを立てる。
 * `core/debug.ts` の info ログ (custom_tool 配線等) が console に流れるようになる。
 */
function exposeDebugFlag(): void {
  if (typeof window === 'undefined') return;
  if (window.location && window.location.search.includes('coworkDebug=1')) {
    (window as unknown as { __coworkDebug?: boolean }).__coworkDebug = true;
  }
}

/**
 * E2E テスト用の最小 API。`?coworkE2e=1` が URL に含まれるときだけ window に露出する。
 * 内部 store の setter を直接叩けるようにし、LLM 呼び出し抜きで artifact ペイン /
 * レンダラの DOM 振る舞いを検証できるようにする。
 */
function exposeTestApiIfRequested(): void {
  if (typeof window === 'undefined') return;
  if (!window.location || !window.location.search.includes('coworkE2e=1')) return;
  (window as unknown as { __coworkAgent?: unknown }).__coworkAgent = {
    // Artifact 系
    upsertArtifact: (input: Parameters<ReturnType<typeof useChatStore.getState>['upsertArtifact']>[0]) =>
      useChatStore.getState().upsertArtifact(input),
    setActiveArtifact: (id: string | null) =>
      useChatStore.getState().setActiveArtifact(id),
    clearArtifacts: () => useChatStore.getState().clearArtifacts(),
    getActiveArtifactId: () => useChatStore.getState().activeArtifactId,
    getArtifactCount: () => useChatStore.getState().artifacts.size,
    // Attachment 系
    addAttachedFile: (
      input: Parameters<ReturnType<typeof useChatStore.getState>['addAttachedFile']>[0],
    ) => useChatStore.getState().addAttachedFile(input),
    updateAttachedFile: (
      localId: string,
      patch: Parameters<ReturnType<typeof useChatStore.getState>['updateAttachedFile']>[1],
    ) => useChatStore.getState().updateAttachedFile(localId, patch),
    removeAttachedFile: (localId: string) =>
      useChatStore.getState().removeAttachedFile(localId),
    clearAttachedFiles: () => useChatStore.getState().clearAttachedFiles(),
    getAttachedFiles: () => useChatStore.getState().attachedFiles,
  };
}

(function (PLUGIN_ID: string | undefined) {
  if (typeof kintone === 'undefined' || !kintone) return;
  exposeDebugFlag();
  exposeTestApiIfRequested();

  if (PLUGIN_ID) {
    // Anthropic API 呼出を kintone.plugin.app.proxy 経由にルーティング (CORS 回避)。
    // x-api-key は ConfigScreen で setProxyConfig 登録された固定ヘッダとして
    // kintone runtime が自動注入するため、JS 側からは渡さない。
    setTransport(createKintoneProxyTransport(PLUGIN_ID));
    // Plugin ID を store に保存。useUserBinding が /mint 呼出時に kintone proxy の
    // 第 1 引数として使う。
    useChatStore.getState().setPluginId(PLUGIN_ID);

    // Issue #31: Anthropic API は Worker /anthropic/* 経由で叩く。
    // workerUrl が設定されていれば API base を Worker passthrough に切替。
    const cfg = getPluginConfig(PLUGIN_ID);
    if (cfg.workerUrl) {
      setApiBase(`${cfg.workerUrl.replace(/\/$/, '')}/anthropic`);
    }
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
