// kintoneCustomizeApi のテスト
//
// preview / apply / rollback の各 callback が:
// - 正しい kintone API endpoint を呼ぶ
// - snapshot を chatStore に保存・取得する
// - 403 エラーをそのまま伝播する

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { makeKintoneCustomizeWorkflow } from './kintoneCustomizeApi';

import type { KintoneApiFn } from './kintoneCustomizeApi';

beforeEach(() => {
  useChatStore.getState().reset();
  // artifact を 1 つ登録 (apply / rollback で content を読む)
  useChatStore.getState().upsertArtifact({
    id: 'art_1',
    kind: 'code',
    title: 'カスタマイズ JS',
    language: 'javascript',
    content: '// generated JS',
  });
});

describe('makeKintoneCustomizeWorkflow.apply', () => {
  it('既存 customize.json を GET → snapshot → PUT → deploy を順に呼ぶ', async () => {
    const apiFn = vi.fn(async (url: string, method: string) => {
      if (url === '/k/v1/preview/app/customize.json' && method === 'GET') {
        return {
          scope: 'ALL',
          desktop: { js: [{ type: 'URL', url: 'https://old.js' }], css: [] },
          mobile: { js: [] },
        };
      }
      return {};
    });
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await cb.apply();

    // GET → PUT → POST(deploy)
    const calls = apiFn.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([
      '/k/v1/preview/app/customize.json',
      'GET',
      { app: 42 },
    ]);
    expect(calls[1]?.[1]).toBe('PUT');
    expect(calls[1]?.[0]).toBe('/k/v1/preview/app/customize.json');
    expect(calls[2]).toEqual([
      '/k/v1/preview/app/deploy.json',
      'POST',
      { apps: [{ app: 42 }] },
    ]);
  });

  it('apply で snapshot が chatStore.workflowHistory に保存される', async () => {
    const apiFn = vi.fn(async (url: string, method: string) => {
      if (url === '/k/v1/preview/app/customize.json' && method === 'GET') {
        return {
          scope: 'ALL',
          desktop: { js: [{ type: 'URL', url: 'https://old.js' }], css: [] },
          mobile: { js: [] },
        };
      }
      return {};
    });
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await cb.apply();

    const snapshot = useChatStore.getState().workflowHistory.get('art_1');
    expect(snapshot).toBeDefined();
    const parsed = JSON.parse(snapshot!) as { desktop: { js: Array<{ url: string }> } };
    expect(parsed.desktop.js[0]?.url).toBe('https://old.js');
  });

  it('artifact が無いとエラー', async () => {
    const apiFn = vi.fn();
    const cb = makeKintoneCustomizeWorkflow('art_unknown', {
      apiFn: apiFn as KintoneApiFn,
      appId: 42,
    });
    await expect(cb.apply()).rejects.toThrow(/見つかりません/);
  });

  it('apiFn が 403 で reject すると伝播する (権限不足エラー)', async () => {
    const apiFn = vi.fn().mockRejectedValue(new Error('403 Forbidden'));
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await expect(cb.apply()).rejects.toThrow('403 Forbidden');
  });
});

describe('makeKintoneCustomizeWorkflow.rollback', () => {
  it('snapshot から旧設定を PUT → deploy する', async () => {
    // snapshot を事前に登録
    useChatStore.getState().saveWorkflowSnapshot(
      'art_1',
      JSON.stringify({
        scope: 'ALL',
        desktop: { js: [{ type: 'URL', url: 'https://old.js' }], css: [] },
        mobile: { js: [] },
      }),
    );
    const apiFn = vi.fn(async () => ({}));
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await cb.rollback();

    const calls = apiFn.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1]).toBe('PUT');
    expect(calls[0]?.[0]).toBe('/k/v1/preview/app/customize.json');
    const putBody = calls[0]?.[2] as { app: number; desktop: { js: Array<{ url: string }> } };
    expect(putBody.app).toBe(42);
    expect(putBody.desktop.js[0]?.url).toBe('https://old.js');
    expect(calls[1]?.[1]).toBe('POST');
    expect(calls[1]?.[0]).toBe('/k/v1/preview/app/deploy.json');
  });

  it('rollback 完了後、snapshot がクリアされる', async () => {
    useChatStore.getState().saveWorkflowSnapshot(
      'art_1',
      JSON.stringify({ desktop: { js: [], css: [] }, mobile: { js: [] }, scope: 'ALL' }),
    );
    const apiFn = vi.fn(async () => ({}));
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await cb.rollback();

    expect(useChatStore.getState().workflowHistory.has('art_1')).toBe(false);
  });

  it('snapshot が無いとエラー (Plugin リロードで失われたケース)', async () => {
    const apiFn = vi.fn();
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await expect(cb.rollback()).rejects.toThrow(/スナップショットが見つかりません/);
  });
});

describe('makeKintoneCustomizeWorkflow.preview', () => {
  it('runSandbox が注入されていれば、artifact.content を渡して呼ぶ', async () => {
    const apiFn = vi.fn();
    const runSandbox = vi.fn().mockResolvedValue(undefined);
    const cb = makeKintoneCustomizeWorkflow('art_1', {
      apiFn: apiFn as KintoneApiFn,
      appId: 42,
      runSandbox,
    });
    await cb.preview();
    expect(runSandbox).toHaveBeenCalledWith('// generated JS');
  });

  it('runSandbox が未指定なら no-op (UI 検証用)', async () => {
    const apiFn = vi.fn();
    const cb = makeKintoneCustomizeWorkflow('art_1', { apiFn: apiFn as KintoneApiFn, appId: 42 });
    await expect(cb.preview()).resolves.toBeUndefined();
    expect(apiFn).not.toHaveBeenCalled();
  });
});
