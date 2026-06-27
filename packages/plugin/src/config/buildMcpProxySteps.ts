// #42: 追加 MCP Server（OAuth confidential）の client_secret を kintone proxy 固定ヘッダで
// 注入するための setProxyConfig ステップを構築する純関数。
//
// secret はブラウザ（Plugin JS）に保持させず、kintone proxy の固定ヘッダ経由でのみ送る
// （kintone OAuth と同じ流儀の per-server 版）。対象は oauth かつ client_secret_basic のみ
// （post は kintone proxy がボディ注入できないため対象外）。
//
// 2 経路に登録する:
//   1. token_endpoint (POST): プラグインの authorization_code 交換用に Authorization: Basic を注入
//   2. per-server upsert URL <workerRoot>credentials/upsert/{serverId} (POST): Worker が Anthropic Vault の
//      refresh 設定 (auth.refresh.token_endpoint_auth.client_secret) に積むための client_id/secret を注入

import type { ProxyStep } from './buildProxySteps';
import type { McpServerDef } from '../core/mcp/registry';

export interface BuildMcpProxyStepsInput {
  server: Pick<McpServerDef, 'id' | 'authType' | 'tokenEndpoint' | 'clientId' | 'tokenEndpointAuthType'>;
  clientSecret: string;
  /** Worker root URL（末尾スラッシュ付き） */
  workerRootUrl: string;
}

/**
 * OAuth confidential(basic) サーバーの secret 注入用 proxy ステップ。
 * 対象外（none/bearer、oauth public、secret 未入力、post）のときは空配列を返す。
 */
export function buildMcpProxySteps(input: BuildMcpProxyStepsInput): ProxyStep[] {
  const { server, clientSecret, workerRootUrl } = input;
  if (server.authType !== 'oauth') return [];
  if (server.tokenEndpointAuthType !== 'basic') return []; // none(PKCE)=secret不要, post=非対応
  if (!clientSecret || !server.clientId || !server.tokenEndpoint) return [];

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
    // 2. Vault refresh 設定用（Worker が serverId 限定 URL で受け取り Anthropic に転送）
    {
      url: upsertUrl,
      method: 'POST',
      headers: {
        'X-Mcp-OAuth-Client-Id': server.clientId,
        'X-Mcp-OAuth-Client-Secret': clientSecret,
        'Content-Type': 'application/json',
      },
    },
  ];
}
