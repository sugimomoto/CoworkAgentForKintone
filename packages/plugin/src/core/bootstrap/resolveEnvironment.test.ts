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
  it('既存の bootstrap Environment が見つかればそれを返す', async () => {
    const existing = makeEnv({ id: 'env_existing' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [existing], next_page: null } as ListResponse<Environment>),
    );

    const result = await resolveBootstrapEnvironment();

    expect(result.id).toBe('env_existing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(body.config.type).toBe('cloud');
    // Phase 1a は kintone 接続なし → allowed_hosts は空
    expect(body.config.networking.type).toBe('limited');
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
