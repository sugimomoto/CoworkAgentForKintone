// POST /credentials/upsert
//
// Plugin が kintone proxy 経由で叩く Anthropic Vault Credential 作成・更新の中継。
// Worker は何の secret も静的保持しない:
//   - Anthropic API key      → header X-Anthropic-Api-Key (kintone proxy 注入)
//   - kintone OAuth client   → header X-Kintone-OAuth-Client-Id / X-Kintone-OAuth-Client-Secret
// Body から受け取った user-context tokens を、Anthropic の **ネスト構造**
// (auth.refresh.token_endpoint_auth.client_secret) に詰めて転送するのが本ハンドラの
// 唯一の存在意義 (kintone proxy の data 引数がフラット限定でネスト不可なため)。

import { isString, isValidResourceId, jsonResponse, sanitizeText } from './_http';
import { anthropicHeaders } from './anthropic';

interface UpsertRequestBody {
  vaultId: string;
  credentialId?: string;
  /** 認証種別。省略時は従来通り mcp_oauth。'static_bearer' は通知 Webhook 用 (#13)。 */
  type?: 'mcp_oauth' | 'static_bearer';
  mcpServerUrl?: string;       // Create 時必須、Update では無視
  /** static_bearer 用: MCP URL 接続時に Authorization: Bearer として注入される値 (= Webhook URL)。 */
  token?: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  /** kintone OAuth /oauth2/token endpoint URL (Create 時必須) */
  tokenEndpoint?: string;
  scope?: string;
}

interface UpsertResponseBody {
  credential_id: string;
  vault_id: string;
}

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const ANTHROPIC_BETA = 'managed-agents-2026-04-01';

export async function handleCredentialsUpsert(request: Request): Promise<Response> {
  // ① X-Anthropic-Api-Key 必須
  const anthropicApiKey = request.headers.get('X-Anthropic-Api-Key');
  if (!isString(anthropicApiKey)) {
    return jsonResponse({ error: 'missing_anthropic_api_key' }, 401);
  }

  // ② body parse
  let body: UpsertRequestBody;
  try {
    body = (await request.json()) as UpsertRequestBody;
  } catch {
    return jsonResponse({ error: 'validation_failed', message: 'invalid JSON body' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'validation_failed', message: 'body must be an object' }, 400);
  }
  if (!isString(body.vaultId)) {
    return jsonResponse({ error: 'validation_failed', message: 'vaultId is required' }, 400);
  }
  if (!isValidResourceId(body.vaultId)) {
    return jsonResponse({ error: 'validation_failed', message: 'vaultId has invalid format' }, 400);
  }
  if (body.credentialId !== undefined && !isValidResourceId(body.credentialId)) {
    return jsonResponse(
      { error: 'validation_failed', message: 'credentialId has invalid format' },
      400,
    );
  }

  // --- static_bearer (通知 Webhook, #13) は mcp_oauth とは別系統で処理 ---
  if (body.type === 'static_bearer') {
    return handleStaticBearerUpsert(body, anthropicApiKey);
  }

  if (!isString(body.accessToken)) {
    return jsonResponse({ error: 'validation_failed', message: 'accessToken is required' }, 400);
  }
  if (typeof body.expiresIn !== 'number' || !Number.isFinite(body.expiresIn)) {
    return jsonResponse({ error: 'validation_failed', message: 'expiresIn must be a number' }, 400);
  }

  const isUpdate = isString(body.credentialId);
  const hasRefresh = isString(body.refreshToken);

  // OAuth client header (Create 時 + refresh 有時のみ必須)
  const clientId = request.headers.get('X-Kintone-OAuth-Client-Id');
  const clientSecret = request.headers.get('X-Kintone-OAuth-Client-Secret');
  if (!isUpdate && hasRefresh) {
    if (!isString(clientId)) {
      return jsonResponse(
        { error: 'validation_failed', message: 'X-Kintone-OAuth-Client-Id header is required for Create with refresh' },
        400,
      );
    }
    if (!isString(clientSecret)) {
      return jsonResponse(
        { error: 'validation_failed', message: 'X-Kintone-OAuth-Client-Secret header is required for Create with refresh' },
        400,
      );
    }
  }

  // Create 時のみ mcpServerUrl + (refresh 有時) tokenEndpoint 必須
  if (!isUpdate) {
    if (!isString(body.mcpServerUrl)) {
      return jsonResponse(
        { error: 'validation_failed', message: 'mcpServerUrl is required for Create' },
        400,
      );
    }
    if (hasRefresh && !isString(body.tokenEndpoint)) {
      return jsonResponse(
        { error: 'validation_failed', message: 'tokenEndpoint is required for Create with refresh' },
        400,
      );
    }
  }

  // ③ Anthropic body 組立
  const expiresAt = new Date(Date.now() + body.expiresIn * 1000).toISOString();

  const vaultPath = encodeURIComponent(body.vaultId);
  const anthropicUrl = isUpdate
    ? `${ANTHROPIC_BASE}/v1/vaults/${vaultPath}/credentials/${encodeURIComponent(body.credentialId!)}`
    : `${ANTHROPIC_BASE}/v1/vaults/${vaultPath}/credentials`;

  const anthropicBody = isUpdate
    ? buildUpdateBody({
        accessToken: body.accessToken,
        expiresAt,
        ...(hasRefresh && body.refreshToken ? { refreshToken: body.refreshToken } : {}),
        ...(body.scope !== undefined ? { scope: body.scope } : {}),
      })
    : buildCreateBody({
        mcpServerUrl: body.mcpServerUrl!,
        accessToken: body.accessToken,
        expiresAt,
        ...(hasRefresh && body.refreshToken
          ? {
              refresh: {
                refreshToken: body.refreshToken,
                tokenEndpoint: body.tokenEndpoint!,
                clientId: clientId!,
                clientSecret: clientSecret!,
                ...(body.scope !== undefined ? { scope: body.scope } : {}),
              },
            }
          : {}),
      });

  // ④ Anthropic 転送
  return forwardCredential(anthropicUrl, anthropicApiKey, anthropicBody);
}

