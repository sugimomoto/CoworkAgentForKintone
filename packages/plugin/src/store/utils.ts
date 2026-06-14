// store スライス共通のヘルパー。

/** 配列に item を keyOf 一致で upsert する (一致が無ければ末尾追加)。新しい配列を返す。 */
export function upsertInArray<T>(arr: T[], item: T, keyOf: (x: T) => string): T[] {
  const key = keyOf(item);
  const idx = arr.findIndex((x) => keyOf(x) === key);
  if (idx === -1) return [...arr, item];
  const next = arr.slice();
  next[idx] = item;
  return next;
}
