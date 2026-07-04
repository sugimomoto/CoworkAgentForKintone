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
import { exchangeCodeForTokens, exchangeCodeForTokensViaProxy } from '../oauth/tokenExchange';
import { joinUrl } from '../utils';

import { fetchMcpTools } from './toolsList';

import type { McpServerDef, McpTool } from './registry';

function buildAuthorizationUrl(args: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state: string;
  codeChallenge: string;
  /** RFC 8707 Resource Indicator（MCP サーバーの正規 URL）。 */
  resource?: string;
}): string {
  const u = new URL(args.authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  if (args.scope) u.searchParams.set('scope', args.scope);
  u.searchParams.set('state', args.state);
  u.searchParams.set('code_challenge', args.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  if (args.resource) u.searchParams.set('resource', args.resource);
  return u.toString();
}

/**
 * OAuth(PKCE Authorization Code) で access_token を1回取得する（Vault には保存しない）。
 * Plugin 設定画面で動く前提のため、token 交換は `kintone.proxy`（設定画面OK）を使う
 * exchangeCodeForTokensViaProxy 経由。confidential(basic) は clientSecret を明示的に渡す
 * （設定画面では proxyConfig の Basic 注入が使えないため、取得時に一度入力してもらう）。
 * 管理画面でのツール一覧取得（使い捨てプローブ）に使う。
 */
async function acquireOAuthAccessToken(args: {
  workerUrl: string;
  server: McpServerDef;
  clientSecret?: string;
}): Promise<string> {
  const { workerUrl, server, clientSecret } = args;
  if (server.authType !== 'oauth') throw new Error('OAuth 接続対象ではありません');
  if (!server.authorizationEndpoint || !server.tokenEndpoint || !server.clientId) {
    throw new Error('OAuth エンドポイント / client_id が未設定です');
  }
  const isPublic = (server.tokenEndpointAuthType ?? 'none') === 'none';
  if (!isPublic && !clientSecret) {
    throw new Error('confidential クライアントは client_secret が必要です');
  }
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
      resource: server.url, // RFC 8707: token を MCP サーバー向けに発行させる
    });
    const payload = await openOAuthPopup({
      authorizationUrl: authUrl,
      expectedState: pkce.state,
      expectedOrigin: workerOrigin,
    });
    if (!payload.code) throw new Error('OAuth callback に code がありません');
    const tokens = await exchangeCodeForTokensViaProxy({
      tokenUrl: server.tokenEndpoint,
      redirectUri,
      code: payload.code,
      codeVerifier: pkce.codeVerifier,
      clientId: server.clientId,
      resource: server.url,
      ...(isPublic ? {} : { clientSecret: clientSecret! }),
    });
    clearPkce();
    return tokens.access_token;
  } catch (err) {
    clearPkce();
    throw err;
  }
}

/**
 * OAuth サーバーの公開ツール一覧を取得する（管理者がカタログにツールをキャッシュする用）。
 * 認可フローで一時 access_token を得て tools/list を叩き、token は保持しない。
 * confidential(basic) は clientSecret を渡す（public は不要）。
 */
export async function fetchMcpToolsViaOAuth(args: {
  workerUrl: string;
  server: McpServerDef;
  clientSecret?: string;
}): Promise<McpTool[]> {
  const accessToken = await acquireOAuthAccessToken(args);
  return fetchMcpTools({ url: args.server.url, bearerToken: accessToken });
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
      resource: server.url, // RFC 8707: token を MCP サーバー向けに発行させる
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
      resource: server.url,
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
