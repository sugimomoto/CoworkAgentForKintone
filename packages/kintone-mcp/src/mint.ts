// POST /mint エンドポイント。
// Plugin が kintone proxy 経由で叩いてくる。Bearer = MINT_API_KEY を検証し、
// kintone 認証情報 (Basic 認証 or API トークン) を内包した JWT を発行する。

import type { Env } from './index';
import { signJwt } from './jwt';

interface MintBodyBasic {
  kintone_domain: string;
  kintone_login: string;
  kintone_password: string;
  kintone_api_token?: undefined;
}

interface MintBodyApiToken {
  kintone_domain: string;
  kintone_api_token: string;
  kintone_login?: undefined;
  kintone_password?: undefined;
}

type MintBody = MintBodyBasic | MintBodyApiToken;

const JWT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function validateBody(raw: unknown): { ok: true; body: MintBody } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'body must be an object' };
  }
  const b = raw as Record<string, unknown>;
  if (typeof b['kintone_domain'] !== 'string' || b['kintone_domain'] === '') {
    return { ok: false, error: 'kintone_domain is required' };
  }
  if (typeof b['kintone_api_token'] === 'string' && b['kintone_api_token'] !== '') {
    return {
      ok: true,
      body: {
        kintone_domain: b['kintone_domain'],
        kintone_api_token: b['kintone_api_token'],
      },
    };
  }
  if (typeof b['kintone_login'] === 'string' && typeof b['kintone_password'] === 'string') {
    return {
      ok: true,
      body: {
        kintone_domain: b['kintone_domain'],
        kintone_login: b['kintone_login'],
        kintone_password: b['kintone_password'],
      },
    };
  }
  return { ok: false, error: 'either kintone_api_token or kintone_login/password is required' };
}

export async function handleMint(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization');
  const expected = `Bearer ${env.MINT_API_KEY}`;
  if (!auth || !timingSafeEqual(auth, expected)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400);
  }

  const validated = validateBody(raw);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const kintone =
    'kintone_api_token' in validated.body
      ? {
          domain: validated.body.kintone_domain,
          auth_type: 'api_token' as const,
          api_token: validated.body.kintone_api_token,
        }
      : {
          domain: validated.body.kintone_domain,
          auth_type: 'basic' as const,
          login: validated.body.kintone_login,
          password: validated.body.kintone_password,
        };

  const jwt = await signJwt(
    {
      iss: 'cowork-agent-for-kintone',
      sub: 'kintone-creds',
      iat: now,
      exp: now + JWT_TTL_SECONDS,
      kintone,
    },
    env.JWT_HMAC_SECRET,
  );

  return jsonResponse({ jwt });
}
