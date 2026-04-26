import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { jsonResponse, makeEnv } from '../../test/fixtures';

import { resolveBootstrapEnvironment } from './resolveEnvironment';

import type { Environment, ListResponse } from '../managed-agents/types';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveBootstrapEnvironment', () => {
  it('既存の bootstrap Environment (mcpEnabled=true) が見つかればそれを返す', async () => {
    const existing = makeEnv({
      id: 'env_existing',
      metadata: {
        source: 'cowork-agent-for-kintone',
        purpose: 'bootstrap',
        mcpEnabled: 'true',
      },
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [existing], next_page: null } as ListResponse<Environment>),
    );

    const result = await resolveBootstrapEnvironment();

    expect(result.id).toBe('env_existing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mcpEnabled が無い古い Environment は無視され、新規作成される', async () => {
    const oldEnv = makeEnv({
      id: 'env_old',
      // metadata に mcpEnabled が無い旧世代
      metadata: { source: 'cowork-agent-for-kintone', purpose: 'bootstrap' },
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [oldEnv], next_page: null } as ListResponse<Environment>),
    );
    const created = makeEnv({ id: 'env_new_mcp' });
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));

    const result = await resolveBootstrapEnvironment();
    expect(result.id).toBe('env_new_mcp');
  });

  it('Environment が無ければ作成する (network: limited, packages なし)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }));
    const created = makeEnv({ id: 'env_new' });
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201));

    const result = await resolveBootstrapEnvironment();

    expect(result.id).toBe('env_new');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, init] = fetchMock.mock.calls[1]!;
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);

    expect(body.metadata.source).toBe('cowork-agent-for-kintone');
    expect(body.metadata.purpose).toBe('bootstrap');
    expect(body.metadata.mcpEnabled).toBe('true');
    expect(body.config.type).toBe('cloud');
    // Phase 1b-3: MCP server へのアクセスを許可
    expect(body.config.networking.type).toBe('limited');
    expect(body.config.networking.allow_mcp_servers).toBe(true);
    expect(body.config.networking.allowed_hosts).toEqual([]);
  });

  it('プラグイン外の Environment は無視する', async () => {
    const other = makeEnv({
      id: 'env_other',
      metadata: { source: 'someone-else', purpose: 'bootstrap' },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [other], next_page: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse(makeEnv({ id: 'env_new' }), 201));

    const result = await resolveBootstrapEnvironment();

    expect(result.id).toBe('env_new');
  });

  it('purpose が bootstrap でない Environment (= ユーザー専用 Phase 1b 産) は無視する', async () => {
    const userEnv = makeEnv({
      id: 'env_user',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'sato',
      },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [userEnv], next_page: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse(makeEnv({ id: 'env_new' }), 201));

    const result = await resolveBootstrapEnvironment();

    expect(result.id).toBe('env_new');
  });
});
