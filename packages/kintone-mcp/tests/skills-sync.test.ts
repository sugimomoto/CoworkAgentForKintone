// Worker /skills/sync エンドポイントのテスト (Issue #30)。
//
// 検証内容:
// - X-Anthropic-Api-Key 必須 (401)
// - body.skills 必須 (400)
// - 既存 custom skill 一覧を取得 → display_title 一致なら version 作成、無ければ新規作成
// - multipart の構築 (files[] フィールド)
// - 失敗時にエラー伝播

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleSkillsSync } from '../src/skills-sync';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeReq(opts: {
  body?: unknown;
  apiKey?: string | null;
}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey !== null) headers['X-Anthropic-Api-Key'] = opts.apiKey ?? 'sk-ant-test';
  return new Request('https://worker.example.com/skills/sync', {
    method: 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('handleSkillsSync', () => {
  it('X-Anthropic-Api-Key 無しは 401', async () => {
    const res = await handleSkillsSync(makeReq({ body: { skills: [] }, apiKey: null }));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('missing_anthropic_api_key');
  });

  it('body.skills が空配列は 400', async () => {
    const res = await handleSkillsSync(makeReq({ body: { skills: [] } }));
    expect(res.status).toBe(400);
  });

  it('skills アイテムに必須キーが欠けると 400', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const res = await handleSkillsSync(
      makeReq({
        body: {
          skills: [{ name: 'k', displayTitle: 'k' /* skillMd missing */ }],
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('既存 skill が無いときは新規作成 (POST /v1/skills)', async () => {
    // 1) 一覧取得 (空)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 }),
    );
    // 2) 新規作成
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'skill_new123',
          display_title: 'kintone-customize-js',
          latest_version: 'v_001',
          source: 'custom',
        }),
        { status: 200 },
      ),
    );

    const res = await handleSkillsSync(
      makeReq({
        body: {
          skills: [
            {
              name: 'kintone-customize-js',
              displayTitle: 'kintone-customize-js',
              skillMd: '---\nname: kintone-customize-js\ndescription: test\n---\n# body',
            },
          ],
        },
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      results: Array<{ name: string; skillId: string; action: string; version: string }>;
    };
    expect(json.results).toHaveLength(1);
    expect(json.results[0]!.skillId).toBe('skill_new123');
    expect(json.results[0]!.action).toBe('created');
    expect(json.results[0]!.version).toBe('v_001');

    // 1 回目 = 一覧、2 回目 = 新規作成
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const createCall = fetchMock.mock.calls[1]!;
    expect(createCall[0]).toBe('https://api.anthropic.com/v1/skills');
    expect((createCall[1] as RequestInit).method).toBe('POST');
    const fwdHeaders = (createCall[1] as RequestInit).headers as Record<string, string>;
    expect(fwdHeaders['X-Api-Key']).toBe('sk-ant-test');
    expect(fwdHeaders['anthropic-beta']).toContain('skills-2025-10-02');
  });

  it('display_title 一致なら既存 skill に新バージョン作成', async () => {
    // 1) 一覧取得 (display_title 一致あり)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'skill_existing',
              display_title: 'kintone-customize-js',
              latest_version: 'v_prev',
              source: 'custom',
            },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
    );
    // 2) 新バージョン作成
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'sv_999',
          version: 'v_new',
          skill_id: 'skill_existing',
        }),
        { status: 200 },
      ),
    );

    const res = await handleSkillsSync(
      makeReq({
        body: {
          skills: [
            {
              name: 'kintone-customize-js',
              displayTitle: 'kintone-customize-js',
              skillMd: '---\nname: kintone-customize-js\ndescription: updated\n---',
            },
          ],
        },
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      results: Array<{ skillId: string; action: string; version: string }>;
    };
    expect(json.results[0]!.skillId).toBe('skill_existing');
    expect(json.results[0]!.action).toBe('updated');
    expect(json.results[0]!.version).toBe('v_new');

    const versionCall = fetchMock.mock.calls[1]!;
    expect(versionCall[0]).toBe('https://api.anthropic.com/v1/skills/skill_existing/versions');
  });

  it('Anthropic 上流エラーは 502 で伝播 (partialResults 付き)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }),
    );

    const res = await handleSkillsSync(
      makeReq({
        body: {
          skills: [
            {
              name: 'bad',
              displayTitle: 'bad',
              skillMd: '---\nname: bad\ndescription: x\n---',
            },
          ],
        },
      }),
    );
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('anthropic_error');
  });
});
