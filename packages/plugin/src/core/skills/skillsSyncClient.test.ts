// Plugin skillsSyncClient のテスト (Issue #30)。
//
// 検証内容:
// - Config 画面用に kintone.proxy() を使う (kintone.plugin.app.proxy ではない)
// - API Key を引数で受け取り X-Anthropic-Api-Key ヘッダに付与する
// - 失敗時に SkillSyncError をスロー

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillSyncError, syncSkills } from './skillsSyncClient';

import type { SkillBundle } from '../../generated/skills-bundle';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  // Config 画面用の kintone.proxy (kintone.plugin.app.proxy ではない)
  vi.stubGlobal('kintone', {
    proxy: proxyMock,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeBundle(name: string): SkillBundle {
  return {
    name,
    displayTitle: name,
    skillMd: `---\nname: ${name}\ndescription: x\n---\nbody`,
  };
}

describe('syncSkills', () => {
  it('Worker /skills/sync に POST + JSON body を kintone.proxy 経由で送信する (X-Anthropic-Api-Key ヘッダ付き)', async () => {
    proxyMock.mockResolvedValueOnce([
      JSON.stringify({
        results: [
          {
            name: 'kintone-customize-js',
            displayTitle: 'kintone-customize-js',
            skillId: 'skill_a',
            version: 'v1',
            action: 'created',
          },
        ],
      }),
      200,
    ]);

    const result = await syncSkills({
      workerUrl: 'https://w.example.com',
      anthropicApiKey: 'sk-ant-x',
      bundles: [makeBundle('kintone-customize-js')],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.skillId).toBe('skill_a');

    expect(proxyMock).toHaveBeenCalledTimes(1);
    const [url, method, headers, body] = proxyMock.mock.calls[0]!;
    expect(url).toBe('https://w.example.com/skills/sync');
    expect(method).toBe('POST');
    expect((headers as Record<string, string>)['X-Anthropic-Api-Key']).toBe('sk-ant-x');
    expect((headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const parsed = JSON.parse(body as string);
    expect(parsed.skills).toHaveLength(1);
    expect(parsed.skills[0].name).toBe('kintone-customize-js');
  });

  it('API Key 未指定はエラー', async () => {
    await expect(
      syncSkills({
        workerUrl: 'https://w.example.com',
        anthropicApiKey: '',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toThrow(/API Key/);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it('空 bundle 配列なら何も送らず results=[] を返す', async () => {
    const result = await syncSkills({
      workerUrl: 'https://w.example.com',
      anthropicApiKey: 'sk-ant-x',
      bundles: [],
    });
    expect(result.results).toEqual([]);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it('non-2xx は SkillSyncError をスロー', async () => {
    proxyMock.mockResolvedValueOnce(['internal error', 500]);
    await expect(
      syncSkills({
        workerUrl: 'https://w.example.com',
        anthropicApiKey: 'sk-ant-x',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toBeInstanceOf(SkillSyncError);
  });

  it('JSON parse 失敗時は通常 Error', async () => {
    proxyMock.mockResolvedValueOnce(['not-json', 200]);
    await expect(
      syncSkills({
        workerUrl: 'https://w.example.com',
        anthropicApiKey: 'sk-ant-x',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toThrow(/invalid JSON/);
  });

  it('results フィールド欠落でエラー', async () => {
    proxyMock.mockResolvedValueOnce([JSON.stringify({ foo: 'bar' }), 200]);
    await expect(
      syncSkills({
        workerUrl: 'https://w.example.com',
        anthropicApiKey: 'sk-ant-x',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toThrow(/results array/);
  });
});
