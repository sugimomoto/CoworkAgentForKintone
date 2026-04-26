// 書き込み系ツールで共通する引数バリデーション。

const MAX_BATCH = 100;

export function assertMaxBatch(toolName: string, items: { length: number }, label = 'records'): void {
  if (items.length > MAX_BATCH) {
    throw new Error(`${toolName}: max ${MAX_BATCH} ${label} per request (got ${items.length})`);
  }
}

export function assertNonEmpty(toolName: string, items: { length: number }, label = 'items'): void {
  if (items.length === 0) {
    throw new Error(`${toolName}: ${label} must be non-empty`);
  }
}

/**
 * id と updateKey は **どちらか一方のみ** 必須。両方指定 / どちらも未指定はエラー。
 */
export function assertIdOrUpdateKey(
  toolName: string,
  entry: { id?: string; updateKey?: unknown },
): void {
  if (!entry.id && !entry.updateKey) {
    throw new Error(`${toolName}: either id or updateKey is required`);
  }
  if (entry.id && entry.updateKey) {
    throw new Error(`${toolName}: id and updateKey are exclusive`);
  }
}
