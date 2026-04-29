// 最小 CSV パーサ。RFC 4180 ベース (ダブルクォート / エスケープ / CRLF)。
// 数百件想定 (kintone レコード集計結果など)。万件超は前提にしない。

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** 1 行目を header として扱ったか (= rows[0] が data の 1 行目) */
  hasHeader: boolean;
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      current.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      // 1 行終了 (CRLF は \r をスキップしてから \n で終了)
      if (c === '\r' && text[i + 1] === '\n') i++;
      current.push(field);
      // 空行は無視 (末尾改行で空 1 行が出る)
      if (current.length > 1 || current[0] !== '') rows.push(current);
      current = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || current.length > 0) {
    current.push(field);
    if (current.length > 1 || current[0] !== '') rows.push(current);
  }

  if (rows.length === 0) return { headers: [], rows: [], hasHeader: false };

  // header 検出: 1 行目に重複 / 空欄が無く、すべて短めの文字列なら header と推定
  const first = rows[0]!;
  const looksLikeHeader =
    first.every((c) => c.length > 0 && c.length < 64) &&
    new Set(first).size === first.length;

  if (looksLikeHeader && rows.length > 1) {
    return { headers: first, rows: rows.slice(1), hasHeader: true };
  }
  // header なし: 連番ヘッダ
  return {
    headers: first.map((_, i) => `col${i + 1}`),
    rows,
    hasHeader: false,
  };
}
