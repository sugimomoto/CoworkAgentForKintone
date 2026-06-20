import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, makeVault } from '../../test/fixtures';

import { _resetResolveNotifyVaultCache, resolveNotifyVault } from './resolveNotifyVault';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  _resetResolveNotifyVaultCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const DOMAIN = 'example.cybozu.com';

describe('resolveNotifyVault', () => {
  it('既存の通知 Vault があればそれを返す (作成しない)', async () => {
    const existing = makeVault({
      id: 'vault_notify',
      metadata: {
        source: 'cowork-agent-for-kintone',
        purpose: 'notify',
        kintoneDomain: DOMAIN,
      },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [existing], next_page: null }));

    const result = await resolveNotifyVault(DOMAIN);

    expect(result.id).toBe('vault_notify');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('無ければ purpose=notify で作成する', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201));

    const result = await resolveNotifyVault(DOMAIN);

    expect(result.id).toBe('vault_new');
    const [, init] = fetchMock.mock.calls[1]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.display_name).toBe('Cowork Agent Notify - example.cybozu.com');
    expect(body.metadata).toEqual({
      source: 'cowork-agent-for-kintone',
      purpose: 'notify',
      kintoneDomain: DOMAIN,
    });
  });

  it('ユーザー Vault (purpose 無し) は通知 Vault として拾わない', async () => {
    const userVault = makeVault({
      id: 'vault_user',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: DOMAIN,
        kintoneUserCode: 'sato',
      },
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [userVault], next_page: null }))
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201));

    const result = await resolveNotifyVault(DOMAIN);

    expect(result.id).toBe('vault_new');
  });

  it('他ドメインの通知 Vault は除外する', async () => {
    const otherDomain = makeVault({
      id: 'vault_other',
      metadata: {
        source: 'cowork-agent-for-kintone',
        purpose: 'notify',
        kintoneDomain: 'another.cybozu.com',
      },
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [otherDomain], next_page: null }))
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201));

    const result = await resolveNotifyVault(DOMAIN);

    expect(result.id).toBe('vault_new');
  });
});
