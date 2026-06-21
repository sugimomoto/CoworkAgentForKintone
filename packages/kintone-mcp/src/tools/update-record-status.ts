import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { actionSchema, appIdSchema, assigneeCodeSchema, revisionSchema } from './utils/schemas';

interface Args {
  app: string;
  id: string;
  action: string;
  assignee?: string;
  revision?: string;
}

const TOOL = 'kintone-update-record-status';

export const updateRecordStatus = createTool<Args>(
  TOOL,
  {
    title: 'Update Record Status',
    description:
      'プロセス管理 (ワークフロー) で 1 レコードのステータスを遷移させる。' +
      '`action` はアプリで定義済みのアクション名。遷移先が作業者指定を要する場合は `assignee` (単一 code)。' +
      '`revision` で楽観ロック (不一致なら 409)。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      id: { type: 'string', description: 'Record ID' },
      action: actionSchema,
      assignee: assigneeCodeSchema,
      revision: revisionSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    if (!args.app) throw new Error(`${TOOL}: app is required`);
    if (!args.id) throw new Error(`${TOOL}: id is required`);
    if (!args.action) throw new Error(`${TOOL}: action is required`);

    const body: Record<string, unknown> = { app: args.app, id: args.id, action: args.action };
    if (args.assignee !== undefined) body['assignee'] = args.assignee;
    if (args.revision !== undefined) body['revision'] = args.revision;

    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/record/status.json', {
      body,
    })) as { revision: string };
    return toolResult(result);
  },
);
