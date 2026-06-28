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
}

export interface KintoneTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
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
  const body = params.toString();

  const [respBody, status] = await kintone.plugin.app.proxy(
    args.pluginId,
    args.tokenUrl,
    'POST',
    {}, // ヘッダは setProxyConfig で固定済 (Basic auth + Content-Type)
    body,
  );

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
    throw new Error('token exchange returned without expires_in');
  }
  return parsed;
}
