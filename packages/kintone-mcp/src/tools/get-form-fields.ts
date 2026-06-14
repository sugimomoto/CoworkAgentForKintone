// kintone-get-form-fields: アプリのフィールド定義取得。
// レコード操作前に呼んで、利用可能なフィールドコードと型を確認するためのツール。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';

interface Args {
  app: string;
  lang?: 'ja' | 'en' | 'zh' | 'user' | 'default';
  preview?: boolean;
}

export const getFormFields = createTool<Args>(
  'kintone-get-form-fields',
  {
    title: 'Get Form Fields',
    description:
      'Retrieve field definitions (schema) of a kintone app. Use this tool BEFORE any record operation (kintone-get-records, future add/update/delete) to discover available field codes and their types.',
    inputSchema: {
      app: { type: 'string', description: 'The ID of the app (numeric value as string)' },
      lang: {
        type: 'string',
        enum: ['ja', 'en', 'zh', 'user', 'default'],
        description: 'Language for field labels (default: en)',
      },
      preview: {
        type: 'boolean',
        description: 'Use preview environment instead of live (default: false)',
      },
    },
  },
  async (args, { creds }) => {
    const params: Record<string, unknown> = { app: args.app };
    if (args.lang !== undefined) params['lang'] = args.lang;
    const path = args.preview ? '/k/v1/preview/app/form/fields.json' : '/k/v1/app/form/fields.json';
    const result = await kintoneRequest(creds, 'GET', path, { params });
    return toolResult(result);
  },
);
