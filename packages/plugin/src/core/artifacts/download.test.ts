import { describe, it, expect } from 'vitest';

import { buildDownloadFileName, extensionFor, mimeFor } from './download';

describe('extensionFor', () => {
  it('markdown → md', () => {
    expect(extensionFor('markdown')).toBe('md');
  });
  it('json → json', () => {
    expect(extensionFor('json')).toBe('json');
  });
  it('react → jsx', () => {
    expect(extensionFor('react')).toBe('jsx');
  });
  it('code + language=python → py', () => {
    expect(extensionFor('code', 'python')).toBe('py');
  });
  it('code + language=TypeScript (大文字混じり) → ts', () => {
    expect(extensionFor('code', 'TypeScript')).toBe('ts');
  });
  it('code + 未知の language → txt fallback', () => {
    expect(extensionFor('code', 'lolcode')).toBe('txt');
  });
  it('code + language なし → txt', () => {
    expect(extensionFor('code')).toBe('txt');
  });
});

describe('mimeFor', () => {
  it('markdown → text/markdown', () => {
    expect(mimeFor('markdown')).toBe('text/markdown');
  });
  it('json → application/json', () => {
    expect(mimeFor('json')).toBe('application/json');
  });
});

describe('buildDownloadFileName', () => {
  it('title を使い拡張子を付与する', () => {
    expect(
      buildDownloadFileName({
        kind: 'markdown',
        title: '2026 売上レポート',
        id: 'sales',
        content: '',
      }),
    ).toBe('2026 売上レポート.md');
  });
  it('title が空なら id を fallback として使う', () => {
    expect(
      buildDownloadFileName({ kind: 'json', title: '', id: 'a-1', content: '' }),
    ).toBe('a-1.json');
  });
  it('OS で禁止された文字をアンダースコアに置換する', () => {
    expect(
      buildDownloadFileName({
        kind: 'code',
        language: 'js',
        title: 'foo/bar:baz?',
        id: 'x',
        content: '',
      }),
    ).toBe('foo_bar_baz_.js');
  });
});

