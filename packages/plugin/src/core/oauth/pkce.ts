// PKCE (RFC 7636) と OAuth state 生成 + sessionStorage への保管。
//
// connect 開始時に generatePkce() → savePkce() → popup を開き、
// callback 受信後に loadPkce() で取り出して state 検証 + token 交換に使う。

export interface PkceState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

const STORAGE_KEY = 'cowork-agent.oauth.pkce';

/** RFC 7636 では code_verifier は 43-128 文字 base64url。32 bytes random → 43 chars */
const CODE_VERIFIER_BYTES = 32;
/** state は CSRF 防御用。16 bytes (128 bit) で十分 */
const STATE_BYTES = 16;

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

// state は `<random>.<base64url(origin)>` の 2 セグメント構成。
// Worker (oauth-callback) が後半をデコードして postMessage の targetOrigin を決め、
// 認可コードが想定外のオリジンへ流出しないようにする。base64url に `.` は出現しないため
// 区切り文字として安全。前半は従来どおり CSRF 防御の random nonce。
function encodeStateWithOrigin(random: string, origin: string): string {
  if (!origin) return random;
  return `${random}.${base64url(new TextEncoder().encode(origin))}`;
}

export async function generatePkce(): Promise<PkceState> {
  const codeVerifier = randomBase64Url(CODE_VERIFIER_BYTES);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(digest);
  const origin = typeof location !== 'undefined' ? location.origin : '';
  const state = encodeStateWithOrigin(randomBase64Url(STATE_BYTES), origin);
  return { codeVerifier, codeChallenge, state };
}

export function savePkce(p: PkceState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function loadPkce(): PkceState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PkceState;
    if (
      typeof parsed.codeVerifier === 'string' &&
      typeof parsed.codeChallenge === 'string' &&
      typeof parsed.state === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPkce(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
