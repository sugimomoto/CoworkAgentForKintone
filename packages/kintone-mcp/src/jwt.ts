// HMAC-SHA256 署名付き JWT の sign / verify。
// Web Crypto API のみ使用 (Cloudflare Workers / 標準ブラウザで動作)。
//
// 実装方針:
//  - 依存ライブラリ無し
//  - exp が payload にあれば verify 時にチェック (秒単位の Unix timestamp)
//  - signature は base64url で表現 (URL safe、padding なし)

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeJson(obj: object): string {
  return base64UrlEncode(ENC.encode(JSON.stringify(obj)));
}

function base64UrlDecode(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function importKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

/**
 * payload に署名して JWT 文字列を返す。
 * payload に `exp` (秒単位 Unix timestamp) があれば verify 側でチェックされる。
 */
export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const data = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const key = await importKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(data));
  return `${data}.${base64UrlEncode(sig)}`;
}

/**
 * JWT を検証して payload を返す。
 * - signature 不一致 → throw
 * - exp 切れ → throw
 * - 形式不正 → throw
 */
export async function verifyJwt<T = Record<string, unknown>>(
  jwt: string,
  secret: string,
): Promise<T> {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('malformed jwt: expected 3 segments');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const data = `${headerB64}.${payloadB64}`;
  const key = await importKey(secret, 'verify');
  const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(sigB64), ENC.encode(data));
  if (!valid) throw new Error('invalid signature');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(DEC.decode(new Uint8Array(base64UrlDecode(payloadB64))));
  } catch {
    throw new Error('malformed jwt: payload is not valid JSON');
  }

  if (typeof payload['exp'] === 'number' && payload['exp'] < Math.floor(Date.now() / 1000)) {
    throw new Error('token expired');
  }

  return payload as T;
}
