import { kintoneRequest } from '../kintone';
import { createTool } from './factory';
import { appIdSchema, updateKeySchema } from './utils/schemas';
import { assertIdOrUpdateKey, assertMaxBatch } from './utils/validators';

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

const TOOL = 'kintone-update-records';

export const updateRecords = createTool<Args>(
  TOOL,
  {
    title: 'Update Records',
    description:
      'Update multiple records in a single request (up to 100). Each entry takes either `id` or `updateKey`. ' +
      'Returns { records: [{ id, revision }, ...] }.',
    inputSchema: {
      app: appIdSchema,
      records: {
        type: 'array',
        description: 'Array of update entries (max 100).',
        maxItems: 100,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            updateKey: updateKeySchema,
            record: { type: 'object' },
            revision: { type: 'string' },
          },
        },
      },
    },
    outputSchema: { records: { type: 'array' } },
  },
  async (args, { creds }) => {
    assertMaxBatch(TOOL, args.records);
    for (const e of args.records) assertIdOrUpdateKey(TOOL, e);
    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/records.json', {
      body: { app: args.app, records: args.records },
    })) as { records: Array<{ id: string; revision: string }> };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
