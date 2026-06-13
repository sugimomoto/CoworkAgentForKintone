// 許可する kintone ホストの suffix 群。
// MCP ルーティング (/mcp/<host>) と OAuth callback の postMessage targetOrigin 検証で
// 同一の許可リストを使うため、ここに一元化する。

export const KINTONE_HOST_SUFFIXES = [
  'cybozu.com',
  'kintone.com',
  'cybozu-dev.com',
  'cybozu.cn',
] as const;

const SUFFIX_GROUP = KINTONE_HOST_SUFFIXES.map((s) => s.replace(/\./g, '\\.')).join('|');

/** `<sub>.cybozu.com` 等の kintone ホスト名にマッチ (オリジンの scheme は含まない)。 */
export const KINTONE_HOST_RE = new RegExp(`^[a-z0-9.-]+\\.(${SUFFIX_GROUP})$`, 'i');

/** `https://<sub>.cybozu.com` 等の kintone オリジンにマッチ。 */
export const KINTONE_ORIGIN_RE = new RegExp(`^https://[a-z0-9.-]+\\.(${SUFFIX_GROUP})$`, 'i');

/** `/mcp/<host>` の host 部分を取り出す正規表現を生成する。 */
export function mcpPathPattern(): RegExp {
  return new RegExp(`^/mcp/([a-z0-9.-]+\\.(${SUFFIX_GROUP}))$`, 'i');
}
