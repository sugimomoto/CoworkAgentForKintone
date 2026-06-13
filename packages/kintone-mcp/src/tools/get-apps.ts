// kintone-get-apps: アプリ一覧取得 (API トークン認証では server-side filter で除外)。

import { kintoneRequest } from '../kintone';

import { createTool } from './factory';

interface Args {
  name?: string;
  ids?: string[];
  codes?: string[];
  spaceIds?: number[];
  limit?: number;
  offset?: number;
}

export const getApps = createTool<Args>(
  'kintone-get-apps',
  {
    title: 'Get Apps',
    description:
      'List kintone apps. Requires Basic authentication (NOT supported with API token authentication, in which case this tool is excluded from the tools list).',
    inputSchema: {
      name: { type: 'string', description: 'App name partial match filter' },
      ids: { type: 'array', items: { type: 'string' }, description: 'Filter by app IDs' },
      codes: { type: 'array', items: { type: 'string' }, description: 'Filter by app codes' },
      spaceIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Filter by space IDs',
      },
      limit: {
        type: 'number',
        description: 'Max apps to return (1-100, default 100)',
        minimum: 1,
        maximum: 100,
      },
      offset: { type: 'number', description: 'Number of apps to skip', minimum: 0 },
    },
    outputSchema: {
      apps: { type: 'array', description: 'Array of app objects' },
    },
  },
  async (args, { creds }) => {
    const params: Record<string, unknown> = {
      limit: args.limit ?? 100,
      offset: args.offset ?? 0,
    };
    if (args.name !== undefined) params['name'] = args.name;
    if (args.ids !== undefined) params['ids'] = args.ids;
    if (args.codes !== undefined) params['codes'] = args.codes;
    if (args.spaceIds !== undefined) params['spaceIds'] = args.spaceIds;

    const result = (await kintoneRequest(creds, 'GET', '/k/v1/apps.json', { params })) as {
      apps: unknown[];
    };

    return {
      structuredContent: { apps: result.apps },
      content: [{ type: 'text', text: JSON.stringify({ apps: result.apps }, null, 2) }],
    };
  },
);
