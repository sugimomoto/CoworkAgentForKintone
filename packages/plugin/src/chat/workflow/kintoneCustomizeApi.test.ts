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
  it('chatStore.workflowHistory に snapshot が無ければ throw', async () => {
    const { deps } = makeDeps();
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_no_snap', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await expect(cb.rollback()).rejects.toThrow(/ロールバック履歴が見つかりません/);
  });

  it('snapshot から PUT customize → POST deploy で復元', async () => {
    const snapshotCustomize: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [{ type: 'URL', url: 'https://cdn.example.com/old.js' }], css: [] },
      mobile: { js: [], css: [] },
      revision: '5',
    };
    useChatStore.getState().saveWorkflowSnapshot(
      'art_1',
      JSON.stringify({ customize: snapshotCustomize, capturedAt: Date.now() }),
    );
    const { apiFn, deps } = makeDeps();
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await cb.rollback();

    const putCall = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/customize.json' && c[1] === 'PUT',
    );
    expect(putCall).toBeTruthy();
    const body = putCall![2] as { desktop: { js: unknown[] } };
    expect(body.desktop.js).toEqual([{ type: 'URL', url: 'https://cdn.example.com/old.js' }]);

    // rollback 後 snapshot がクリアされる
    expect(useChatStore.getState().workflowHistory.has('art_1')).toBe(false);
  });

  it('rollback の PUT body は snapshot の古い revision を含めない (= 楽観ロック skip)', async () => {
    const snapshotCustomize: CustomizeJsonResponse = {
      scope: 'ALL',
      desktop: { js: [], css: [] },
      mobile: { js: [], css: [] },
      revision: '5', // apply 直前の古い revision
    };
    useChatStore.getState().saveWorkflowSnapshot(
      'art_1',
      JSON.stringify({ customize: snapshotCustomize, capturedAt: Date.now() }),
    );
    const { apiFn, deps } = makeDeps();
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId: 'art_1', bundle: SAMPLE_BUNDLE },
      deps,
    );
    await cb.rollback();

    const putCall = apiFn.mock.calls.find(
      (c) => c[0] === '/k/v1/preview/app/customize.json' && c[1] === 'PUT',
    );
    const body = putCall![2] as { revision?: string };
    // rollback の PUT には revision を含めない (skip = '-1' 相当)
    expect(body.revision).toBeUndefined();
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
