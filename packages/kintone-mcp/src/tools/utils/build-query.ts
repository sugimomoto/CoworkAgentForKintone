// 構造化フィルタ → kintone クエリ文字列の生成。
// kintone 公式 MCP の get-records と同等の入力スキーマを採用する。
//
// 設計判断: AND 結合のみサポート。OR は alpha では扱わない (公式 MCP も未対応)。

export interface FilterCondition {
  textContains?: { field: string; value: string }[];
  equals?: { field: string; value: string | number }[];
  dateRange?: { field: string; from?: string; to?: string }[];
  numberRange?: { field: string; min?: number; max?: number }[];
  inValues?: { field: string; values: string[] }[];
  notInValues?: { field: string; values: string[] }[];
}

export interface OrderBy {
  field: string;
  order?: 'asc' | 'desc';
}

export interface BuildQueryInput {
  filters?: FilterCondition;
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
}

// kintone のフィールドコードは日本語を含むため文字種ホワイトリストにはできない。
// 代わりにクエリ構文を壊しうる文字 (引用符 / 空白 / 括弧 / 演算子 / カンマ) を弾く。
const FIELD_CODE_RE = /^[^\s"'()<>=!,]+$/u;

/** フィールドコードを検証する。クエリ構文を壊しうる文字を含む場合は throw する。 */
function assertFieldCode(field: string): string {
  if (!FIELD_CODE_RE.test(field)) {
    throw new Error(`invalid field code in filter: ${JSON.stringify(field)}`);
  }
  return field;
}

/** 文字列値を kintone クエリのリテラルに変換する。`\` と `"` をエスケープして両端を `"` で囲む。 */
function quoteValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** 数値値を検証する。有限数でない場合は throw する。 */
function assertFiniteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`invalid numeric value for field ${JSON.stringify(field)}: ${String(value)}`);
  }
  return value;
}

export function buildQueryFromFilters(input: BuildQueryInput): string | undefined {
  const conditions: string[] = [];

  if (input.filters) {
    for (const f of input.filters.textContains ?? []) {
      conditions.push(`${assertFieldCode(f.field)} like ${quoteValue(f.value)}`);
    }
    for (const f of input.filters.equals ?? []) {
      const field = assertFieldCode(f.field);
      conditions.push(
        typeof f.value === 'string'
          ? `${field} = ${quoteValue(f.value)}`
          : `${field} = ${assertFiniteNumber(f.value, field)}`,
      );
    }
    for (const f of input.filters.dateRange ?? []) {
      const field = assertFieldCode(f.field);
      if (f.from) conditions.push(`${field} >= ${quoteValue(f.from)}`);
      if (f.to) conditions.push(`${field} <= ${quoteValue(f.to)}`);
    }
    for (const f of input.filters.numberRange ?? []) {
      const field = assertFieldCode(f.field);
      if (f.min !== undefined) conditions.push(`${field} >= ${assertFiniteNumber(f.min, field)}`);
      if (f.max !== undefined) conditions.push(`${field} <= ${assertFiniteNumber(f.max, field)}`);
    }
    for (const f of input.filters.inValues ?? []) {
      const field = assertFieldCode(f.field);
      const values = f.values.map((v) => quoteValue(v)).join(', ');
      conditions.push(`${field} in (${values})`);
    }
    for (const f of input.filters.notInValues ?? []) {
      const field = assertFieldCode(f.field);
      const values = f.values.map((v) => quoteValue(v)).join(', ');
      conditions.push(`${field} not in (${values})`);
    }
  }

  const parts: string[] = [];
  if (conditions.length > 0) parts.push(conditions.join(' and '));

  if (input.orderBy && input.orderBy.length > 0) {
    const clauses = input.orderBy
      .map((o) => `${assertFieldCode(o.field)} ${o.order ?? 'asc'}`)
      .join(', ');
    parts.push(`order by ${clauses}`);
  }

  if (input.limit !== undefined) parts.push(`limit ${assertFiniteNumber(input.limit, 'limit')}`);
  if (input.offset !== undefined) parts.push(`offset ${assertFiniteNumber(input.offset, 'offset')}`);

  if (parts.length === 0) return undefined;
  return parts.join(' ');
}