/**
 * static_bearer 認証情報の作成・更新 (#13 通知)。
 * token (= Webhook URL) を Anthropic Vault に格納し、対応する MCP URL 接続時に
 * Authorization: Bearer として注入させる。token はログ・レスポンスに一切出さない。
 */
async function handleStaticBearerUpsert(
  body: UpsertRequestBody,
  anthropicApiKey: string,
): Promise<Response> {
  if (!isString(body.token)) {
    return jsonResponse({ error: 'validation_failed', message: 'token is required' }, 400);
  }
  const isUpdate = isString(body.credentialId);
  if (!isUpdate && !isString(body.mcpServerUrl)) {
    return jsonResponse(
      { error: 'validation_failed', message: 'mcpServerUrl is required for Create' },
      400,
    );
  }

  const vaultPath = encodeURIComponent(body.vaultId);
  const anthropicUrl = isUpdate
    ? `${ANTHROPIC_BASE}/v1/vaults/${vaultPath}/credentials/${encodeURIComponent(body.credentialId!)}`
    : `${ANTHROPIC_BASE}/v1/vaults/${vaultPath}/credentials`;

  const anthropicBody = isUpdate
    ? { auth: { type: 'static_bearer', token: body.token } }
    : {
        auth: {
          type: 'static_bearer',
          token: body.token,
          mcp_server_url: body.mcpServerUrl!,
        },
        display_name: 'notify',
      };

  return forwardCredential(anthropicUrl, anthropicApiKey, anthropicBody);
}

/** Anthropic credentials API へ転送し、{credential_id, vault_id} を返す。失敗時はサニタイズ。 */
async function forwardCredential(
  anthropicUrl: string,
  anthropicApiKey: string,
  anthropicBody: unknown,
): Promise<Response> {
  const upstreamRes = await fetch(anthropicUrl, {
    method: 'POST',
    headers: {
      ...anthropicHeaders(anthropicApiKey, ANTHROPIC_BETA),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(anthropicBody),
  });

  const upstreamText = await upstreamRes.text();

  if (!upstreamRes.ok) {
    return jsonResponse(
      { error: 'anthropic_error', status: upstreamRes.status, body: sanitizeText(upstreamText) },
      upstreamRes.status,
    );
  }

  let upstreamJson: { id?: string; vault_id?: string };
  try {
    upstreamJson = JSON.parse(upstreamText);
  } catch {
    return jsonResponse(
      { error: 'anthropic_error', status: upstreamRes.status, body: sanitizeText(upstreamText) },
      502,
    );
  }
  if (!isString(upstreamJson.id) || !isString(upstreamJson.vault_id)) {
    return jsonResponse(
      { error: 'anthropic_error', status: upstreamRes.status, body: sanitizeText(upstreamText) },
      502,
    );
  }

  const result: UpsertResponseBody = {
    credential_id: upstreamJson.id,
    vault_id: upstreamJson.vault_id,
  };
  return jsonResponse(result, 200);
}

interface CreateBodyArgs {
  mcpServerUrl: string;
  accessToken: string;
  expiresAt: string;
  refresh?: {
    refreshToken: string;
    tokenEndpoint: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
  };
}

function buildCreateBody(args: CreateBodyArgs): unknown {
  return {
    auth: {
      type: 'mcp_oauth',
      mcp_server_url: args.mcpServerUrl,
      access_token: args.accessToken,
      expires_at: args.expiresAt,
      ...(args.refresh
        ? {
            refresh: {
              refresh_token: args.refresh.refreshToken,
              token_endpoint: args.refresh.tokenEndpoint,
              client_id: args.refresh.clientId,
              ...(args.refresh.scope !== undefined ? { scope: args.refresh.scope } : {}),
              token_endpoint_auth: {
                type: 'client_secret_basic',
                client_secret: args.refresh.clientSecret,
              },
            },
          }
        : {}),
    },
    display_name: 'kintone',
  };
}

interface UpdateBodyArgs {
  accessToken: string;
  expiresAt: string;
  refreshToken?: string;
  scope?: string;
}

function buildUpdateBody(args: UpdateBodyArgs): unknown {
  return {
    auth: {
      type: 'mcp_oauth',
      access_token: args.accessToken,
      expires_at: args.expiresAt,
      ...(args.refreshToken
        ? {
            refresh: {
              refresh_token: args.refreshToken,
              ...(args.scope !== undefined ? { scope: args.scope } : {}),
            },
          }
        : {}),
    },
  };
}
