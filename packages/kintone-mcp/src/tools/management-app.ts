// アプリ管理系 (Phase C, #24) — アプリ作成 / プロセス管理グループ。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { appConfigPath, appIdSchema, previewSchema, revisionOptSchema } from './utils/schemas';

function requireApp(tool: string, app: string): void {
  if (!app) throw new Error(`${tool}: app is required`);
}

// ── create-app ──
interface CreateAppArgs {
  name: string;
  space?: string;
  thread?: string;
}
export const createApp = createTool<CreateAppArgs>(
  'kintone-create-app',
  {
    title: 'Create App',
    description:
      '新しいアプリを作成する (preview 状態。運用開始には kintone-deploy-app が必要)。' +
      '`name` は必須。`space` / `thread` を指定するとスペース内に作成。' +
      '作成後にフィールド追加 → レイアウト → デプロイの流れ。Returns { app, revision }.',
    inputSchema: {
      name: { type: 'string', description: 'アプリ名 (必須)' },
      space: { type: 'string', description: 'スペース ID (任意)' },
      thread: { type: 'string', description: 'スレッド ID (space 指定時)' },
    },
    outputSchema: { app: { type: 'string' }, revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    if (!args.name) throw new Error('kintone-create-app: name is required');
    const body: Record<string, unknown> = { name: args.name };
    if (args.space !== undefined) body['space'] = args.space;
    if (args.thread !== undefined) body['thread'] = args.thread;
    // POST /k/v1/preview/app.json (/app/ 配下ではない)
    return toolResult(await kintoneRequest(creds, 'POST', '/k/v1/preview/app.json', { body }));
  },
);

// ── get-process-management ──
export const getProcessManagement = createTool<{ app: string; preview?: boolean }>(
  'kintone-get-process-management',
  {
    title: 'Get Process Management',
    description:
      'アプリのプロセス管理 (ワークフロー) 設定を取得する。preview=true で運用前。' +
      'ステータス・アクション・取り戻し可否などを含む。Returns { enable, states, actions, revision }.',
    inputSchema: { app: appIdSchema, preview: previewSchema },
  },
  async (args, { creds }) => {
    requireApp('kintone-get-process-management', args.app);
    return toolResult(
      await kintoneRequest(creds, 'GET', appConfigPath('status.json', args.preview ?? false), {
        params: { app: args.app },
      }),
    );
  },
);

// ── update-process-management ──
interface UpdateProcessArgs {
  app: string;
  enable?: boolean;
  states?: Record<string, unknown>;
  actions?: unknown[];
  revision?: string;
}
export const updateProcessManagement = createTool<UpdateProcessArgs>(
  'kintone-update-process-management',
  {
    title: 'Update Process Management',
    description:
      'アプリのプロセス管理 (ワークフロー) 設定を更新する (preview)。`enable` で有効/無効、' +
      '`states` (ステータス名→定義) と `actions` (遷移配列) でワークフローを定義 (kintone status.json 仕様)。' +
      '**この API は states/actions 全体を置換する**ため、既存設定を変更するときは先に ' +
      'kintone-get-process-management で取得し、全体を送ること。反映には kintone-deploy-app が必要。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      enable: { type: 'boolean', description: 'プロセス管理の有効/無効' },
      states: { type: 'object', description: 'ステータス定義 (name → { index, assignee? })' },
      actions: { type: 'array', description: '遷移 (アクション) 定義の配列 [{ name, from, to, filterCond? }]' },
      revision: revisionOptSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    requireApp('kintone-update-process-management', args.app);
    const body: Record<string, unknown> = { app: args.app };
    if (args.enable !== undefined) body['enable'] = args.enable;
    if (args.states !== undefined) body['states'] = args.states;
    if (args.actions !== undefined) body['actions'] = args.actions;
    if (args.revision !== undefined) body['revision'] = args.revision;
    return toolResult(await kintoneRequest(creds, 'PUT', appConfigPath('status.json', true), { body }));
  },
);
