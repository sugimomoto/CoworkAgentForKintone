import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, makeEnv } from '../../test/fixtures';

import { _resetEnsureUserEnvironmentCache, ensureUserEnvironment } from './ensureEnvironment';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  _resetEnsureUserEnvironmentCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CTX = {
  agentId: 'agent_default',
  kintoneDomain: 'example.cybozu.com',
  kintoneUserCode: 'sato',
};

describe('ensureUserEnvironment', () => {
  it('既存ユーザー Environment が見つかればそれを返す (作成しない)', async () => {
    const existing = makeEnv({
      id: 'env_existing',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'sato',
      },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [existing], next_page: null }));

    const result = await ensureUserEnvironment(CTX);

    expect(result.id).toBe('env_existing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('無ければ作成する (name / config / metadata / packages.pip / allowed_hosts を確認)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [], next_page: null }))
      .mockResolvedValueOnce(jsonResponse(makeEnv({ id: 'env_new' }), 201));

    const result = await ensureUserEnvironment(CTX);

    expect(result.id).toBe('env_new');
    const [, init] = fetchMock.mock.calls[1]!;
    const body = JSON.parse((init as RequestInit).body as string);

    expect(body.name).toBe('Cowork Agent - sato@example.cybozu.com');
    expect(body.metadata).toMatchObject({
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
      agentId: 'agent_default',
      helperVersion: '0.1.0a3',
    });
    expect(body.config.type).toBe('cloud');
    expect(body.config.networking.type).toBe('limited');
    expect(body.config.networking.allow_package_managers).toBe(true);
    expect(body.config.networking.allowed_hosts).toEqual(
      expect.arrayContaining(['example.cybozu.com', 'github.com', 'objects.githubusercontent.com']),
    );
    expect(body.config.packages.pip).toEqual([
      expect.stringContaining('cowork_agent_kintone-0.1.0a3-py3-none-any.whl'),
    ]);
  });

  it('他ユーザーや bootstrap purpose の Environment は除外する', async () => {
    const otherUser = makeEnv({
      id: 'env_other',
      metadata: {
        source: 'cowork-agent-for-kintone',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'tanaka',
      },
    });
    const bootstrap = makeEnv({
      id: 'env_bootstrap',
      metadata: {
        source: 'cowork-agent-for-kintone',
        purpose: 'bootstrap',
      },
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ data: [otherUser, bootstrap], next_page: null }),
      )
      .mockResolvedValueOnce(jsonResponse(makeEnv({ id: 'env_new' }), 201));

    const result = await ensureUserEnvironment(CTX);

    expect(result.id).toBe('env_new');
  });

  it('複数マッチ時は created_at 最古を選ぶ (race-deterministic)', async () => {
    const meta = {
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    };
    const older = makeEnv({ id: 'env_older', created_at: '2026-04-01T00:00:00Z', metadata: meta });
    const newer = makeEnv({ id: 'env_newer', created_at: '2026-04-25T00:00:00Z', metadata: meta });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [newer, older], next_page: null }),
    );

    const result = await ensureUserEnvironment(CTX);

    expect(result.id).toBe('env_older');
  });

  it('連続呼出で in-flight Promise を共有する (1 つしか作成されない)', async () => {
    let resolve!: (v: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((r) => { resolve = r; }),
    );

    const meta = {
      source: 'cowork-agent-for-kintone',
      kintoneDomain: 'example.cybozu.com',
      kintoneUserCode: 'sato',
    };
    const p1 = ensureUserEnvironment(CTX);
    const p2 = ensureUserEnvironment(CTX);

    resolve(jsonResponse({ data: [makeEnv({ id: 'env_x', metadata: meta })], next_page: null }));

    const [a, b] = await Promise.all([p1, p2]);

    expect(a.id).toBe('env_x');
    expect(b.id).toBe('env_x');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
