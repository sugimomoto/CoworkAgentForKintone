// アプリ管理系 (Phase C, #24) — 権限 (ACL) / プラグイン グループ。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { makeAppConfigGetTool, requireApp } from './utils/app-config';
import { appConfigPath, appIdSchema, revisionOptSchema } from './utils/schemas';

// ── get-app-acl ──
export const getAppAcl = makeAppConfigGetTool(
  'kintone-get-app-acl',
  'Get App Permissions (ACL)',
  'アプリのアクセス権 (ACL) を取得する。preview=true で運用前。' +
    'Returns { rights: [{ entity, appEditable, recordViewable, ... }], revision }.',
  'acl.json',
);

// ── update-app-acl ──
export const updateAppAcl = createTool<{ app: string; rights: unknown[]; revision?: string }>(
  'kintone-update-app-acl',
  {
    title: 'Update App Permissions (ACL)',
    description:
      'アプリのアクセス権 (ACL) を更新する (preview)。`rights` は entity (USER/GROUP/ORGANIZATION) ごとの ' +
      '権限配列 (kintone acl.json 仕様)。**権限変更は影響が大きい**。反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      rights: { type: 'array', description: 'アクセス権エントリの配列 [{ entity, appEditable, ... }]' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-app-acl', args.app);
    if (!Array.isArray(args.rights)) throw new Error('kintone-update-app-acl: rights array is required');
    const body: Record<string, unknown> = { app: args.app, rights: args.rights };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'PUT', appConfigPath('acl.json', true), { body }));
  },
);

// ── get-app-plugins ──
export const getAppPlugins = makeAppConfigGetTool(
  'kintone-get-app-plugins',
  'Get App Plugins',
  'アプリに追加されたプラグイン一覧を取得する。preview=true で運用前。' +
    'Returns { plugins: [{ id, name, enabled, ... }], revision }.',
  'plugins.json',
);

// ── update-app-plugins ──
export const updateAppPlugins = createTool<{ app: string; ids: string[]; revision?: string }>(
  'kintone-update-app-plugins',
  {
    title: 'Update App Plugins',
    description:
      'アプリに追加するプラグインを設定する (preview)。`ids` はプラグイン ID 配列。' +
      '反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      ids: { type: 'array', items: { type: 'string' }, description: 'プラグイン ID の配列' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-app-plugins', args.app);
    if (!Array.isArray(args.ids)) throw new Error('kintone-update-app-plugins: ids array is required');
    const body: Record<string, unknown> = { app: args.app, ids: args.ids };
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'PUT', appConfigPath('plugins.json', true), { body }));
  },
);
