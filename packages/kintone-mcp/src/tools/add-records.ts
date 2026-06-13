import { kintoneRequest } from '../kintone';

import { createTool } from './factory';
import { appIdSchema } from './utils/schemas';
import { assertMaxBatch } from './utils/validators';

interface Args {
  app: string;
  records: Array<Record<string, { value: unknown }>>;
}

const TOOL = 'kintone-add-records';

export const addRecords = createTool<Args>(
  TOOL,
  {
    title: 'Add Records',
    description:
      'Add multiple records to a kintone app in a single request (up to 100). ' +
      'Returns { ids[], revisions[] }. For larger batches, call this tool repeatedly.',
    inputSchema: {
      app: appIdSchema,
      records: {
        type: 'array',
        description: 'Array of records (max 100). Each record is the same shape as kintone-add-record.',
        items: { type: 'object' },
        maxItems: 100,
      },
    },
    outputSchema: {
      ids: { type: 'array', items: { type: 'string' } },
      revisions: { type: 'array', items: { type: 'string' } },
    },
  },
  async (args, { creds }) => {
    assertMaxBatch(TOOL, args.records);
    const result = (await kintoneRequest(creds, 'POST', '/k/v1/records.json', {
      body: { app: args.app, records: args.records },
    })) as { ids: string[]; revisions: string[] };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
