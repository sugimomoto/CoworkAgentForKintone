// FileTree.tsx のテスト (#20 V2 Phase 1: 動的化版)
//
// - props で受け取った files を描画
// - 変更件数バッジ
// - クリックで onSelect(path) 発火
// - bundleFilesToTreeEntries で bundle.files から entry 構築

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FileTree, bundleFilesToTreeEntries } from './FileTree';

import type { FileTreeEntry } from './FileTree';

const SAMPLE_FILES: readonly FileTreeEntry[] = [
  { type: 'folder', name: 'customize', level: 0, open: true },
  {
    type: 'file',
    name: 'desktop.js',
    kind: 'js',
    level: 1,
    path: 'desktop.js',
    active: true,
    status: 'modified',
  },
  {
    type: 'file',
    name: 'desktop.css',
    kind: 'css',
    level: 1,
    path: 'desktop.css',
    status: 'modified',
  },
];

describe('FileTree', () => {
  it('files prop 未指定なら空状態 (folder / file 行なし、bundleName のみ表示)', () => {
    render(<FileTree />);
    // header の bundleName "customize" だけ表示 (default)
    expect(screen.getAllByText('customize')).toHaveLength(1);
  });

  it('files prop に渡したエントリを全て描画する', () => {
    render(<FileTree files={SAMPLE_FILES} />);
    // header + folder row で 'customize' が 2 回
    expect(screen.getAllByText('customize')).toHaveLength(2);
    expect(screen.getByText('desktop.js')).toBeInTheDocument();
    expect(screen.getByText('desktop.css')).toBeInTheDocument();
  });

  it('変更件数バッジは status !== unchanged の数を出す', () => {
    render(<FileTree files={SAMPLE_FILES} />);
    // desktop.js + desktop.css = 2 変更
    const badge = screen.getByTestId('filetree-changed-count');
    expect(badge.textContent).toContain('2');
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
    render(<FileTree files={SAMPLE_FILES} onSelect={onSelect} />);

    await user.click(screen.getByTestId('filetree-file-desktop.js'));
    expect(onSelect).toHaveBeenCalledWith('desktop.js');
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
    render(<FileTree files={SAMPLE_FILES} />);
    const btn = screen.getByTestId('filetree-file-desktop.js');
    const statusEl = btn.querySelector('[data-testid="filetree-status"]');
    expect(statusEl?.textContent).toBe('●');
  });

  it('status="new" は + を表示', () => {
    const files: readonly FileTreeEntry[] = [
      { type: 'file', name: 'fresh.js', kind: 'js', level: 0, path: 'fresh.js', status: 'new' },
    ];
    render(<FileTree files={files} />);
    const btn = screen.getByTestId('filetree-file-fresh.js');
    const statusEl = btn.querySelector('[data-testid="filetree-status"]');
    expect(statusEl?.textContent).toBe('+');
  });

  it('status="unchanged" はインジケータを出さない', () => {
    const files: readonly FileTreeEntry[] = [
      { type: 'file', name: 'idle.js', kind: 'js', level: 0, path: 'idle.js', status: 'unchanged' },
    ];
    render(<FileTree files={files} />);
    const btn = screen.getByTestId('filetree-file-idle.js');
    expect(btn.querySelector('[data-testid="filetree-status"]')).toBeNull();
  });

  it('bundleName prop で header 表示を切替できる', () => {
    render(<FileTree files={SAMPLE_FILES} bundleName="my-bundle" />);
    expect(screen.getByText('my-bundle')).toBeInTheDocument();
    expect(screen.getAllByText('customize')).toHaveLength(1); // folder 行のみ
  });

  it('プレビュー環境同期インジケータが footer に表示される', () => {
    render(<FileTree files={SAMPLE_FILES} />);
    expect(screen.getByText(/プレビュー環境 と同期/)).toBeInTheDocument();
  });
});

describe('bundleFilesToTreeEntries (#20 V2 Phase 1)', () => {
  it('files から folder + file entry を構築する', () => {
    const entries = bundleFilesToTreeEntries(
      [
        { path: 'desktop.js', content: 'A' },
        { path: 'desktop.css', content: 'B' },
      ],
      'desktop.js',
    );
    expect(entries[0]).toMatchObject({ type: 'folder', name: 'customize', level: 0 });
    expect(entries[1]).toMatchObject({
      type: 'file',
      name: 'desktop.js',
      kind: 'js',
      path: 'desktop.js',
      active: true,
      status: 'modified',
    });
    expect(entries[2]).toMatchObject({
      type: 'file',
      name: 'desktop.css',
      kind: 'css',
      path: 'desktop.css',
      active: false,
    });
  });

  it('activePath null なら全 file が active=false', () => {
    const entries = bundleFilesToTreeEntries(
      [{ path: 'desktop.js', content: 'A' }],
      null,
    );
    const fileEntry = entries.find((e) => e.type === 'file');
    expect(fileEntry?.active).toBe(false);
  });

  it('files が空でも folder entry のみで返す', () => {
    const entries = bundleFilesToTreeEntries([], null);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe('folder');
  });

  it('path の拡張子から kind を判別 (.js→js, .css→css, .json→json, それ以外→md)', () => {
    const entries = bundleFilesToTreeEntries(
      [
        { path: 'mobile.js', content: '' },
        { path: 'mobile.css', content: '' },
      ],
      null,
    );
    expect(entries.find((e) => e.path === 'mobile.js')?.kind).toBe('js');
    expect(entries.find((e) => e.path === 'mobile.css')?.kind).toBe('css');
  });
});
