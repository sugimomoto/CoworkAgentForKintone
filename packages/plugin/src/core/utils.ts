// 小さな共通ユーティリティ。

/** ms ミリ秒待つ */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** unknown のエラー値を文字列に変換する。Error.message 優先 / null/undefined は "" */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err === null || err === undefined) return '';
  return String(err);
}

/** 末尾スラッシュを除いた URL に path を結合する。path は先頭スラッシュの有無不問。 */
export function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return p === '' ? b : `${b}/${p}`;
}

/** Worker `/mcp/<domain>` 形式の URL を組み立てる */
export function buildMcpServerUrl(workerUrl: string, kintoneDomain: string): string {
  return joinUrl(workerUrl, `mcp/${kintoneDomain}`);
}
