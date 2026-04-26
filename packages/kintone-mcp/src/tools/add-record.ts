import { kintoneRequest } from '../kintone';
import { createTool } from './factory';
import { appIdSchema, recordValueMapSchema } from './utils/schemas';

interface Args {
  app: string;
  record: Record<string, { value: unknown }>;
}

export const addRecord = createTool<Args>(
  'kintone-add-record',
  {
    title: 'Add Record',
    description:
      'Add a single record to a kintone app. Returns { id, revision } of the created record. ' +
      'Use kintone-get-form-fields first to discover field codes and value types.',
    inputSchema: {
      app: appIdSchema,
      record: recordValueMapSchema,
    },
    outputSchema: {
      id: { type: 'string' },
      revision: { type: 'string' },
    },
  },
  async (args, { creds }) => {
    const result = (await kintoneRequest(creds, 'POST', '/k/v1/record.json', {
      body: { app: args.app, record: args.record },
    })) as { id: string; revision: string };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
