// resolveBuiltInAgents のテスト
//
// 3 variant の並行 ensure / 既存検出 / レース対策 / kintoneDomain 分離 を検証。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, makeAgent } from '../../test/fixtures';

import {
  _resetResolveBuiltInAgentsCache,
  builtInToolsVersion,
  resolveBuiltInAgents,
} from './resolveBuiltInAgents';

import type { Agent, ListResponse } from '../managed-agents/types';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  _resetResolveBuiltInAgentsCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetResolveBuiltInAgentsCache();
});

const OPTIONS = {
  workerUrl: 'https://w.example.com',
  kintoneDomain: 'tenant.cybozu.com',
};

/**
 * 3 variant 全部について「既存なし → POST で作成」のシナリオで mock を組み立てる。
 *
 * Promise.all で 3 並行に走るため、fetchMock の呼出順序は実行時の race に依存する。
 * よって個別にレスポンスを mock するのではなく、URL とメソッドで分岐する mockImplementation を使う。
 */
function mockAllVariantsCreate(idMap: Record<string, string>): void {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = new URL(url);
    if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
      // list (検索)
      const empty: ListResponse<Agent> = { data: [], next_page: null };
      return Promise.resolve(jsonResponse(empty));
    }
    if (u.pathname === '/v1/agents' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as { metadata: { purpose: string } };
      const purpose = body.metadata.purpose;
      const id = idMap[purpose] ?? `agent_${purpose}`;
      return Promise.resolve(jsonResponse(makeAgent({ id, metadata: body.metadata })));
    }
    throw new Error(`unexpected fetch: ${url} ${init?.method}`);
  });
}

