// kintone-get-app: 単一アプリの基本情報取得。

import { kintoneRequest } from '../kintone';

import { createTool } from './factory';

interface Args {
  app: string;
}

export const getApp = createTool<Args>(
  'kintone-get-app',
  {
    title: 'Get App',
    description: 'Retrieve a single kintone app by ID. Returns app metadata (name, description, etc).',
    inputSchema: {
      app: { type: 'string', description: 'The ID of the app to retrieve (numeric value as string)' },
    },
  },
  async (args, { creds }) => {
    const result = await kintoneRequest(creds, 'GET', '/k/v1/app.json', {
      params: { id: args.app },
    });
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
