// kintone-bulk-request: 複数 API をアトミックに実行 (`POST /k/v1/bulkRequest.json`)。
//
// 1 件でも失敗すると kintone 側で全 rollback される。
// 上限は 20 サブリクエスト / 1 bulk (kintone 仕様)。

import { kintoneRequest } from '../kintone';
import { createTool } from './factory';

const MAX_BULK = 20;

interface BulkSubRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  api: string;
  payload: Record<string, unknown>;
}

interface Args {
  requests: BulkSubRequest[];
}

export const bulkRequest = createTool<Args>(
  'kintone-bulk-request',
  {
    title: 'Bulk Request',
    description:
      'Run up to 20 kintone API operations in a single atomic transaction. ' +
      'If any sub-request fails, kintone rolls back the entire batch. ' +
      'Each sub-request is `{ method, api, payload }` where `api` is a kintone REST path ' +
      '(e.g. `/k/v1/record.json`) and `payload` is the request body for write methods or ' +
      'the query parameters for GET. Returns `{ results: [...] }` aligned with the input order.',
    inputSchema: {
      requests: {
        type: 'array',
        description: `Sub-requests to execute atomically (1-${MAX_BULK})`,
        minItems: 1,
        maxItems: MAX_BULK,
        items: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
            api: {
              type: 'string',
              description: 'kintone REST API path (e.g. /k/v1/record.json)',
            },
            payload: {
              type: 'object',
              description: 'Request body / params object for the sub-request',
            },
          },
          required: ['method', 'api', 'payload'],
        },
      },
    },
    outputSchema: {
      results: {
        type: 'array',
        description: 'Per-sub-request response payloads, aligned with input order',
      },
    },
  },
  async (args, { creds }) => {
    if (!Array.isArray(args.requests) || args.requests.length === 0) {
      throw new Error('kintone-bulk-request: requests must be non-empty');
    }
    if (args.requests.length > MAX_BULK) {
      throw new Error(
        `kintone-bulk-request: max ${MAX_BULK} sub-requests per call (got ${args.requests.length})`,
      );
    }

    const result = (await kintoneRequest(creds, 'POST', '/k/v1/bulkRequest.json', {
      body: { requests: args.requests },
    })) as { results: unknown[] };

    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);
