// kintoneCustomizeApi のテスト (#20 V2 Phase 1)
//
// preview / apply / rollback / cancel の各 callback が:
// - 正しい kintone API endpoint を呼ぶ
// - bundle.files を file.json に upload して fileKey を取得
// - mergeCustomize で既存 entry を保持しつつ FILE entry を置換/追加
// - apply 直前に旧 customize を chatStore に snapshot 保存
// - rollback は snapshot を PUT + deploy で復元
// - cancel は revert: true で deploy.json POST
// - 403 + scope 文言で OAuthScopeError throw

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import {
  defaultFileUpload,
  getPreviewUrl,
  makeKintoneCustomizeWorkflow,
  mergeCustomize,
  unmergeCustomize,
} from './kintoneCustomizeApi';
import { OAuthScopeError } from './OAuthScopeError';

import type {
  CustomizeJsonResponse,
  FileUploadFn,
  KintoneApiFn,
} from './kintoneCustomizeApi';
import type { CustomizeBundleContent } from '../../core/artifacts/types';

beforeEach(() => {
  useChatStore.getState().reset();
});

const SAMPLE_BUNDLE: CustomizeBundleContent = {
  files: [{ path: 'desktop.js', content: '// generated JS' }],
};

const EMPTY_CUSTOMIZE: CustomizeJsonResponse = {
  scope: 'ALL',
  desktop: { js: [], css: [] },
  mobile: { js: [], css: [] },
  revision: '10',
};

function makeDeps(overrides: Partial<{
  apiFn: KintoneApiFn;
  uploadFile: FileUploadFn;
}> = {}): {
  apiFn: ReturnType<typeof vi.fn>;
  uploadFile: ReturnType<typeof vi.fn>;
  deps: { appId: number; apiFn: KintoneApiFn; uploadFile: FileUploadFn; pollIntervalMs: number };
} {
  const apiFn = vi.fn(async (url: string, method: string) => {
    if (url.endsWith('/customize.json') && method === 'GET') {
      return EMPTY_CUSTOMIZE;
    }
    if (url.endsWith('/customize.json') && method === 'PUT') {
      return { revision: '11' };
    }
    if (url.endsWith('/deploy.json') && method === 'POST') {
      return {};
    }
    if (url.endsWith('/deploy.json') && method === 'GET') {
      return { apps: [{ app: '3', status: 'SUCCESS' }] };
    }
    return null;
  });
  const uploadFile = vi.fn(async (name: string) => `uuid-${name}`);
  if (overrides.apiFn) apiFn.mockImplementation(overrides.apiFn);
  if (overrides.uploadFile) uploadFile.mockImplementation(overrides.uploadFile);
  return {
    apiFn,
    uploadFile,
    deps: { appId: 3, apiFn, uploadFile, pollIntervalMs: 0 },
  };
}

describe('makeKintoneCustomizeWorkflow.preview', () => {
  it('file.json upload → GET customize → PUT customize (deploy しない)', async () => {
    const { apiFn, uploadFile, deps } = makeDeps();
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await cb.preview();

    expect(uploadFile).toHaveBeenCalledWith('cowork-agent-desktop.js', '// generated JS');
    const getCall = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/customize.json' && c[1] === 'GET',
    );
    const putCall = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/customize.json' && c[1] === 'PUT',
    );
    const deployCall = apiFn.mock.calls.find((c) => String(c[0]).includes('/deploy.json'));
    expect(getCall).toBeTruthy();
    expect(putCall).toBeTruthy();
    expect(deployCall).toBeUndefined();
  });
});

