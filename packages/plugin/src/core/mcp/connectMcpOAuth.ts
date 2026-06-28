// #42 M3: 任意 MCP サーバーの OAuth(PKCE Authorization Code) 接続を per-user で行う汎用フロー。
// kintone 専用の useUserBinding.connect を McpServerDef でパラメタライズして抽出したもの。
//
// フロー: PKCE 生成 → authorization 認可 popup → code → token 交換(プラグイン経由) →
//         per-user Vault に mcp_oauth credential を upsert（refresh 設定込み）。
// 以降の refresh は Anthropic Vault が自動（#124 実証）。kintone 既存フローは据え置き。
//
// confidential(basic): client_secret は Plugin Config 保存時に setProxyConfig 済み
//   （token_endpoint への Basic / per-server upsert URL への X-Mcp-OAuth-Client-*）。
//   → ここでは proxy 注入に任せ、JS には secret を持たない。
// public(none): client_secret 不要。token 交換は client_id を body に載せる。

import { upsertKintoneCredential } from '../oauth/credentialsUpsertClient';
import { clearPkce, generatePkce, savePkce } from '../oauth/pkce';
import { openOAuthPopup } from '../oauth/popup';
import { exchangeCodeForTokens } from '../oauth/tokenExchange';
import { joinUrl } from '../utils';

import type { McpServerDef } from './registry';

function buildAuthorizationUrl(args: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(args.authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  if (args.scope) u.searchParams.set('scope', args.scope);
  u.searchParams.set('state', args.state);
  u.searchParams.set('code_challenge', args.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

export interface ConnectMcpOAuthArgs {
  pluginId: string;
  workerUrl: string;
  vaultId: string;
  server: McpServerDef;
  /** 既存 credential の更新時に渡す。 */
  credentialId?: string;
}

/**
 * MCP サーバーに OAuth 接続し、per-user Vault に mcp_oauth credential を作成する。
 * @returns 作成/更新された credential / vault id
 */
export async function connectMcpOAuth(
  args: ConnectMcpOAuthArgs,
): Promise<{ credential_id: string; vault_id: string }> {
  const { pluginId, workerUrl, vaultId, server } = args;
  if (server.authType !== 'oauth') throw new Error('OAuth 接続対象ではありません');
  if (!server.authorizationEndpoint || !server.tokenEndpoint || !server.clientId) {
    throw new Error('OAuth エンドポイント / client_id が未設定です');
  }
  const isPublic = (server.tokenEndpointAuthType ?? 'none') === 'none';

  const workerOrigin = new URL(workerUrl).origin;
  const redirectUri = joinUrl(workerUrl.replace(/\/$/, ''), 'oauth/callback');

  try {
    const pkce = await generatePkce();
    savePkce(pkce);

    const authUrl = buildAuthorizationUrl({
      authorizationEndpoint: server.authorizationEndpoint,
      clientId: server.clientId,
      redirectUri,
      ...(server.scope ? { scope: server.scope } : {}),
      state: pkce.state,
      codeChallenge: pkce.codeChallenge,
    });
    const payload = await openOAuthPopup({
      authorizationUrl: authUrl,
      expectedState: pkce.state,
      expectedOrigin: workerOrigin,
    });
    if (!payload.code) throw new Error('OAuth callback に code がありません');

    // token 交換（confidential は proxy が Basic 注入 / public は client_id を body に載せる）
    const tokens = await exchangeCodeForTokens({
      pluginId,
      tokenUrl: server.tokenEndpoint,
      redirectUri,
      code: payload.code,
      codeVerifier: pkce.codeVerifier,
      ...(isPublic ? { clientId: server.clientId } : {}),
    });

    const result = await upsertKintoneCredential({
      pluginId,
      workerUrl,
      vaultId,
      mcpServerUrl: server.url,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      tokenEndpoint: server.tokenEndpoint,
      ...(server.scope ? { scope: server.scope } : {}),
      ...(args.credentialId ? { credentialId: args.credentialId } : {}),
      // confidential は per-server URL（Anthropic キー + X-Mcp-OAuth-Client-* が proxy 注入される）。
      // public は worker root（secret 不要、Anthropic キーは root proxy）。
      ...(isPublic ? {} : { serverId: server.id }),
    });
    clearPkce();
    return result;
  } catch (err) {
    clearPkce();
    throw err;
  }
}
