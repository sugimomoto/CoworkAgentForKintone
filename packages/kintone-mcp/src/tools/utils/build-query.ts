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

export function buildQueryFromFilters(input: BuildQueryInput): string | undefined {
  const conditions: string[] = [];

  if (input.filters) {
    for (const f of input.filters.textContains ?? []) {
      conditions.push(`${f.field} like "${f.value}"`);
    }
    for (const f of input.filters.equals ?? []) {
      conditions.push(
        typeof f.value === 'string' ? `${f.field} = "${f.value}"` : `${f.field} = ${f.value}`,
      );
    }
    for (const f of input.filters.dateRange ?? []) {
      if (f.from) conditions.push(`${f.field} >= "${f.from}"`);
      if (f.to) conditions.push(`${f.field} <= "${f.to}"`);
    }
    for (const f of input.filters.numberRange ?? []) {
      if (f.min !== undefined) conditions.push(`${f.field} >= ${f.min}`);
      if (f.max !== undefined) conditions.push(`${f.field} <= ${f.max}`);
    }
    for (const f of input.filters.inValues ?? []) {
      const values = f.values.map((v) => `"${v}"`).join(', ');
      conditions.push(`${f.field} in (${values})`);
    }
    for (const f of input.filters.notInValues ?? []) {
      const values = f.values.map((v) => `"${v}"`).join(', ');
      conditions.push(`${f.field} not in (${values})`);
    }
  }

  const parts: string[] = [];
  if (conditions.length > 0) parts.push(conditions.join(' and '));

  if (input.orderBy && input.orderBy.length > 0) {
    const clauses = input.orderBy.map((o) => `${o.field} ${o.order ?? 'asc'}`).join(', ');
    parts.push(`order by ${clauses}`);
  }

  if (input.limit !== undefined) parts.push(`limit ${input.limit}`);
  if (input.offset !== undefined) parts.push(`offset ${input.offset}`);

  if (parts.length === 0) return undefined;
  return parts.join(' ');
}
