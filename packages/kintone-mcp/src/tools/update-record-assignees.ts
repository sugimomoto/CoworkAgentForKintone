import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { appIdSchema, assigneesSchema, revisionSchema } from './utils/schemas';

interface Args {
  app: string;
  id: string;
  assignees: string[];
  revision?: string;
}

const TOOL = 'kintone-update-record-assignees';

export const updateRecordAssignees = createTool<Args>(
  TOOL,
  {
    title: 'Update Record Assignees',
    description:
      'プロセス管理 (ワークフロー) の 1 レコードの作業者を変更する。`assignees` は作業者の code 配列 ' +
      '(空配列で全解除)。「担当が休みなので別の人に振る」のような付け替えに使う。' +
      '`revision` で楽観ロック。Returns { revision }.',
    inputSchema: {
      app: appIdSchema,
      id: { type: 'string', description: 'Record ID' },
      assignees: assigneesSchema,
      revision: revisionSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    if (!args.app) throw new Error(`${TOOL}: app is required`);
    if (!args.id) throw new Error(`${TOOL}: id is required`);
    if (!Array.isArray(args.assignees)) throw new Error(`${TOOL}: assignees must be an array`);

    const body: Record<string, unknown> = {
      app: args.app,
      id: args.id,
      assignees: args.assignees,
    };
    if (args.revision !== undefined) body['revision'] = args.revision;

    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/record/assignees.json', {
      body,
    })) as { revision: string };
    return toolResult(result);
  },
);
