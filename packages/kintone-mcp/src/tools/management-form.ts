// アプリ管理系 (Phase C, #24) — フォーム設計グループ (views / form layout / fields)。
// 更新系は preview に書き込み、kintone-deploy-app で反映。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { appConfigPath, appIdSchema, previewSchema, revisionOptSchema } from './utils/schemas';

function requireApp(tool: string, app: string): void {
  if (!app) throw new Error(`${tool}: app is required`);
}

// ── get-views ──
export const getViews = createTool<{ app: string; preview?: boolean }>(
  'kintone-get-views',
  {
    title: 'Get App Views',
    description:
      'アプリの一覧 (ビュー) 設定を取得する。preview=true で運用前。Returns { views, revision }.',
    inputSchema: { app: appIdSchema, preview: previewSchema },
  },
  async (args, { creds }) => {
    requireApp('kintone-get-views', args.app);
    return toolResult(
      await kintoneRequest(creds, 'GET', appConfigPath('views.json', args.preview ?? false), {
        params: { app: args.app },
      }),
    );
  },
);

// ── update-views ──
export const updateViews = createTool<{ app: string; views: Record<string, unknown>; revision?: string }>(
  'kintone-update-views',
  {
    title: 'Update App Views',
    description:
      'アプリの一覧 (ビュー) 設定を更新する (preview)。`views` はビュー名をキーにしたオブジェクト ' +
      '(kintone の views.json 仕様)。反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      views: { type: 'object', description: 'ビュー定義オブジェクト (name → 設定)' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-views', args.app);
    if (!args.views || typeof args.views !== 'object') {
      throw new Error('kintone-update-views: views object is required');
    }
    const body: Record<string, unknown> = { app: args.app, views: args.views };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'PUT', appConfigPath('views.json', true), { body }));
  },
);

// ── get-form-layout ──
export const getFormLayout = createTool<{ app: string; preview?: boolean }>(
  'kintone-get-form-layout',
  {
    title: 'Get Form Layout',
    description:
      'アプリのフォームレイアウト (フィールド配置) を取得する。preview=true で運用前。Returns { layout, revision }.',
    inputSchema: { app: appIdSchema, preview: previewSchema },
  },
  async (args, { creds }) => {
    requireApp('kintone-get-form-layout', args.app);
    return toolResult(
      await kintoneRequest(creds, 'GET', appConfigPath('form/layout.json', args.preview ?? false), {
        params: { app: args.app },
      }),
    );
  },
);

// ── update-form-layout ──
export const updateFormLayout = createTool<{ app: string; layout: unknown[]; revision?: string }>(
  'kintone-update-form-layout',
  {
    title: 'Update Form Layout',
    description:
      'アプリのフォームレイアウトを更新する (preview)。`layout` は行 (ROW/GROUP/SUBTABLE) の配列 ' +
      '(kintone の form/layout.json 仕様)。反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      layout: { type: 'array', description: 'レイアウト行の配列' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-form-layout', args.app);
    if (!Array.isArray(args.layout)) throw new Error('kintone-update-form-layout: layout array is required');
    const body: Record<string, unknown> = { app: args.app, layout: args.layout };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'PUT', appConfigPath('form/layout.json', true), { body }));
  },
);

// ── add-form-fields ──
const fieldsPropertiesSchema = {
  type: 'object',
  description:
    'フィールドコードをキーにしたフィールド定義 (kintone form/fields.json 仕様)。' +
    '例: `{ "priority": { "type": "DROP_DOWN", "label": "優先度", "options": {...} } }`',
} as const;

export const addFormFields = createTool<{ app: string; properties: Record<string, unknown>; revision?: string }>(
  'kintone-add-form-fields',
  {
    title: 'Add Form Fields',
    description:
      'アプリにフィールドを追加する (preview)。`properties` はフィールドコード → 定義。' +
      '追加後 kintone-update-form-layout で配置し、kintone-deploy-app で反映。Returns { revision }.',
    inputSchema: { app: appIdSchema, properties: fieldsPropertiesSchema, revision: revisionOptSchema },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-add-form-fields', args.app);
    if (!args.properties || typeof args.properties !== 'object') {
      throw new Error('kintone-add-form-fields: properties object is required');
    }
    const body: Record<string, unknown> = { app: args.app, properties: args.properties };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'POST', appConfigPath('form/fields.json', true), { body }));
  },
);

// ── update-form-fields ──
export const updateFormFields = createTool<{ app: string; properties: Record<string, unknown>; revision?: string }>(
  'kintone-update-form-fields',
  {
    title: 'Update Form Fields',
    description:
      'アプリの既存フィールド設定を変更する (preview)。`properties` はフィールドコード → 変更後定義。' +
      '反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: { app: appIdSchema, properties: fieldsPropertiesSchema, revision: revisionOptSchema },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-form-fields', args.app);
    if (!args.properties || typeof args.properties !== 'object') {
      throw new Error('kintone-update-form-fields: properties object is required');
    }
    const body: Record<string, unknown> = { app: args.app, properties: args.properties };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'PUT', appConfigPath('form/fields.json', true), { body }));
  },
);

// ── delete-form-fields ──
export const deleteFormFields = createTool<{ app: string; fields: string[]; revision?: string }>(
  'kintone-delete-form-fields',
  {
    title: 'Delete Form Fields',
    description:
      'アプリのフィールドを削除する (preview)。`fields` はフィールドコード配列。**データも失われる破壊的操作**。' +
      '反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      fields: { type: 'array', items: { type: 'string' }, description: '削除するフィールドコード配列' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-delete-form-fields', args.app);
    if (!Array.isArray(args.fields) || args.fields.length === 0) {
      throw new Error('kintone-delete-form-fields: fields must be a non-empty array');
    }
    const body: Record<string, unknown> = { app: args.app, fields: args.fields };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(
      await kintoneRequest(creds, 'DELETE', appConfigPath('form/fields.json', true), { body }),
    );
  },
);
