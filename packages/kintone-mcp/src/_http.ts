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