describe('makeKintoneCustomizeWorkflow.apply', () => {
  it('snapshot → file.json upload → PUT customize → POST deploy → poll SUCCESS', async () => {
    const { apiFn, deps } = makeDeps();
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await cb.apply();

    // snapshot が chatStore に保存されている
    const snap = useChatStore.getState().workflowHistory.get('art_1');
    expect(snap).toBeTruthy();
    const parsed = JSON.parse(snap as string);
    expect(parsed.customize.scope).toBe('ALL');

    // POST deploy.json が 1 回呼ばれる
    const deployPostCalls = apiFn.mock.calls.filter(
      (c) => c[0] === '/k/v1/preview/app/deploy.json' && c[1] === 'POST',
    );
    expect(deployPostCalls).toHaveLength(1);
  });

  it('403 + scope 文言で OAuthScopeError を throw', async () => {
    const { deps } = makeDeps({
      apiFn: vi.fn(async (url: string, method: string) => {
        if (url.endsWith('/customize.json') && method === 'GET') {
          const err = new Error(
            'HTTP 403: 認証エラー — k:app_settings:write スコープが不足しています',
          );
          (err as { responseBody?: string }).responseBody = err.message;
          throw err;
        }
        return null;
      }),
    });
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await expect(cb.apply()).rejects.toBeInstanceOf(OAuthScopeError);
  });
});

describe('makeKintoneCustomizeWorkflow.rollback', () => {
  it('現状の customize.json を GET → cowork-agent-* FILE entry を除去 → PUT + deploy', async () => {
    // 現在の preview には cowork-agent-* が適用済 + admin 手動登録の URL も混在
    const apiFn = vi.fn(async (url: string, method: string) => {
      if (url.endsWith('/customize.json') && method === 'GET') {
        return {
          scope: 'ALL',
          desktop: {
            js: [
              { type: 'URL', url: 'https://cdn.example.com/admin-manual.js' },
              {
                type: 'FILE',
                file: { fileKey: 'internal-49', name: 'cowork-agent-desktop.js' },
              },
            ],
            css: [],
          },
          mobile: { js: [], css: [] },
          revision: '10',
        };
      }
      if (url.endsWith('/customize.json') && method === 'PUT') {
        return { revision: '11' };
      }
      if (url.endsWith('/deploy.json') && method === 'GET') {
        return { apps: [{ app: '3', status: 'SUCCESS' }] };
      }
      return {};
    });
    const uploadFile = vi.fn();
    const deps = { appId: 3, apiFn, uploadFile, pollIntervalMs: 0 };
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE }, // bundle = desktop.js
      deps,
    );
    await cb.rollback();

    const putCall = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/customize.json' && c[1] === 'PUT',
    );
    expect(putCall).toBeTruthy();
    const body = putCall![2] as { desktop: { js: unknown[] }; revision?: string };
    // cowork-agent-* は除去、admin の URL は保持
    expect(body.desktop.js).toEqual([
      { type: 'URL', url: 'https://cdn.example.com/admin-manual.js' },
    ]);
    // revision skip (楽観ロックなし)
    expect(body.revision).toBeUndefined();
  });

  it('snapshot が無くても rollback は実行できる (Plugin リロード後でも OK)', async () => {
    // chatStore.workflowHistory は空のままでも、bundle.files の path 情報があれば rollback 可能
    const { apiFn, deps } = makeDeps();
    expect(useChatStore.getState().workflowHistory.size).toBe(0);
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'no_snapshot_art', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await expect(cb.rollback()).resolves.toBeUndefined();
    const putCall = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/customize.json' && c[1] === 'PUT',
    );
    expect(putCall).toBeTruthy();
  });
});

describe('makeKintoneCustomizeWorkflow.cancel', () => {
  it('POST deploy.json {revert: true} を呼ぶ', async () => {
    const { apiFn, deps } = makeDeps();
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await cb.cancel();
    const call = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/deploy.json' && c[1] === 'POST',
    );
    expect(call).toBeTruthy();
    expect(call![2]).toEqual({ apps: [{ app: 3 }], revert: true });
  });
});