describe('resolveBuiltInAgents', () => {
  it('3 variant が並行 ensure される (新規作成)', async () => {
    mockAllVariantsCreate({
      business: 'agent_biz',
      'customizer-opus': 'agent_co',
      'customizer-sonnet': 'agent_cs',
    });

    const result = await resolveBuiltInAgents(OPTIONS);

    expect(result.business.id).toBe('agent_biz');
    expect(result.customizerOpus.id).toBe('agent_co');
    expect(result.customizerSonnet.id).toBe('agent_cs');
    expect(result.appDesigner.id).toBe('agent_app-designer'); // idMap 未指定 → フォールバック
  });

  it('各 variant の POST body に正しい purpose / model / iconKind / variantGroup が含まれる', async () => {
    mockAllVariantsCreate({
      business: 'a1',
      'customizer-opus': 'a2',
      'customizer-sonnet': 'a3',
    });

    await resolveBuiltInAgents(OPTIONS);

    const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
    expect(posts).toHaveLength(4);

    const bodies = posts.map((c) => JSON.parse(c[1].body));
    const businessBody = bodies.find((b) => b.metadata.purpose === 'business');
    const opusBody = bodies.find((b) => b.metadata.purpose === 'customizer-opus');
    const sonnetBody = bodies.find((b) => b.metadata.purpose === 'customizer-sonnet');
    const appDesignerBody = bodies.find((b) => b.metadata.purpose === 'app-designer');

    expect(appDesignerBody.model).toBe('claude-opus-4-7');
    expect(appDesignerBody.metadata.iconKind).toBe('doc');
    expect(appDesignerBody.metadata.iconColor).toBe('accent');
    expect(appDesignerBody.metadata.variantGroup).toBeUndefined();
    expect(appDesignerBody.metadata.isDefault).toBe('0');

    expect(businessBody.model).toBe('claude-sonnet-4-6');
    expect(businessBody.metadata.iconKind).toBe('biz');
    expect(businessBody.metadata.iconColor).toBe('accentSoft');
    expect(businessBody.metadata.variantGroup).toBeUndefined();
    expect(businessBody.metadata.isDefault).toBe('0');
    expect(businessBody.metadata.visibility).toBe('public');

    // #48: customizer-opus は エージェントデザイナーに repurpose、variantGroup を外した
    expect(opusBody.model).toBe('claude-opus-4-7');
    expect(opusBody.metadata.iconKind).toBe('ai');
    expect(opusBody.metadata.iconColor).toBe('accent');
    expect(opusBody.metadata.variantGroup).toBeUndefined();
    expect(opusBody.metadata.isDefault).toBe('1');

    expect(sonnetBody.model).toBe('claude-sonnet-4-6');
    expect(sonnetBody.metadata.variantGroup).toBe('customizer');
    expect(sonnetBody.metadata.isDefault).toBe('0');
  });

  it('promptVersion v21-business-memory / v23-customizer-memory / v24-agent-designer-memory が metadata.promptVersion に入る', async () => {
    mockAllVariantsCreate({
      business: 'a1',
      'customizer-opus': 'a2',
      'customizer-sonnet': 'a3',
    });
    await resolveBuiltInAgents(OPTIONS);
    const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
    const bodies = posts.map((c) => JSON.parse(c[1].body));
    const businessBody = bodies.find((b) => b.metadata.purpose === 'business');
    const opusBody = bodies.find((b) => b.metadata.purpose === 'customizer-opus');
    const sonnetBody = bodies.find((b) => b.metadata.purpose === 'customizer-sonnet');
    const appDesignerBody = bodies.find((b) => b.metadata.purpose === 'app-designer');
    expect(businessBody.metadata.promptVersion).toBe('v21-business-memory');
    expect(opusBody.metadata.promptVersion).toBe('v24-agent-designer-memory');
    expect(sonnetBody.metadata.promptVersion).toBe('v23-customizer-memory');
    expect(appDesignerBody.metadata.promptVersion).toBe('v3-app-designer-memory');
  });

  it('customSkills は customSkillFilter(name) で variant 別に attach される (#117)', async () => {
    mockAllVariantsCreate({});
    await resolveBuiltInAgents({
      ...OPTIONS,
      customSkills: [
        { name: 'kintone-app-design', skillId: 'sk_app' },
        { name: 'kintone-customize-js', skillId: 'sk_js' },
      ],
    });

    const bodies = fetchMock.mock.calls
      .filter((c) => c[1]?.method === 'POST')
      .map((c) => JSON.parse(c[1].body as string));
    const skillIdsOf = (purpose: string): string[] =>
      (bodies.find((b) => b.metadata.purpose === purpose)?.skills ?? [])
        .filter((s: { type: string }) => s.type === 'custom')
        .map((s: { skill_id: string }) => s.skill_id);

    // app-designer は app-design skill のみ (JS skill は付かない)
    expect(skillIdsOf('app-designer')).toEqual(['sk_app']);
    // customizer-sonnet は app-design 以外 (JS skill) を attach
    expect(skillIdsOf('customizer-sonnet')).toEqual(['sk_js']);
    // business / customizer-opus は custom skill なし
    expect(skillIdsOf('business')).toEqual([]);
    expect(skillIdsOf('customizer-opus')).toEqual([]);
  });

  it('既存 Agent が見つかれば再利用 (POST 呼出 0 回)', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
        // 各 variant の既存 Agent を返す (filter は body に含まれないが、本テストでは全 GET に同じ entity を返す)
        // 実際には findByMetadata がクライアント側で metadata.purpose で絞るので、3 つの異なる purpose を含む list を返せばよい
        const list: ListResponse<Agent> = {
          data: [
            makeAgent({
              id: 'biz_existing',
              metadata: {
                source: 'cowork-agent-for-kintone',
                type: 'default',
                purpose: 'business',
                promptVersion: 'v21-business-memory',
                workerUrl: OPTIONS.workerUrl,
                kintoneDomain: OPTIONS.kintoneDomain,
                toolsVersion: builtInToolsVersion('business'),
              },
            }),
            makeAgent({
              id: 'opus_existing',
              metadata: {
                source: 'cowork-agent-for-kintone',
                type: 'default',
                purpose: 'customizer-opus',
                promptVersion: 'v24-agent-designer-memory',
                workerUrl: OPTIONS.workerUrl,
                kintoneDomain: OPTIONS.kintoneDomain,
                toolsVersion: builtInToolsVersion('customizer-opus'),
              },
            }),
            makeAgent({
              id: 'sonnet_existing',
              metadata: {
                source: 'cowork-agent-for-kintone',
                type: 'default',
                purpose: 'customizer-sonnet',
                promptVersion: 'v23-customizer-memory',
                workerUrl: OPTIONS.workerUrl,
                kintoneDomain: OPTIONS.kintoneDomain,
                toolsVersion: builtInToolsVersion('customizer-sonnet'),
              },
            }),
            makeAgent({
              id: 'appdes_existing',
              metadata: {
                source: 'cowork-agent-for-kintone',
                type: 'default',
                purpose: 'app-designer',
                promptVersion: 'v3-app-designer-memory',
                workerUrl: OPTIONS.workerUrl,
                kintoneDomain: OPTIONS.kintoneDomain,
                toolsVersion: builtInToolsVersion('app-designer'),
              },
            }),
          ],
          next_page: null,
        };
        return Promise.resolve(jsonResponse(list));
      }
      throw new Error('should not POST');
    });

    const result = await resolveBuiltInAgents(OPTIONS);
    expect(result.business.id).toBe('biz_existing');
    expect(result.customizerOpus.id).toBe('opus_existing');
    expect(result.customizerSonnet.id).toBe('sonnet_existing');
    expect(result.appDesigner.id).toBe('appdes_existing');
    expect(fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(0);
  });

  it('kintoneDomain が違うと別 Agent として扱われる', async () => {
    mockAllVariantsCreate({
      business: 'biz_dev',
      'customizer-opus': 'opus_dev',
      'customizer-sonnet': 'sonnet_dev',
    });
    const result = await resolveBuiltInAgents({
      ...OPTIONS,
      kintoneDomain: 'dev.cybozu.com',
    });

    // 全 POST body の kintoneDomain が 'dev.cybozu.com'
    const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
    const bodies = posts.map((c) => JSON.parse(c[1].body));
    for (const b of bodies) {
      expect(b.metadata.kintoneDomain).toBe('dev.cybozu.com');
    }
    expect(result.business.id).toBe('biz_dev');
  });

  it('レース対策: 作成直後の再 list で 2 件出たら最古を返す', async () => {
    let postCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
        if (postCount > 0) {
          // 作成直後の再 list: business のみ 2 件 (重複) として返す
          const list: ListResponse<Agent> = {
            data: [
              makeAgent({
                id: 'biz_my_post',
                created_at: '2026-04-25T00:00:01Z',
                metadata: {
                  source: 'cowork-agent-for-kintone',
                  type: 'default',
                  purpose: 'business',
                  promptVersion: 'v21-business-memory',
                  workerUrl: OPTIONS.workerUrl,
                  kintoneDomain: OPTIONS.kintoneDomain,
                },
              }),
              makeAgent({
                id: 'biz_other_tab_older',
                created_at: '2026-04-25T00:00:00Z', // older
                metadata: {
                  source: 'cowork-agent-for-kintone',
                  type: 'default',
                  purpose: 'business',
                  promptVersion: 'v21-business-memory',
                  workerUrl: OPTIONS.workerUrl,
                  kintoneDomain: OPTIONS.kintoneDomain,
                },
              }),
            ],
            next_page: null,
          };
          return Promise.resolve(jsonResponse(list));
        }
        const empty: ListResponse<Agent> = { data: [], next_page: null };
        return Promise.resolve(jsonResponse(empty));
      }
      if (u.pathname === '/v1/agents' && init?.method === 'POST') {
        postCount++;
        const body = JSON.parse(init.body as string) as { metadata: { purpose: string } };
        return Promise.resolve(
          jsonResponse(
            makeAgent({
              id: `${body.metadata.purpose}_my_post`,
              metadata: body.metadata,
            }),
          ),
        );
      }
      throw new Error(`unexpected: ${url}`);
    });

    const result = await resolveBuiltInAgents(OPTIONS);

    // business だけ別タブとの race で重複作成、最古を返す
    expect(result.business.id).toBe('biz_other_tab_older');
  });

  it('in-flight キャッシュは purpose 単位 (連続呼出で重複 POST しない)', async () => {
    mockAllVariantsCreate({
      business: 'a1',
      'customizer-opus': 'a2',
      'customizer-sonnet': 'a3',
    });

    // 同時に 2 回呼ぶ (await せず Promise.all)
    const [r1, r2] = await Promise.all([
      resolveBuiltInAgents(OPTIONS),
      resolveBuiltInAgents(OPTIONS),
    ]);

    expect(r1.business.id).toBe(r2.business.id);
    // POST は variant ごとに 1 回ずつ = 計 4 回 (2 回呼出でも重複しない)
    const posts = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST');
    expect(posts).toHaveLength(4);
  });

  // #86: ツールドリフト修復 — 既存エージェントの toolsVersion が古い/未設定なら updateAgent で tools を追従
  /** 3 variant の既存を返す。toolsVersion を上書きしたい variant だけ override で空文字等にする。 */
  function existingWithToolsVersion(opusToolsVersion: string): ListResponse<Agent> {
    return {
      data: [
        makeAgent({
          id: 'biz_existing',
          metadata: {
            source: 'cowork-agent-for-kintone',
            type: 'default',
            purpose: 'business',
            promptVersion: 'v21-business-memory',
            workerUrl: OPTIONS.workerUrl,
            kintoneDomain: OPTIONS.kintoneDomain,
            toolsVersion: builtInToolsVersion('business'),
          },
        }),
        makeAgent({
          id: 'opus_existing',
          version: 7,
          metadata: {
            source: 'cowork-agent-for-kintone',
            type: 'default',
            purpose: 'customizer-opus',
            promptVersion: 'v24-agent-designer-memory',
            workerUrl: OPTIONS.workerUrl,
            kintoneDomain: OPTIONS.kintoneDomain,
            // propose_agent 未配線の中間ビルドで作られた = toolsVersion なし (空文字で表現)
            ...(opusToolsVersion ? { toolsVersion: opusToolsVersion } : {}),
          },
        }),
        makeAgent({
          id: 'sonnet_existing',
          metadata: {
            source: 'cowork-agent-for-kintone',
            type: 'default',
            purpose: 'customizer-sonnet',
            promptVersion: 'v23-customizer-memory',
            workerUrl: OPTIONS.workerUrl,
            kintoneDomain: OPTIONS.kintoneDomain,
            toolsVersion: builtInToolsVersion('customizer-sonnet'),
          },
        }),
        makeAgent({
          id: 'appdes_existing',
          metadata: {
            source: 'cowork-agent-for-kintone',
            type: 'default',
            purpose: 'app-designer',
            promptVersion: 'v3-app-designer-memory',
            workerUrl: OPTIONS.workerUrl,
            kintoneDomain: OPTIONS.kintoneDomain,
            toolsVersion: builtInToolsVersion('app-designer'),
          },
        }),
      ],
      next_page: null,
    };
  }

  it('toolsVersion が古いデザイナーは updateAgent で propose_agent を含む tools に修復される', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(jsonResponse(existingWithToolsVersion('')));
      }
      // updateAgent: POST /v1/agents/{id}
      if (u.pathname === '/v1/agents/opus_existing' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as {
          tools: Array<{ name?: string }>;
          metadata: Record<string, string>;
        };
        return Promise.resolve(
          jsonResponse(makeAgent({ id: 'opus_existing', metadata: body.metadata })),
        );
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method}`);
    });

    const result = await resolveBuiltInAgents(OPTIONS);
    expect(result.customizerOpus.id).toBe('opus_existing');

    // updateAgent は opus のみ 1 回 (business / sonnet は toolsVersion 一致で no-op)
    const updates = fetchMock.mock.calls.filter(
      (c) => new URL(c[0] as string).pathname.startsWith('/v1/agents/') && c[1]?.method === 'POST',
    );
    expect(updates).toHaveLength(1);
    const [updateUrl, updateInit] = updates[0] as [string, RequestInit];
    expect(new URL(updateUrl).pathname).toBe('/v1/agents/opus_existing');

    const body = JSON.parse(updateInit.body as string);
    expect(body.version).toBe(7); // 楽観ロック: 既存 version を送る
    expect(body.tools.some((t: { name?: string }) => t.name === 'propose_agent')).toBe(true);
    expect(body.metadata.toolsVersion).toBe(builtInToolsVersion('customizer-opus'));
  });

  it('reconcile が 409 衝突したら retrieve し、別タブが修復済みなら再試行しない', async () => {
    let updateCount = 0;
    let retrieveCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(jsonResponse(existingWithToolsVersion('')));
      }
      // retrieveAgent: GET /v1/agents/{id}
      if (u.pathname === '/v1/agents/opus_existing' && (!init?.method || init.method === 'GET')) {
        retrieveCount++;
        // 別タブが先に最新 toolsVersion へ修復済み
        return Promise.resolve(
          jsonResponse(
            makeAgent({
              id: 'opus_existing',
              version: 9,
              metadata: {
                source: 'cowork-agent-for-kintone',
                type: 'default',
                purpose: 'customizer-opus',
                promptVersion: 'v24-agent-designer-memory',
                workerUrl: OPTIONS.workerUrl,
                kintoneDomain: OPTIONS.kintoneDomain,
                toolsVersion: builtInToolsVersion('customizer-opus'),
              },
            }),
          ),
        );
      }
      if (u.pathname === '/v1/agents/opus_existing' && init?.method === 'POST') {
        updateCount++;
        return Promise.resolve(jsonResponse({ type: 'error', message: 'conflict' }, 409));
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method}`);
    });

    const result = await resolveBuiltInAgents(OPTIONS);
    expect(result.customizerOpus.id).toBe('opus_existing');
    expect(result.customizerOpus.metadata['toolsVersion']).toBe(
      builtInToolsVersion('customizer-opus'),
    );
    expect(updateCount).toBe(1); // 409 一度きり、再試行しない
    expect(retrieveCount).toBe(1);
  });

  it('builtInToolsVersion は決定的 (同一 purpose で同値・variant 間で別値)', () => {
    expect(builtInToolsVersion('customizer-opus')).toBe(builtInToolsVersion('customizer-opus'));
    expect(builtInToolsVersion('customizer-opus')).not.toBe(builtInToolsVersion('business'));
  });

  // #117: 同期前に作られた既存 app-designer (skillsVersion 無し) に、同期後の bootstrap で
  // kintone-app-design skill を後付けする (再作成や promptVersion bump 無しで self-heal)。
  it('既存 app-designer に skill 未 attach なら reconcile で kintone-app-design を後付けする (#117)', async () => {
    const updates: Array<{ path: string; body: { skills?: Array<{ type: string; skill_id: string }>; metadata: Record<string, string> } }> = [];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
        // 全 variant とも toolsVersion は最新、ただし skillsVersion は未設定 (= 同期前に作成)
        return Promise.resolve(
          jsonResponse(existingWithToolsVersion(builtInToolsVersion('customizer-opus'))),
        );
      }
      // updateAgent: POST /v1/agents/{id}
      if (u.pathname.startsWith('/v1/agents/') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        updates.push({ path: u.pathname, body });
        return Promise.resolve(
          jsonResponse(makeAgent({ id: u.pathname.split('/').pop()!, metadata: body.metadata })),
        );
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method}`);
    });

    await resolveBuiltInAgents({
      ...OPTIONS,
      customSkills: [{ name: 'kintone-app-design', skillId: 'sk_app' }],
    });

    // app-designer のみ更新 (business/opus/sonnet は custom skill 対象外 + toolsVersion 一致で no-op)
    expect(updates).toHaveLength(1);
    expect(updates[0]!.path).toBe('/v1/agents/appdes_existing');
    const customSkillIds = (updates[0]!.body.skills ?? [])
      .filter((s) => s.type === 'custom')
      .map((s) => s.skill_id);
    expect(customSkillIds).toEqual(['sk_app']);
    expect(updates[0]!.body.metadata['skillsVersion']).toBeTruthy();
  });

  // 同期前 (customSkills 空) の reconcile では skills を送らない (既存 skills を消さない安全側)。
  it('customSkills 未解決のときは skill reconcile しない (既存 skills を消さない)', async () => {
    let updateCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = new URL(url);
      if (u.pathname === '/v1/agents' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(
          jsonResponse(existingWithToolsVersion(builtInToolsVersion('customizer-opus'))),
        );
      }
      if (u.pathname.startsWith('/v1/agents/') && init?.method === 'POST') {
        updateCount++;
        const body = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse(makeAgent({ id: 'x', metadata: body.metadata })));
      }
      throw new Error(`unexpected fetch: ${url} ${init?.method}`);
    });

    // customSkills を渡さない → toolsVersion 一致なので誰も更新されない
    await resolveBuiltInAgents(OPTIONS);
    expect(updateCount).toBe(0);
  });
});
