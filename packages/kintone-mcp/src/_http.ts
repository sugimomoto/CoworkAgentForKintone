// Worker 共通 HTTP ヘルパ。

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 非空文字列の type guard */
export function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** Bearer / API key 等のログ用マスク。先頭 8 + 末尾 4 + 長さ */
export function maskToken(token: string): string {
  if (token.length <= 16) return `(len=${token.length})`;
  return `${token.slice(0, 8)}...${token.slice(-4)} (len=${token.length})`;
}

/**
 * Vault ID / Credential ID として URL パスに埋め込んでよい形式か検証する。
 * Anthropic の ID は英数字 + `_` + `-` で構成される。パストラバーサル (`/` 等) を防ぐ。
 */
export function isValidResourceId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]+$/.test(v);
}

// ログ・エラーレスポンスに上流 API のメッセージをそのまま載せると、
// API キーやトークンが混入しうる。出力前に既知の秘匿パターンを伏字にする。
const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/g, // Anthropic API key
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g, // Bearer token
  /eyJ[A-Za-z0-9._-]{20,}/g, // JWT 様 (header.payload.signature)
];

/** エラーメッセージから既知の秘匿情報パターンを伏字にして文字列化する。 */
export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  for (const re of SECRET_PATTERNS) msg = msg.replace(re, '[REDACTED]');
  return msg;
}

/** 任意の文字列から既知の秘匿情報パターンを伏字にする。 */
export function sanitizeText(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
  return out;
}
