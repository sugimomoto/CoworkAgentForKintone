// kintone-add-record: 1 件追加。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';

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
      app: { type: 'string', description: 'App ID (numeric value as string)' },
      record: {
        type: 'object',
        description:
          'Field-value map. Each field is `{ value: ... }`. Example: ' +
          '`{ "title": { "value": "新規案件" }, "amount": { "value": "1000" } }`. ' +
          'Reference fields like USER_SELECT / ORGANIZATION_SELECT take arrays of `{ code }` objects.',
      },
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
