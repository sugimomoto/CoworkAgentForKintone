// kintone proxy 経由で cybozu /oauth2/token を叩いて authorization_code を tokens に交換する。
//
// kintone.plugin.app.setProxyConfig で `/oauth2/token` 用に
//   Authorization: Basic <base64(client_id:client_secret)>
//   Content-Type: application/x-www-form-urlencoded
// が固定ヘッダ登録されている前提。client_secret は Plugin JS には現れない。

export interface ExchangeArgs {
  pluginId: string;
  tokenUrl: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  /**
   * #42: public(PKCE) クライアントは client_secret を持たないため、token リクエストの body に
   * client_id を載せて本人性を示す。confidential は proxy が Basic 注入するので不要。
   */
  clientId?: string;
  /**
   * #42: RFC 8707 Resource Indicator。MCP の認可仕様が要求する MCP サーバーの正規 URL。
   * これが無いと token が対象リソース向けに発行されず、MCP 側で invalid_token になる。
   * kintone 自身の OAuth では未指定（付けると弾く AS があるため）。
   */
  resource?: string;
}

export interface KintoneTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

function parseTokenResponse(respBody: string, status: number, requireExpiry: boolean): KintoneTokens {
  if (status < 200 || status >= 300) {
    throw new Error(`token exchange failed (${status}): ${respBody}`);
  }
  let parsed: KintoneTokens;
  try {
    parsed = JSON.parse(respBody) as KintoneTokens;
  } catch {
    throw new Error(`token exchange returned invalid JSON: ${respBody}`);
  }
  if (typeof parsed.access_token !== 'string' || !parsed.access_token) {
    throw new Error('token exchange returned without access_token');
  }
  if (typeof parsed.expires_in !== 'number') {
    // Notion 等、失効しない/expires_in を返さないプロバイダがある。cybozu(kintone) は必ず返すので
    // ランタイム(requireExpiry=true)は厳格に。設定画面のプローブは access_token だけ使うので 0 埋め。
    if (requireExpiry) throw new Error('token exchange returned without expires_in');
    parsed = { ...parsed, expires_in: 0 };
  }
  return parsed;
}

export async function exchangeCodeForTokens(args: ExchangeArgs): Promise<KintoneTokens> {
  if (typeof kintone === 'undefined' || !kintone?.plugin?.app?.proxy) {
    throw new Error('kintone JavaScript API is not available');
  }
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
  });
  if (args.clientId) params.set('client_id', args.clientId);
  if (args.resource) params.set('resource', args.resource);

  // confidential は token_endpoint に proxyConfig（Basic + Content-Type）が登録済みなので {} でよい。
  // public(PKCE, client_id を body に載せる=clientId 指定時) は secret が無く proxyConfig を登録しない
  // ため Content-Type が付かず、フォームボディを解釈できず invalid_grant になる。明示的に付与する。
  const headers: Record<string, string> = args.clientId
    ? { 'Content-Type': 'application/x-www-form-urlencoded' }
    : {};
  const [respBody, status] = await kintone.plugin.app.proxy(
    args.pluginId,
    args.tokenUrl,
    'POST',
    headers,
    params.toString(),
  );
  return parseTokenResponse(respBody, status, true);
}

export interface ExchangeViaProxyArgs {
  tokenUrl: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  clientId: string;
  /** confidential(client_secret_basic) のとき指定。public(PKCE) は省略。 */
  clientSecret?: string;
  /** RFC 8707 Resource Indicator（MCP サーバーの正規 URL）。MCP OAuth では必須級。 */
  resource?: string;
}

/**
 * Plugin 設定画面用の token 交換。設定画面では `kintone.plugin.app.proxy` が使えないため、
 * 汎用 `kintone.proxy()` に明示ヘッダを載せて token_endpoint を直接叩く（cfDeploy と同じ流儀）。
 * confidential は Authorization: Basic を自前で組み立て、public は client_id を body に載せる。
 * setProxyConfig の固定ヘッダ注入には依存しない（管理者が取得時に client_secret を一度入力する）。
 */
export async function exchangeCodeForTokensViaProxy(args: ExchangeViaProxyArgs): Promise<KintoneTokens> {
  if (typeof kintone === 'undefined' || typeof kintone.proxy !== 'function') {
    throw new Error('kintone.proxy is not available (Plugin 設定画面以外では使えません)');
  }
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
  });
  if (args.resource) params.set('resource', args.resource);
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (args.clientSecret) {
    headers.Authorization = `Basic ${btoa(`${args.clientId}:${args.clientSecret}`)}`;
  } else {
    params.set('client_id', args.clientId); // public(PKCE)
  }
  const [respBody, status] = await kintone.proxy(args.tokenUrl, 'POST', headers, params.toString());
  return parseTokenResponse(respBody, status, false);
}
