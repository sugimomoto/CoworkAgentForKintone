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

// ── プロセス管理 (ワークフロー) 用 (#22) ──

export const actionSchema = {
  type: 'string',
  description:
    'プロセス管理で定義されたアクション名 (例「対応開始」「完了する」)。アプリ設定に存在する名称のみ有効。',
} as const;

export const assigneeCodeSchema = {
  type: 'string',
  description:
    '作業者のログイン名 (ユーザ code)。ステータス遷移先が作業者指定を要する場合に渡す単一ユーザ。',
} as const;

export const assigneesSchema = {
  type: 'array',
  items: { type: 'string' },
  description: '作業者のログイン名 (code) の配列。空配列を渡すと全作業者を解除する。',
} as const;

// ── アプリ管理系 (Phase C, #24) ──

export const previewSchema = {
  type: 'boolean',
  description:
    '取得元。true=運用前 (preview, 未デプロイの編集中設定) / false=運用環境 (live, 既定)。' +
    '更新系ツールは常に preview に書き込み、deploy するまでライブに反映されない。',
} as const;

export const revisionOptSchema = {
  type: 'string',
  description: '楽観ロック用の想定リビジョン (省略可。指定すると不一致で 409)。',
} as const;

/**
 * アプリ設定 API のパスを組み立てる。
 *   appConfigPath('form/fields.json', true)  → '/k/v1/preview/app/form/fields.json'
 *   appConfigPath('views.json', false)       → '/k/v1/app/views.json'
 * 更新系は preview 固定、取得系は preview フラグで切替。
 */
export function appConfigPath(segment: string, preview: boolean): string {
  return `/k/v1${preview ? '/preview' : ''}/app/${segment}`;
}
