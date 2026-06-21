// アプリ管理系 (Phase C, #24) — customize / deploy グループ。
// admin 専用 Custom Agent からのみ使う想定。更新系は preview に書き込み、deploy するまでライブ反映されない。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { appConfigPath, appIdSchema, previewSchema, revisionOptSchema } from './utils/schemas';

function requireApp(tool: string, app: string): void {
  if (!app) throw new Error(`${tool}: app is required`);
}

// ── get-customize ──
interface GetCustomizeArgs {
  app: string;
  preview?: boolean;
}
export const getCustomize = createTool<GetCustomizeArgs>(
  'kintone-get-customize',
  {
    title: 'Get App Customize',
    description:
      'アプリの JavaScript / CSS カスタマイズ設定を取得する。preview=true で運用前(編集中)、既定は運用環境。' +
      'Returns { desktop, mobile, scope, revision }.',
    inputSchema: { app: appIdSchema, preview: previewSchema },
  },
  async (args, { creds }) => {
    requireApp('kintone-get-customize', args.app);
    const result = await kintoneRequest(creds, 'GET', appConfigPath('customize.json', args.preview ?? false), {
      params: { app: args.app },
    });
    return toolResult(result);
  },
);

// ── update-customize ──
interface UpdateCustomizeArgs {
  app: string;
  scope?: 'ALL' | 'ADMIN' | 'NONE';
  desktop?: { js?: unknown[]; css?: unknown[] };
  mobile?: { js?: unknown[]; css?: unknown[] };
  revision?: string;
}
export const updateCustomize = createTool<UpdateCustomizeArgs>(
  'kintone-update-customize',
  {
    title: 'Update App Customize',
    description:
      'アプリの JS/CSS カスタマイズ設定を更新する (preview に書き込み)。`desktop`/`mobile` は ' +
      '`{ js: [...], css: [...] }`（各要素は `{ type:"URL", url }` か `{ type:"FILE", file:{ fileKey } }`）。' +
      '反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      scope: { type: 'string', enum: ['ALL', 'ADMIN', 'NONE'], description: '適用範囲 (任意)' },
      desktop: { type: 'object', description: 'PC 版 { js:[], css:[] }' },
      mobile: { type: 'object', description: 'モバイル版 { js:[], css:[] }' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-customize', args.app);
    const body: Record<string, unknown> = { app: args.app };
    if (args.scope !== undefined) body['scope'] = args.scope;
    if (args.desktop !== undefined) body['desktop'] = args.desktop;
    if (args.mobile !== undefined) body['mobile'] = args.mobile;
    if (args.revision !== undefined) body['revision'] = args.revision;
    const result = await kintoneRequest(creds, 'PUT', appConfigPath('customize.json', true), { body });
    return toolResult(result);
  },
);

// ── deploy-app ──
interface DeployAppArgs {
  apps: Array<{ app: string; revision?: string }>;
  revert?: boolean;
}
export const deployApp = createTool<DeployAppArgs>(
  'kintone-deploy-app',
  {
    title: 'Deploy App Settings',
    description:
      'preview の設定変更を運用環境へ反映 (デプロイ) する。`apps` は対象アプリ配列。' +
      '`revert:true` で preview の変更を破棄して live に戻す。**影響が大きく取り消しにくい操作**。' +
      '完了は kintone-get-app-deploy-status で確認する。',
    inputSchema: {
      apps: {
        type: 'array',
        description: '対象アプリ配列 `[{ app, revision? }]`。',
        items: {
          type: 'object',
          properties: { app: { type: 'string' }, revision: { type: 'string' } },
          required: ['app'],
        },
      },
      revert: { type: 'boolean', description: 'true で preview の変更を破棄 (live と同期)' },
    },
  },
  async (args, { creds }) => {
    if (!Array.isArray(args.apps) || args.apps.length === 0) {
      throw new Error('kintone-deploy-app: apps must be a non-empty array');
    }
    const body: Record<string, unknown> = { apps: args.apps };
    if (args.revert !== undefined) body['revert'] = args.revert;
    const result = await kintoneRequest(creds, 'POST', appConfigPath('deploy.json', true), { body });
    return toolResult(result);
  },
);

// ── get-app-deploy-status ──
interface GetDeployStatusArgs {
  apps: string[];
}
export const getAppDeployStatus = createTool<GetDeployStatusArgs>(
  'kintone-get-app-deploy-status',
  {
    title: 'Get App Deploy Status',
    description:
      'デプロイの進行状況を取得する。`apps` はアプリ ID 配列。' +
      'Returns { apps: [{ app, status }] }（status: PROCESSING / SUCCESS / FAIL / CANCEL）。',
    inputSchema: {
      apps: { type: 'array', items: { type: 'string' }, description: 'アプリ ID の配列' },
    },
  },
  async (args, { creds }) => {
    if (!Array.isArray(args.apps) || args.apps.length === 0) {
      throw new Error('kintone-get-app-deploy-status: apps must be a non-empty array');
    }
    // kintone は apps[0]=.. の indexed クエリを要求する
    const params: Record<string, unknown> = {};
    args.apps.forEach((id, i) => {
      params[`apps[${i}]`] = id;
    });
    const result = await kintoneRequest(creds, 'GET', appConfigPath('deploy.json', true), { params });
    return toolResult(result);
  },
);
