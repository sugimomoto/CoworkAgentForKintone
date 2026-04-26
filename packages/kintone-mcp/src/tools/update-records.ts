// kintone-update-records: 複数件更新 (1 リクエストで最大 100 件)。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';

interface UpdateEntry {
  id?: string;
  updateKey?: { field: string; value: string };
  record: Record<string, { value: unknown }>;
  revision?: string;
}

interface Args {
  app: string;
  records: UpdateEntry[];
}

export const updateRecords = createTool<Args>(
  'kintone-update-records',
  {
    title: 'Update Records',
    description:
      'Update multiple records in a single request (up to 100). Each entry takes either `id` or `updateKey`. ' +
      'Returns { records: [{ id, revision }, ...] }.',
    inputSchema: {
      app: { type: 'string' },
      records: {
        type: 'array',
        description: 'Array of update entries (max 100).',
        maxItems: 100,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            updateKey: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                value: { type: 'string' },
              },
            },
            record: { type: 'object' },
            revision: { type: 'string' },
          },
        },
      },
    },
    outputSchema: { records: { type: 'array' } },
  },
  async (args, { creds }) => {
    if (args.records.length > 100) {
      throw new Error(
        `kintone-update-records: max 100 records per request (got ${args.records.length})`,
      );
    }
    for (const e of args.records) {
      if (!e.id && !e.updateKey) {
        throw new Error('kintone-update-records: each entry needs id or updateKey');
      }
    }
    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/records.json', {
      body: { app: args.app, records: args.records },
    })) as { records: Array<{ id: string; revision: string }> };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
