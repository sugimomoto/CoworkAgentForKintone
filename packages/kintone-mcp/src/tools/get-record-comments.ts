// kintone-get-record-comments: レコードコメント一覧取得 (`GET /k/v1/record/comments.json`)。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';
import { appIdSchema } from './utils/schemas';

interface Args {
  app: string;
  record: string;
  order?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export const getRecordComments = createTool<Args>(
  'kintone-get-record-comments',
  {
    title: 'Get Record Comments',
    description:
      'Get comments attached to a kintone record. ' +
      'Returns `{ comments[], older, newer }` where `comments[]` contains ' +
      '`{ id, text, createdAt, creator, mentions }`. ' +
      'Pagination is via `offset` (0-based) and `limit` (1-10, default 10).',
    inputSchema: {
      app: appIdSchema,
      record: { type: 'string', description: 'Target record ID' },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order by createdAt. Default is desc (newest first)',
      },
      offset: { type: 'number', description: 'Number of comments to skip', minimum: 0 },
      limit: {
        type: 'number',
        description: 'Maximum comments to retrieve (1-10, default 10)',
        minimum: 1,
        maximum: 10,
      },
    },
    outputSchema: {
      comments: { type: 'array', description: 'Array of comment objects' },
      older: { type: 'boolean', description: 'True if older comments exist beyond this page' },
      newer: { type: 'boolean', description: 'True if newer comments exist beyond this page' },
    },
  },
  async (args, { creds }) => {
    const params: Record<string, unknown> = { app: args.app, record: args.record };
    if (args.order !== undefined) params['order'] = args.order;
    if (args.offset !== undefined) params['offset'] = args.offset;
    if (args.limit !== undefined) params['limit'] = args.limit;

    const result = (await kintoneRequest(creds, 'GET', '/k/v1/record/comments.json', {
      params,
    })) as { comments: unknown[]; older: boolean; newer: boolean };

    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
