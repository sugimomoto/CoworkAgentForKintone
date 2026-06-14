import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import {
  appIdSchema,
  recordValueMapSchema,
  revisionSchema,
  updateKeySchema,
} from './utils/schemas';
import { assertIdOrUpdateKey } from './utils/validators';

interface Args {
  app: string;
  id?: string;
  updateKey?: { field: string; value: string };
  record: Record<string, { value: unknown }>;
  revision?: string;
}

const TOOL = 'kintone-update-record';

export const updateRecord = createTool<Args>(
  TOOL,
  {
    title: 'Update Record',
    description:
      'Update a single record. Specify either `id` or `updateKey` (重複不可フィールド). ' +
      '`revision` を指定すると楽観ロック (kintone 側 revision と不一致なら 409)。 ' +
      'Returns { revision } of the updated record.',
    inputSchema: {
      app: appIdSchema,
      id: { type: 'string', description: 'Record ID (omit when using updateKey)' },
      updateKey: updateKeySchema,
      record: { ...recordValueMapSchema, description: 'Fields to update (same shape as kintone-add-record)' },
      revision: revisionSchema,
    },
    outputSchema: { revision: { type: 'string' } },
  },
  async (args, { creds }) => {
    assertIdOrUpdateKey(TOOL, args);
    const body: Record<string, unknown> = { app: args.app, record: args.record };
    if (args.id !== undefined) body['id'] = args.id;
    if (args.updateKey !== undefined) body['updateKey'] = args.updateKey;
    if (args.revision !== undefined) body['revision'] = args.revision;

    const result = (await kintoneRequest(creds, 'PUT', '/k/v1/record.json', { body })) as {
      revision: string;
    };
    return toolResult(result);
  },
);
