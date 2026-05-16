// Plugin skillsSyncClient のテスト (Issue #30)。
//
// 検証内容:
// - kintone.plugin.app.proxy 経由で Worker /skills/sync に JSON 送信
// - 成功時に results を返却
// - 失敗時に SkillSyncError をスロー

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillSyncError, syncSkills } from './skillsSyncClient';

import type { SkillBundle } from '../../generated/skills-bundle';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  vi.stubGlobal('kintone', {
    plugin: { app: { proxy: proxyMock } },
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
  it('Worker /skills/sync に POST + JSON body を kintone proxy 経由で送信する', async () => {
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
      pluginId: 'plg_x',
      workerUrl: 'https://w.example.com',
      bundles: [makeBundle('kintone-customize-js')],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.skillId).toBe('skill_a');

    expect(proxyMock).toHaveBeenCalledTimes(1);
    const [pluginId, url, method, headers, body] = proxyMock.mock.calls[0]!;
    expect(pluginId).toBe('plg_x');
    expect(url).toBe('https://w.example.com/skills/sync');
    expect(method).toBe('POST');
    expect(headers).toEqual({});
    const parsed = JSON.parse(body as string);
    expect(parsed.skills).toHaveLength(1);
    expect(parsed.skills[0].name).toBe('kintone-customize-js');
  });

  it('空 bundle 配列なら何も送らず results=[] を返す', async () => {
    const result = await syncSkills({
      pluginId: 'plg_x',
      workerUrl: 'https://w.example.com',
      bundles: [],
    });
    expect(result.results).toEqual([]);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it('non-2xx は SkillSyncError をスロー', async () => {
    proxyMock.mockResolvedValueOnce(['internal error', 500]);
    await expect(
      syncSkills({
        pluginId: 'plg_x',
        workerUrl: 'https://w.example.com',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toBeInstanceOf(SkillSyncError);
  });

  it('JSON parse 失敗時は通常 Error', async () => {
    proxyMock.mockResolvedValueOnce(['not-json', 200]);
    await expect(
      syncSkills({
        pluginId: 'plg_x',
        workerUrl: 'https://w.example.com',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toThrow(/invalid JSON/);
  });

  it('results フィールド欠落でエラー', async () => {
    proxyMock.mockResolvedValueOnce([JSON.stringify({ foo: 'bar' }), 200]);
    await expect(
      syncSkills({
        pluginId: 'plg_x',
        workerUrl: 'https://w.example.com',
        bundles: [makeBundle('k')],
      }),
    ).rejects.toThrow(/results array/);
  });
});
