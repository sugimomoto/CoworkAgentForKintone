// Cowork Agent for kintone — 表示用フォーマッタ

/**
 * ISO8601 文字列を相対的な日本語表現に変換する。
 * - 1 分未満: "今"
 * - 1 時間未満: "N 分前"
 * - 24 時間未満 (今日): "N 時間前"
 * - 48 時間未満 (昨日相当): "昨日"
 * - それ以外: "YYYY-MM-DD HH:mm"
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffMs = now.getTime() - t;
  if (diffMs < 0) return 'たった今';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return '今';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 時間前`;
  if (hour < 48) return '昨日';
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