describe('mergeCustomize', () => {
  const baseEntry = (name: string): { type: 'FILE'; file: { fileKey: string; name?: string } } => ({
    type: 'FILE',
    file: { fileKey: `existing-${name}`, name },
  });

  it('既存 URL タイプは保持される', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [{ type: 'URL', url: 'https://cdn.example.com/a.js' }], css: [] },
      mobile: { js: [], css: [] },
    };
    const merged = mergeCustomize(current, [{ path: 'desktop.js', fileKey: 'new-key' }]);
    expect(merged.desktop.js).toEqual([
      { type: 'URL', url: 'https://cdn.example.com/a.js' },
      { type: 'FILE', file: { fileKey: 'new-key' } },
    ]);
  });

  it('cowork-agent- 名前の既存 FILE entry は置換される', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [baseEntry('cowork-agent-desktop.js')], css: [] },
      mobile: { js: [], css: [] },
    };
    const merged = mergeCustomize(current, [{ path: 'desktop.js', fileKey: 'new-key' }]);
    expect(merged.desktop.js).toEqual([
      { type: 'FILE', file: { fileKey: 'new-key' } },
    ]);
  });

  it('bundle に該当 path が無い area は既存配列を保持', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [], css: [{ type: 'URL', url: 'https://cdn.example.com/x.css' }] },
      mobile: { js: [], css: [] },
    };
    const merged = mergeCustomize(current, [{ path: 'desktop.js', fileKey: 'new-key' }]);
    expect(merged.desktop.css).toEqual([{ type: 'URL', url: 'https://cdn.example.com/x.css' }]);
  });

  it('revision を保持する', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [], css: [] },
      mobile: { js: [], css: [] },
      revision: '42',
    };
    const merged = mergeCustomize(current, []);
    expect(merged.revision).toBe('42');
  });
});

describe('unmergeCustomize (#20 V2 Phase 1 rollback)', () => {
  it('bundle path 配下の cowork-agent-* FILE entry のみ除去、その他は保持', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: {
        js: [
          { type: 'URL', url: 'https://cdn.example.com/admin.js' },
          { type: 'FILE', file: { fileKey: 'kk1', name: 'cowork-agent-desktop.js' } },
          { type: 'FILE', file: { fileKey: 'kk2', name: 'admin-manual.js' } },
        ],
        css: [],
      },
      mobile: { js: [], css: [] },
      revision: '10',
    };
    const next = unmergeCustomize(current, [{ path: 'desktop.js' }]);
    expect(next.desktop.js).toEqual([
      { type: 'URL', url: 'https://cdn.example.com/admin.js' },
      { type: 'FILE', file: { fileKey: 'kk2', name: 'admin-manual.js' } },
    ]);
  });

  it('bundle に含まれない area (desktop.css 等) は触らない', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: {
        js: [],
        css: [{ type: 'FILE', file: { fileKey: 'kc1', name: 'cowork-agent-desktop.css' } }],
      },
      mobile: { js: [], css: [] },
    };
    // bundle に desktop.js のみ
    const next = unmergeCustomize(current, [{ path: 'desktop.js' }]);
    // desktop.css は bundle path に含まれないので保持される
    expect(next.desktop.css).toHaveLength(1);
  });

  it('revision は返り値に含めない (rollback で楽観ロック skip)', () => {
    const current: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [], css: [] },
      mobile: { js: [], css: [] },
      revision: '99',
    };
    const next = unmergeCustomize(current, []);
    expect(next.revision).toBeUndefined();
  });
});

describe('getPreviewUrl', () => {
  it('動作テスト環境 URL を組み立てる', () => {
    expect(getPreviewUrl(3, 'https://example.cybozu.com')).toBe(
      'https://example.cybozu.com/k/admin/preview/3/',
    );
  });
});

describe('defaultFileUpload', () => {
  it('kintone が未定義なら throw', async () => {
    // 注: 実機 (Plugin runtime) には kintone がある。vitest 環境では kintone 未定義
    await expect(defaultFileUpload('test.js', '// js')).rejects.toThrow(
      /kintone JavaScript API/,
    );
  });
});
