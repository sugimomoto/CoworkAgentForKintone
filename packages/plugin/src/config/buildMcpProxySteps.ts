// #42: 追加 MCP Server（OAuth confidential）の client_secret を kintone proxy 固定ヘッダで
// 注入するための setProxyConfig ステップを構築する純関数。
//
// secret はブラウザ（Plugin JS）に保持させず、kintone proxy の固定ヘッダ経由でのみ送る
// （kintone OAuth と同じ流儀の per-server 版）。対象は oauth かつ client_secret_basic のみ
// （post は kintone proxy がボディ注入できないため対象外）。
//
// 2 経路に登録する:
//   1. token_endpoint (POST): プラグインの authorization_code 交換用に Authorization: Basic を注入
//      （第三者ホスト＝そのホストの最長一致になるので独立して効く）
//   2. per-server upsert URL <workerRoot>credentials/upsert/{serverId} (POST):
//      kintone proxy は「最長一致の1登録だけ適用（マージ無し）」なので、この URL 専用登録に
//      **必要なヘッダを全部自己完結で載せる** = X-Anthropic-Api-Key（getProxyConfig で読戻し）
//      + X-Mcp-OAuth-Client-Id/Secret。Worker はこれらで Anthropic Vault の refresh 設定を作る。

import type { ProxyStep } from './buildProxySteps';
import type { McpServerDef } from '../core/mcp/registry';

export interface BuildMcpProxyStepsInput {
  server: Pick<McpServerDef, 'id' | 'authType' | 'tokenEndpoint' | 'clientId' | 'tokenEndpointAuthType'>;
  clientSecret: string;
  /** 保存済み Worker ルート proxy から getProxyConfig で読み戻した Anthropic API キー。 */
  anthropicApiKey: string;
  /** Worker root URL（末尾スラッシュ付き） */
  workerRootUrl: string;
}

/**
 * OAuth confidential(basic) サーバーの per-server proxy ステップ。
 * 対象外（none/bearer、oauth public、secret 未入力、post、Anthropic キー未取得）のときは空配列を返す。
 */
export function buildMcpProxySteps(input: BuildMcpProxyStepsInput): ProxyStep[] {
  const { server, clientSecret, anthropicApiKey, workerRootUrl } = input;
  if (server.authType !== 'oauth' || !server.tokenEndpoint) return [];

  const authType = server.tokenEndpointAuthType ?? 'none';
  // public(PKCE): secret を持たないが、ランタイム(kintone.plugin.app.proxy)は proxyConfig 登録済みの
  // ヘッダしか付けないため、token_endpoint に Content-Type だけ登録しておく必要がある
  // （これが無いと Auth0 等がフォームボディを解釈できず invalid_grant になる）。
  if (authType === 'none') {
    return [
      {
        url: server.tokenEndpoint,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    ];
  }
  if (authType !== 'basic') return []; // post=非対応
  if (!clientSecret || !server.clientId) return [];
  if (!anthropicApiKey) return []; // per-server URL は最長一致で総取り → Anthropic キーを自己完結で載せる必要

  const basic = btoa(`${server.clientId}:${clientSecret}`);
  const upsertUrl = `${workerRootUrl}credentials/upsert/${server.id}`;

  return [
    // 1. token 交換用（プラグインが token_endpoint を直接叩く）
    {
      url: server.tokenEndpoint,
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
    // 2. Vault refresh 設定用（Worker が serverId 限定 URL で受け取り Anthropic に転送）。
    //    最長一致で総取りされるため Anthropic キーもこの登録に自己完結で載せる。
    {
      url: upsertUrl,
      method: 'POST',
      headers: {
        'X-Anthropic-Api-Key': anthropicApiKey,
        'X-Mcp-OAuth-Client-Id': server.clientId,
        'X-Mcp-OAuth-Client-Secret': clientSecret,
        'Content-Type': 'application/json',
      },
    },
  ];
}
