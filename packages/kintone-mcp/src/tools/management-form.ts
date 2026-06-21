// アプリ管理系 (Phase C, #24) — フォーム設計グループ (views / form layout / fields)。
// 更新系は preview に書き込み、kintone-deploy-app で反映。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { makeAppConfigGetTool, requireApp } from './utils/app-config';
import { appConfigPath, appIdSchema, revisionOptSchema } from './utils/schemas';

// ── get-views ──
export const getViews = makeAppConfigGetTool(
  'kintone-get-views',
  'Get App Views',
  'アプリの一覧 (ビュー) 設定を取得する。preview=true で運用前。Returns { views, revision }.',
  'views.json',
);

// ── update-views ──
export const updateViews = createTool<{ app: string; views: Record<string, unknown>; revision?: string }>(
  'kintone-update-views',
  {
    title: 'Update App Views',
    description:
      'アプリの一覧 (ビュー) 設定を更新する (preview)。`views` はビュー名をキーにしたオブジェクト (kintone views.json 仕様)。' +
      '**この API はビュー全体を置換する**ため、先に kintone-get-views で現在のビューを取得し、' +
      '残したいもの (自動作成の「（作業者が自分）」等は削除不可) も含めて全体を送ること。' +
      'filterCond のクエリ演算子はフィールドタイプで異なる: 選択系 (DROP_DOWN/RADIO_BUTTON/CHECK_BOX/MULTI_SELECT) と ' +
      'ユーザー/組織/グループ選択・作成者・更新者は `in` / `not in` のみ (`=`/`!=` 不可)。' +
      '文字列(複数行)/添付は `like`/`not like`。数値・日時は比較演算子可。' +
      '反映には kintone-deploy-app が必要。Returns { revision }.',
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
export const getFormLayout = makeAppConfigGetTool(
  'kintone-get-form-layout',
  'Get Form Layout',
  'アプリのフォームレイアウト (フィールド配置) を取得する。preview=true で運用前。Returns { layout, revision }.',
  'form/layout.json',
);

// ── update-form-layout ──
export const updateFormLayout = createTool<{ app: string; layout: unknown[]; revision?: string }>(
  'kintone-update-form-layout',
  {
    title: 'Update Form Layout',
    description:
      'アプリのフォームレイアウトを更新する (preview)。`layout` は行 (ROW/GROUP/SUBTABLE) の配列 (kintone form/layout.json 仕様)。' +
      '**この API はレイアウト全体を置換する**ため、先に kintone-get-form-layout で現在値を取得し、' +
      '既存フィールドも含めた完全なレイアウトを送ること (一部だけ送ると他が消える)。' +
      '反映には kintone-deploy-app が必要。Returns { revision }.',
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
    'フィールドコードをキーにしたフィールド定義 (kintone form/fields.json 仕様)。各定義に `type` は必須。' +
    'フィールドコードに kintone の**予約語は使用不可**: ' +
    'ステータス / 作業者 / カテゴリー / レコード番号 / 作成者 / 作成日時 / 更新者 / 更新日時 (英語: ' +
    'Status / Assignee / Categories / Record_number / Creator / Created_datetime / Modifier / Updated_datetime)。' +
    'プロセス管理のステータスは自動生成されるため、独自フィールドは別コード (例 deal_status) にする。' +
    '選択系 (DROP_DOWN / RADIO_BUTTON / CHECK_BOX / MULTI_SELECT) は `options` を ' +
    '`{ "<ラベル>": { "label": "<ラベル>", "index": "<0始まりの文字列>" } }` で指定 (index は**文字列**)。' +
    '例: `{ "deal_status": { "type": "DROP_DOWN", "label": "ステータス", ' +
    '"options": { "見込": { "label": "見込", "index": "0" }, "受注": { "label": "受注", "index": "1" } } } }`',
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
