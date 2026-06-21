import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { actionSchema, appIdSchema, assigneeCodeSchema, revisionSchema } from './utils/schemas';
import { assertMaxBatch, assertNonEmpty } from './utils/validators';

interface StatusEntry {
  id: string;
  action: string;
  assignee?: string;
  revision?: string;
}

interface Args {
  app: string;
  records: StatusEntry[];
}

const TOOL = 'kintone-update-records-statuses';

export const updateRecordsStatuses = createTool<Args>(
  TOOL,
  {
    title: 'Update Records Statuses',
    description:
      'プロセス管理 (ワークフロー) でレコードのステータスを遷移させる。最大 100 件まで 1 リクエストで一括処理。' +
      '**1 件だけのときも `records` に 1 要素で渡す**（単一専用ツールは無い）。各 entry は ' +
      '`{ id, action, assignee?, revision? }`。「このレコードを完了に」「未対応案件を全部 完了に」どちらも本ツール。' +
      '`action` はアプリで定義済みのアクション名。Returns { records: [{ id, revision }] }.',
    inputSchema: {
      app: appIdSchema,
      records: {
        type: 'array',
        description: 'Array of status-change entries (max 100).',
        maxItems: 100,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Record ID' },
            action: actionSchema,
            assignee: assigneeCodeSchema,
            revision: revisionSchema,
          },
          required: ['id', 'action'],
        },
      },
    },
    outputSchema: { records: { type: 'array' } },
  },
  async (args, { creds }) => {
    if (!args.app) throw new Error(`${TOOL}: app is required`);
    assertNonEmpty(TOOL, args.records ?? [], 'records');
    assertMaxBatch(TOOL, args.records);
    for (const e of args.records) {
      if (!e.id) throw new Error(`${TOOL}: each record requires id`);
      if (!e.action) throw new Error(`${TOOL}: each record requires action`);
    }

    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/records/status.json', {
      body: { app: args.app, records: args.records },
    })) as { records: Array<{ id: string; revision: string }> };
    return toolResult(result);
  },
);
