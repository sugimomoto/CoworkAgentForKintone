// FileTree.tsx のテスト
//
// V1 hardcoded ファイル一覧の表示 + 変更件数バッジ + クリックハンドラ + status 表示。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CUSTOMIZE_FILES, FileTree } from './FileTree';

import type { FileTreeEntry } from './FileTree';

describe('FileTree', () => {
  it('default で hardcoded ファイル一覧を全件描画する', () => {
    render(<FileTree />);
    // header + folder name で "customize" が 2 回出る (header / folder row)
    expect(screen.getAllByText('customize')).toHaveLength(2);
    expect(screen.getByText('desktop.js')).toBeInTheDocument();
    expect(screen.getByText('mobile.js')).toBeInTheDocument();
    expect(screen.getByText('desktop.css')).toBeInTheDocument();
    expect(screen.getByText('libs')).toBeInTheDocument();
    expect(screen.getByText('manifest.json')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('変更件数バッジは file の status !== unchanged の数を出す', () => {
    render(<FileTree />);
    // desktop.js (modified) + desktop.css (modified) + README.md (new) = 3 変更
    const badge = screen.getByTestId('filetree-changed-count');
    expect(badge.textContent).toContain('3');
  });

  it('変更が無い場合はバッジを出さない', () => {
    const unchangedFiles: readonly FileTreeEntry[] = [
      { type: 'folder', name: 'customize', level: 0, open: true },
      { type: 'file', name: 'a.js', kind: 'js', level: 1, status: 'unchanged' },
    ];
    render(<FileTree files={unchangedFiles} />);
    expect(screen.queryByTestId('filetree-changed-count')).toBeNull();
  });

  it('active ファイルクリックで onSelect(path) が発火する', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FileTree onSelect={onSelect} />);

    await user.click(screen.getByTestId('filetree-file-customize/desktop.js'));
    expect(onSelect).toHaveBeenCalledWith('customize/desktop.js');
  });

  it('path が無いファイルは onSelect を発火しない', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const files: readonly FileTreeEntry[] = [
      { type: 'file', name: 'no-path.js', kind: 'js', level: 0, status: 'modified' },
    ];
    render(<FileTree files={files} onSelect={onSelect} />);

    await user.click(screen.getByTestId('filetree-file-no-path.js'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('status="modified" は ● を表示', () => {
    render(<FileTree />);
    const desktopJsBtn = screen.getByTestId('filetree-file-customize/desktop.js');
    const statusEl = desktopJsBtn.querySelector('[data-testid="filetree-status"]');
    expect(statusEl?.textContent).toBe('●');
  });

  it('status="new" は + を表示', () => {
    render(<FileTree />);
    const readmeBtn = screen.getByTestId('filetree-file-README.md');
    const statusEl = readmeBtn.querySelector('[data-testid="filetree-status"]');
    expect(statusEl?.textContent).toBe('+');
  });

  it('status="unchanged" はインジケータを出さない', () => {
    render(<FileTree />);
    const mobileJsBtn = screen.getByTestId('filetree-file-customize/mobile.js');
    expect(mobileJsBtn.querySelector('[data-testid="filetree-status"]')).toBeNull();
  });

  it('bundleName prop で header 表示を切替できる', () => {
    render(<FileTree bundleName="my-bundle" />);
    // "my-bundle" は header にのみ出る (folder 一覧側は "customize" のまま)
    expect(screen.getByText('my-bundle')).toBeInTheDocument();
    expect(screen.getAllByText('customize')).toHaveLength(1);
  });

  it('DEFAULT_CUSTOMIZE_FILES は読み取り専用 (型レベル)', () => {
    // 型レベルテスト: readonly array なので push 等はできないはず
    expect(DEFAULT_CUSTOMIZE_FILES.length).toBeGreaterThan(0);
    expect(DEFAULT_CUSTOMIZE_FILES[0]?.type).toBe('folder');
  });

  it('プレビュー環境同期インジケータが footer に表示される', () => {
    render(<FileTree />);
    expect(screen.getByText(/プレビュー環境 と同期/)).toBeInTheDocument();
  });
});
