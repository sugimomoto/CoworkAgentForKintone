// Cloudflare Worker `/mint` エンドポイントを kintone proxy 経由で呼び出すクライアント。
//
// admin が Plugin 設定画面で `MINT_API_KEY` を kintone.plugin.app.setProxyConfig 登録
// しておくと、kintone runtime が proxy 呼出時に Authorization: Bearer ヘッダを自動注入する。
// したがって Plugin JS は MINT_API_KEY 値を一切扱わずに /mint を呼べる
// (= end-user は MINT_API_KEY を読み出せない)。

export interface MintBasicAuthRequest {
  workerUrl: string;
  kintone_domain: string;
  kintone_login: string;
  kintone_password: string;
}

export interface MintApiTokenRequest {
  workerUrl: string;
  kintone_domain: string;
  kintone_api_token: string;
}

export type MintRequest = MintBasicAuthRequest | MintApiTokenRequest;

/**
 * `/mint` を叩いて JWT を取得する。
 * Plugin ID が必須 (kintone.plugin.app.proxy の第 1 引数)。
 */
export async function mintKintoneJwt(pluginId: string, req: MintRequest): Promise<string> {
  if (typeof kintone === 'undefined' || !kintone) {
    throw new Error('kintone JavaScript API is not available');
  }

  const url = `${req.workerUrl.replace(/\/$/, '')}/mint`;
  const body: Record<string, string> = { kintone_domain: req.kintone_domain };
  if ('kintone_api_token' in req) {
    body['kintone_api_token'] = req.kintone_api_token;
  } else {
    body['kintone_login'] = req.kintone_login;
    body['kintone_password'] = req.kintone_password;
  }

  const [responseBody, status] = await kintone.plugin.app.proxy(
    pluginId,
    url,
    'POST',
    {},
    JSON.stringify(body),
  );

  if (status < 200 || status >= 300) {
    throw new Error(`mint endpoint returned HTTP ${status}: ${responseBody}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    throw new Error(`mint endpoint returned non-JSON response: ${responseBody.slice(0, 100)}`);
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { jwt?: unknown }).jwt !== 'string'
  ) {
    throw new Error('mint endpoint returned invalid shape (jwt missing)');
  }
  return (parsed as { jwt: string }).jwt;
}
