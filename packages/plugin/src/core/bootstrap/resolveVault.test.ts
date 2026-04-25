import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, makeVault } from '../../test/fixtures';

import { _resetResolveUserVaultCache, resolveUserVault, setVaultCredentials } from './resolveVault';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  _resetResolveUserVaultCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CTX = {
  kintoneDomain: 'example.cybozu.com',
  kintoneUserCode: 'sato',
};

describe('resolveUserVault', () => {
  it('既存 Vault が見つかればそれを返す (作成しない)', async () => {
    const existing = makeVault({ id: 'vault_existing' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [existing], next_page: null }));

    const result = await resolveUserVault(CTX);

    expect(result.id).toBe('vault_existing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('無ければ作成する (display_name と metadata が正しく設定される)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201));

    const result = await resolveUserVault(CTX);

    expect(result.id).toBe('vault_new');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, init] = fetchMock.mock.calls[1]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.display_name).toBe('Cowork Agent - sato@example.cybozu.com');
    expect(body.metadata).toEqual({
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    });
  });

  it('他ユーザーの Vault は除外する', async () => {
    const otherUser = makeVault({
      id: 'vault_other',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'tanaka',
      },
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [otherUser], next_page: null }))
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201));

    const result = await resolveUserVault(CTX);

    expect(result.id).toBe('vault_new');
  });

  it('他ドメイン / 他 source の Vault は除外する', async () => {
    const otherDomain = makeVault({
      id: 'vault_other_dom',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'another.cybozu.com',
        kintoneUserCode: 'sato',
      },
    });
    const otherSource = makeVault({
      id: 'vault_other_src',
      metadata: {
        source: 'someone-else',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'sato',
      },
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ data: [otherDomain, otherSource], next_page: null }),
      )
      .mockResolvedValueOnce(jsonResponse(makeVault({ id: 'vault_new' }), 201));

    const result = await resolveUserVault(CTX);

    expect(result.id).toBe('vault_new');
  });

  it('複数マッチ時は created_at 最古を選ぶ (race-deterministic)', async () => {
    const older = makeVault({ id: 'vault_older', created_at: '2026-04-01T00:00:00Z' });
    const newer = makeVault({ id: 'vault_newer', created_at: '2026-04-25T00:00:00Z' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [newer, older], next_page: null }),
    );

    const result = await resolveUserVault(CTX);

    expect(result.id).toBe('vault_older');
  });

  it('連続呼出で in-flight Promise を共有する (1 つしか作成されない)', async () => {
    let resolve!: (v: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((r) => { resolve = r; }),
    );

    const p1 = resolveUserVault(CTX);
    const p2 = resolveUserVault(CTX);

    resolve(jsonResponse({ data: [makeVault({ id: 'vault_x' })], next_page: null }));

    const [a, b] = await Promise.all([p1, p2]);

    expect(a.id).toBe('vault_x');
    expect(b.id).toBe('vault_x');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('setVaultCredentials', () => {
  it('3 キー (DOMAIN/LOGIN/PASSWORD) を upsert する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeVault(), 200));

    await setVaultCredentials('vault_x', {
      domain: 'example.cybozu.com',
      login: 'sato',
      password: 'p4ss',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/vaults/vault_x/keys');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      keys: {
        KINTONE_DOMAIN: 'example.cybozu.com',
        KINTONE_LOGIN: 'sato',
        KINTONE_PASSWORD: 'p4ss',
      },
    });
  });
});
