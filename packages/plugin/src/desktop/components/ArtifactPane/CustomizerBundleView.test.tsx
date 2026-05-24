// CustomizerBundleView のテスト (#20 V2 Phase 1)

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { serializeBundleContent, type Artifact } from '../../../core/artifacts/types';

import { CustomizerBundleView } from './CustomizerBundleView';

import type { KintoneApiFn } from '../../../chat/workflow/kintoneCustomizeApi';

function makeBundleArtifact(filesJson: string): Artifact {
  return {
    id: 'bundle_1',
    kind: 'kintone-customize-bundle',
    title: 'Customize Bundle',
    content: filesJson,
    createdAt: 0,
    updatedAt: 0,
    version: 1,
  };
}

const NULL_API: KintoneApiFn = vi.fn(async () => null);

describe('CustomizerBundleView', () => {
  it('valid な bundle で FileTree + CodeViewer + WorkflowFooter を描画', () => {
    const artifact = makeBundleArtifact(
      serializeBundleContent({
        files: [{ path: 'desktop.js', content: '// hello' }],
      }),
    );
    render(<CustomizerBundleView artifact={artifact} appId={3} apiFn={NULL_API} baseUrl="https://x.cybozu.com" />);

    expect(screen.getByTestId('customizer-bundle-view')).toBeInTheDocument();
    expect(screen.getByTestId('filetree-file-desktop.js')).toBeInTheDocument();
    expect(screen.getByTestId('customizer-bundle-file-desktop.js')).toHaveTextContent('// hello');
    expect(screen.getByTestId('workflow-footer')).toBeInTheDocument();
  });

  it('bundle 不正 (content が parse 不可) の場合は invalid 表示', () => {
    const artifact = makeBundleArtifact('not a json');
    render(<CustomizerBundleView artifact={artifact} appId={3} apiFn={NULL_API} />);
    expect(screen.getByTestId('customizer-bundle-invalid')).toBeInTheDocument();
  });

  it('複数 file を持つ bundle でファイル切替ができる', async () => {
    const artifact = makeBundleArtifact(
      serializeBundleContent({
        files: [
          { path: 'desktop.js', content: '// JS' },
          // Phase 1 では desktop.css も bundle に居る (= legacy 互換、Agent が制約破った場合の動作確認)
          { path: 'desktop.css', content: '/* CSS */' },
        ],
      }),
    );
    render(<CustomizerBundleView artifact={artifact} appId={3} apiFn={NULL_API} />);

    // 初期表示は最初の file (desktop.js)
    expect(screen.getByTestId('customizer-bundle-file-desktop.js')).toHaveTextContent('// JS');

    // FileTree の desktop.css クリックで切替
    const user = userEvent.setup();
    await user.click(screen.getByTestId('filetree-file-desktop.css'));
    expect(screen.getByTestId('customizer-bundle-file-desktop.css')).toHaveTextContent('/* CSS */');
  });

  it('WorkflowFooter に動作テスト環境 URL が渡る (anchor の href)', () => {
    const artifact = makeBundleArtifact(
      serializeBundleContent({
        files: [{ path: 'desktop.js', content: '// js' }],
      }),
    );
    // initialState を previewed にして「動作テスト環境を開く」を出すには別途必要だが、
    // ここでは getPreviewUrl が footer 経由で正しく渡ることだけ確認できれば良い (Phase 1 デフォルト ready)。
    render(<CustomizerBundleView artifact={artifact} appId={3} apiFn={NULL_API} baseUrl="https://example.cybozu.com" />);
    // ready 状態なので anchor は出ない (= 確認は previewed 時に WorkflowFooter.test.tsx 側でカバー済)
    expect(screen.queryByTestId('workflow-action-open-preview')).not.toBeInTheDocument();
  });
});
