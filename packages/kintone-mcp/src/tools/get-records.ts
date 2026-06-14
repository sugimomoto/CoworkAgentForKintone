// kintone-get-records: レコード取得 (構造化フィルタ + 内部クエリ生成)。
// 公式 MCP の get-records と同じ設計を踏襲。

import { kintoneRequest } from '../kintone';

import { createTool, toolResult } from './factory';
import { type BuildQueryInput, buildQueryFromFilters } from './utils/build-query';

interface Args extends BuildQueryInput {
  app: string;
  fields?: string[];
  total_count?: boolean;
}

const filtersDescription =
  'Filter conditions for records. All conditions are AND-combined; OR is NOT supported. ' +
  'Use kintone-get-form-fields tool first to discover available field codes and types.';

export const getRecords = createTool<Args>(
  'kintone-get-records',
  {
    title: 'Get Records',
    description:
      'Get multiple records from a kintone app with structured filtering. ' +
      'All filter conditions are AND-combined; OR conditions are not supported by this MCP server. ' +
      'Use kintone-get-form-fields tool first to discover available field codes and their types.',
    inputSchema: {
      app: { type: 'string', description: 'The ID of the app (numeric value as string)' },
      filters: {
        type: 'object',
        description: filtersDescription,
        properties: {
          textContains: {
            type: 'array',
            description:
              'Text fields containing specified values (like operator). ' +
              'Supported fields: SINGLE_LINE_TEXT, LINK, MULTI_LINE_TEXT, RICH_TEXT, ATTACHMENT',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, value: { type: 'string' } },
              required: ['field', 'value'],
            },
          },
          equals: {
            type: 'array',
            description:
              'Fields equal to specified values (= operator). ' +
              'Supported fields: RECORD_NUMBER, $id, SINGLE_LINE_TEXT, LINK, NUMBER, CALC, DATE, TIME, DATETIME, CREATED_TIME, UPDATED_TIME, STATUS',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                value: { type: ['string', 'number'] as unknown as string },
              },
              required: ['field', 'value'],
            },
          },
          dateRange: {
            type: 'array',
            description:
              'Date fields within specified range (>=, <= operators). ' +
              'Supported fields: DATE, TIME, DATETIME, CREATED_TIME, UPDATED_TIME',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
                to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
              },
              required: ['field'],
            },
          },
          numberRange: {
            type: 'array',
            description:
              'Number fields within specified range (>=, <= operators). ' +
              'Supported fields: RECORD_NUMBER, $id, NUMBER, CALC',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                min: { type: 'number' },
                max: { type: 'number' },
              },
              required: ['field'],
            },
          },
          inValues: {
            type: 'array',
            description: 'Fields matching any of the specified values (in operator).',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                values: { type: 'array', items: { type: 'string' } },
              },
              required: ['field', 'values'],
            },
          },
          notInValues: {
            type: 'array',
            description: 'Fields not matching any of the specified values (not in operator).',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                values: { type: 'array', items: { type: 'string' } },
              },
              required: ['field', 'values'],
            },
          },
        },
      },
      orderBy: {
        type: 'array',
        description: 'Sort order for results',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
          },
          required: ['field'],
        },
      },
      fields: {
        type: 'array',
        description:
          'Field codes to retrieve. If not specified, all fields are retrieved. ' +
          'Use kintone-get-form-fields tool to see available fields',
        items: { type: 'string' },
      },
      limit: {
        type: 'number',
        description: 'Maximum records to retrieve (1-500)',
        minimum: 1,
        maximum: 500,
      },
      offset: { type: 'number', description: 'Number of records to skip', minimum: 0 },
      total_count: { type: 'boolean', description: 'Include totalCount in response' },
    },
    outputSchema: {
      records: { type: 'array', description: 'Array of records matching the query' },
      totalCount: {
        type: ['string', 'null'] as unknown as string,
        description: 'Total count if total_count=true, else null',
      },
    },
  },
  async (args, { creds }) => {
    const query = buildQueryFromFilters({
      ...(args.filters !== undefined ? { filters: args.filters } : {}),
      ...(args.orderBy !== undefined ? { orderBy: args.orderBy } : {}),
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.offset !== undefined ? { offset: args.offset } : {}),
    });

    const params: Record<string, unknown> = { app: args.app };
    if (query !== undefined) params['query'] = query;
    if (args.fields !== undefined) params['fields'] = args.fields;
    if (args.total_count) params['totalCount'] = 'true';

    const result = (await kintoneRequest(creds, 'GET', '/k/v1/records.json', { params })) as {
      records: unknown[];
      totalCount?: string;
    };

    const out = {
      records: result.records,
      totalCount: result.totalCount ?? null,
    };

    return toolResult(out);
  },
);
