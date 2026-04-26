// inputSchema 部品 (raw JSON Schema 断片) の共通定義。

export const appIdSchema = {
  type: 'string',
  description: 'App ID (numeric value as string)',
} as const;

export const recordValueMapSchema = {
  type: 'object',
  description:
    'Field-value map. Each field is `{ value: ... }`. Example: ' +
    '`{ "title": { "value": "新規案件" }, "amount": { "value": "1000" } }`. ' +
    'Reference fields like USER_SELECT / ORGANIZATION_SELECT take arrays of `{ code }` objects.',
} as const;

export const updateKeySchema = {
  type: 'object',
  description: 'Lookup-by-field key (omit when using id)',
  properties: {
    field: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['field', 'value'],
} as const;

export const revisionSchema = {
  type: 'string',
  description: 'Expected revision for optimistic locking (string of integer or "-1" for any)',
} as const;
