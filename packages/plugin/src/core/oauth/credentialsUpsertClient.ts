// kintone proxy 経由で Worker /credentials/upsert を叩いて Anthropic Vault Credential を
// 作成 or 更新する。
//
// kintone setProxyConfig に以下が固定登録されている前提:
//   X-Anthropic-Api-Key: <ANTHROPIC_API_KEY>
//   X-Kintone-OAuth-Client-Id: <client_id>
//   X-Kintone-OAuth-Client-Secret: <client_secret>
//   Content-Type: application/json

export interface UpsertKintoneCredentialArgs {
  pluginId: string;
  workerUrl: string;
  vaultId: string;
  credentialId?: string;
  mcpServerUrl: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  /** kintone /oauth2/token URL (Anthropic refresh で使われる) */
  tokenEndpoint?: string;
  scope?: string;
}

export interface UpsertResult {
  credential_id: string;
  vault_id: string;
}

export class CredentialUpsertError extends Error {
  status: number;
  responseBody: string;
  constructor(status: number, responseBody: string) {
    super(`credentials/upsert failed (${status}): ${responseBody}`);
    this.name = 'CredentialUpsertError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export async function upsertKintoneCredential(
  args: UpsertKintoneCredentialArgs,
): Promise<UpsertResult> {
  if (typeof kintone === 'undefined' || !kintone?.plugin?.app?.proxy) {
    throw new Error('kintone JavaScript API is not available');
  }

  const url = `${args.workerUrl.replace(/\/$/, '')}/credentials/upsert`;
  const body: Record<string, unknown> = {
    vaultId: args.vaultId,
    mcpServerUrl: args.mcpServerUrl,
    accessToken: args.accessToken,
    expiresIn: args.expiresIn,
  };
  if (args.credentialId) body['credentialId'] = args.credentialId;
  if (args.refreshToken) body['refreshToken'] = args.refreshToken;
  if (args.tokenEndpoint) body['tokenEndpoint'] = args.tokenEndpoint;
  if (args.scope) body['scope'] = args.scope;

  const [respBody, status] = await kintone.plugin.app.proxy(
    args.pluginId,
    url,
    'POST',
    {}, // X-Anthropic-Api-Key / X-Kintone-OAuth-Client-* は setProxyConfig 由来
    JSON.stringify(body),
  );

  if (status < 200 || status >= 300) {
    throw new CredentialUpsertError(status, respBody);
  }

  let parsed: { credential_id?: string; vault_id?: string };
  try {
    parsed = JSON.parse(respBody);
  } catch {
    throw new Error(`credentials/upsert returned invalid JSON: ${respBody}`);
  }
  if (!parsed.credential_id || !parsed.vault_id) {
    throw new Error('credentials/upsert response missing credential_id or vault_id');
  }
  return { credential_id: parsed.credential_id, vault_id: parsed.vault_id };
}

export interface UpsertStaticBearerCredentialArgs {
  pluginId: string;
  workerUrl: string;
  vaultId: string;
  /** Update 時のみ。省略時は Create。 */
  credentialId?: string;
  /** Create 時必須: static_bearer を注入する対象の MCP URL (= /notify/<domain>/<key>)。 */
  mcpServerUrl?: string;
  /** 注入する Bearer 値 (= Webhook URL)。ログ・JS 側に保持しない。 */
  token: string;
}

/**
 * 通知 Webhook 用の static_bearer 認証情報を Vault に upsert する (#13)。
 * token (= Webhook URL) は Worker を素通りして Anthropic Vault に格納され、
 * 以後 JS から読み出すことはできない。
 */
export async function upsertStaticBearerCredential(
  args: UpsertStaticBearerCredentialArgs,
): Promise<UpsertResult> {
  if (typeof kintone === 'undefined' || !kintone?.plugin?.app?.proxy) {
    throw new Error('kintone JavaScript API is not available');
  }

  const url = `${args.workerUrl.replace(/\/$/, '')}/credentials/upsert`;
  const body: Record<string, unknown> = {
    vaultId: args.vaultId,
    type: 'static_bearer',
    token: args.token,
  };
  if (args.credentialId) body['credentialId'] = args.credentialId;
  if (args.mcpServerUrl) body['mcpServerUrl'] = args.mcpServerUrl;

  const [respBody, status] = await kintone.plugin.app.proxy(
    args.pluginId,
    url,
    'POST',
    {},
    JSON.stringify(body),
  );

  if (status < 200 || status >= 300) {
    throw new CredentialUpsertError(status, respBody);
  }

  let parsed: { credential_id?: string; vault_id?: string };
  try {
    parsed = JSON.parse(respBody);
  } catch {
    throw new Error(`credentials/upsert returned invalid JSON: ${respBody}`);
  }
  if (!parsed.credential_id || !parsed.vault_id) {
    throw new Error('credentials/upsert response missing credential_id or vault_id');
  }
  return { credential_id: parsed.credential_id, vault_id: parsed.vault_id };
}
