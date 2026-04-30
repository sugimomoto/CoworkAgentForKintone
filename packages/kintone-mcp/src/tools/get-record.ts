// kintone-get-record: 単一レコード取得 (`GET /k/v1/record.json`)。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';
import { appIdSchema } from './utils/schemas';

interface Args {
  app: string;
  id: string;
}

export const getRecord = createTool<Args>(
  'kintone-get-record',
  {
    title: 'Get Record',
    description:
      'Get a single record from a kintone app by its record ID. ' +
      'Returns the record as `{ record: { ...fields } }`. ' +
      'For multiple records use kintone-get-records instead.',
    inputSchema: {
      app: appIdSchema,
      id: { type: 'string', description: 'Record ID (numeric value as string)' },
    },
    outputSchema: {
      record: { type: 'object', description: 'Record fields keyed by field code' },
    },
  },
  async (args, { creds }) => {
    const result = (await kintoneRequest(creds, 'GET', '/k/v1/record.json', {
      params: { app: args.app, id: args.id },
    })) as { record: unknown };

    return {
      structuredContent: { record: result.record },
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
