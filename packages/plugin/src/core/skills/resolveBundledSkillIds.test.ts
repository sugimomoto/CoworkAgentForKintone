// resolveBundledSkillIds のユニットテスト
//
// 検証観点:
//   - Anthropic `/v1/skills?source=custom` を Worker passthrough 経由で叩く
//   - apiRequest 経由なので apiHeaders で anthropic-version / anthropic-beta が付与される
//   - extra で `anthropic-beta: skills-2025-10-02` を渡し、MANAGED_AGENTS_BETA を上書き
//     (kintone proxy が comma 連結値を切るため単独で送る必要がある)
//   - SKILL_BUNDLES[].displayTitle と Anthropic 側 display_title で照合
//   - ページネーション (has_more / next_page) を全展開

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiBase, resetTransport, setApiBase, setTransport } from '../managed-agents/client';

import { resolveBundledSkillIds } from './resolveBundledSkillIds';

import { SKILL_BUNDLES } from '../../generated/skills-bundle';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let transportMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  transportMock = vi.fn();
  setTransport(transportMock);
  setApiBase('https://worker.example.com/anthropic');
});

afterEach(() => {
  resetTransport();
  resetApiBase();
});

describe('resolveBundledSkillIds', () => {
  it('Worker passthrough (apiBase) 経由で /v1/skills?source=custom を GET し、Skills 用 beta を単独で送信する', async () => {
    transportMock.mockResolvedValue(jsonResponse({ data: [], has_more: false, next_page: null }));

    await resolveBundledSkillIds();

    expect(transportMock).toHaveBeenCalledTimes(1);
    const [url, init] = transportMock.mock.calls[0]!;
    expect(url).toBe(
      'https://worker.example.com/anthropic/v1/skills?source=custom&limit=100',
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
    // kintone proxy が comma 連結値を split するため beta は単独 (skills-2025-10-02) で送信
    expect(headers['anthropic-beta']).toBe('skills-2025-10-02');
    // x-api-key は JS 側で付けない (kintone proxy が固定ヘッダで注入)
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('display_title 一致で skillId を返し、無ければ null を返す', async () => {
    const [first] = SKILL_BUNDLES;
    if (!first) throw new Error('SKILL_BUNDLES が空');
    transportMock.mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'skill_abc',
            display_title: first.displayTitle,
            latest_version: '1779000000000000',
            source: 'custom',
          },
        ],
        has_more: false,
        next_page: null,
      }),
    );

    const resolved = await resolveBundledSkillIds();

    expect(resolved).toHaveLength(SKILL_BUNDLES.length);
    const firstResolved = resolved.find((r) => r.name === first.name);
    expect(firstResolved?.skillId).toBe('skill_abc');
    expect(firstResolved?.latestVersion).toBe('1779000000000000');
    // 残りの bundle は未同期
    for (const r of resolved) {
      if (r.name === first.name) continue;
      expect(r.skillId).toBeNull();
    }
  });

  it('has_more=true なら次ページを取得、最終ページまで展開する', async () => {
    transportMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: 'skill_p1', display_title: 'unrelated-1', latest_version: 'v1', source: 'custom' },
          ],
          has_more: true,
          next_page: 'TOKEN_P2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: 'skill_p2', display_title: 'unrelated-2', latest_version: 'v2', source: 'custom' },
          ],
          has_more: false,
          next_page: null,
        }),
      );

    await resolveBundledSkillIds();

    expect(transportMock).toHaveBeenCalledTimes(2);
    const url2 = transportMock.mock.calls[1]![0];
    expect(url2).toContain('page=TOKEN_P2');
  });

  it('list レスポンスが空でも未同期で結果を返す (全て skillId=null)', async () => {
    transportMock.mockResolvedValue(jsonResponse({ data: [], has_more: false, next_page: null }));

    const resolved = await resolveBundledSkillIds();

    expect(resolved).toHaveLength(SKILL_BUNDLES.length);
    for (const r of resolved) {
      expect(r.skillId).toBeNull();
      expect(r.latestVersion).toBeNull();
    }
  });
});
