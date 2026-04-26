// kintone-update-record: 1 件更新。id 指定 or updateKey 指定。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';

interface Args {
  app: string;
  /** id 指定の場合 (updateKey と排他) */
  id?: string;
  /** updateKey 指定の場合 (重複不可フィールドの値で識別) */
  updateKey?: { field: string; value: string };
  record: Record<string, { value: unknown }>;
  /** 楽観ロック (省略時はサーバ側の最新 revision) */
  revision?: string;
}

export const updateRecord = createTool<Args>(
  'kintone-update-record',
  {
    title: 'Update Record',
    description:
      'Update a single record. Specify either `id` or `updateKey` (重複不可フィールド). ' +
      '`revision` を指定すると楽観ロック (kintone 側 revision と不一致なら 409)。 ' +
      'Returns { revision } of the updated record.',
    inputSchema: {
      app: { type: 'string', description: 'App ID (numeric value as string)' },
      id: { type: 'string', description: 'Record ID (omit when using updateKey)' },
      updateKey: {
        type: 'object',
        description: 'Lookup-by-field key (omit when using id)',
        properties: {
          field: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['field', 'value'],
      },
      record: { type: 'object', description: 'Fields to update (same shape as kintone-add-record)' },
      revision: {
        type: 'string',
        description: 'Expected revision for optimistic locking (string of integer or "-1" for any)',
      },
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    if (!args.id && !args.updateKey) {
      throw new Error('kintone-update-record: either id or updateKey is required');
    }
    if (args.id && args.updateKey) {
      throw new Error('kintone-update-record: id and updateKey are exclusive');
    }
    const body: Record<string, unknown> = { app: args.app, record: args.record };
    if (args.id !== undefined) body['id'] = args.id;
    if (args.updateKey !== undefined) body['updateKey'] = args.updateKey;
    if (args.revision !== undefined) body['revision'] = args.revision;

    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/record.json', { body })) as {
      revision: string;
    };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
