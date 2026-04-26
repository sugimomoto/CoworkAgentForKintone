// kintone-add-records: 複数件追加 (1 リクエストで最大 100 件)。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';

interface Args {
  app: string;
  records: Array<Record<string, { value: unknown }>>;
}

export const addRecords = createTool<Args>(
  'kintone-add-records',
  {
    title: 'Add Records',
    description:
      'Add multiple records to a kintone app in a single request (up to 100). ' +
      'Returns { ids[], revisions[] }. For larger batches, call this tool repeatedly.',
    inputSchema: {
      app: { type: 'string', description: 'App ID (numeric value as string)' },
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
    if (args.records.length > 100) {
      throw new Error(`kintone-add-records: max 100 records per request (got ${args.records.length})`);
    }
    const result = (await kintoneRequest(creds, 'POST', '/k/v1/records.json', {
      body: { app: args.app, records: args.records },
    })) as { ids: string[]; revisions: string[] };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
