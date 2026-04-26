// 元に戻せないので Agent のガードレールで「ユーザに必ず確認してから実行」を促すこと。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';
import { appIdSchema } from './utils/schemas';
import { assertMaxBatch, assertNonEmpty } from './utils/validators';

interface Args {
  app: string;
  ids: string[];
  revisions?: string[];
}

const TOOL = 'kintone-delete-records';

export const deleteRecords = createTool<Args>(
  TOOL,
  {
    title: 'Delete Records',
    description:
      'Delete multiple records by ID (up to 100). DESTRUCTIVE — confirm with the user before calling. ' +
      'Optionally pass `revisions` (same length as ids) for optimistic locking.',
    inputSchema: {
      app: appIdSchema,
      ids: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 100,
        description: 'Record IDs to delete',
      },
      revisions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Expected revisions (same length as ids)',
      },
    },
  },
  async (args, { creds }) => {
    assertNonEmpty(TOOL, args.ids, 'ids');
    assertMaxBatch(TOOL, args.ids, 'ids');
    if (args.revisions && args.revisions.length !== args.ids.length) {
      throw new Error(
        `${TOOL}: revisions length (${args.revisions.length}) must match ids length (${args.ids.length})`,
      );
    }
    const params: Record<string, unknown> = { app: args.app, ids: args.ids };
    if (args.revisions) params['revisions'] = args.revisions;

    await kintoneRequest(creds, 'DELETE', '/k/v1/records.json', { body: params });
    return {
      structuredContent: { deleted: args.ids.length },
      content: [{ type: 'text', text: `Deleted ${args.ids.length} record(s) from app ${args.app}` }],
    };
  },
);
