// kintone-add-record-comment: レコードへコメント追加。
//
// アプリ設定でコメント機能が有効である必要がある。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';

interface Mention {
  /** kintone code (USER) / グループ code (GROUP) / 組織 code (ORGANIZATION) */
  code: string;
  type: 'USER' | 'GROUP' | 'ORGANIZATION';
}

interface Args {
  app: string;
  /** 対象レコード ID (string) */
  record: string;
  comment: {
    text: string;
    mentions?: Mention[];
  };
}

export const addRecordComment = createTool<Args>(
  'kintone-add-record-comment',
  {
    title: 'Add Record Comment',
    description:
      'Add a comment to a record. Supports mentions (USER / GROUP / ORGANIZATION). ' +
      'Returns { id } of the new comment. The app must have the comment feature enabled.',
    inputSchema: {
      app: { type: 'string' },
      record: { type: 'string', description: 'Target record ID' },
      comment: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          mentions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                type: { type: 'string', enum: ['USER', 'GROUP', 'ORGANIZATION'] },
              },
              required: ['code', 'type'],
            },
          },
        },
        required: ['text'],
      },
    },
    outputSchema: { id: { type: 'string' } },
  },
  async (args, { creds }) => {
    const result = (await kintoneRequest(creds, 'POST', '/k/v1/record/comment.json', {
      body: { app: args.app, record: args.record, comment: args.comment },
    })) as { id: string };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
