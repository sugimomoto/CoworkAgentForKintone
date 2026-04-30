import { describe, it, expect } from 'vitest';

import { EXTENSION_TO_KIND, FILE_LIMITS, SUPPORTED_EXTENSIONS } from './types';

describe('EXTENSION_TO_KIND', () => {
  it('10 種の拡張子をサポートする (txt/md/json/csv/pdf/png/jpg/jpeg/gif/webp)', () => {
    expect(Object.keys(EXTENSION_TO_KIND).sort()).toEqual(
      ['csv', 'gif', 'jpeg', 'jpg', 'json', 'md', 'pdf', 'png', 'txt', 'webp'].sort(),
    );
  });

  it.each([
    ['txt', 'text', 'text/plain'],
    ['md', 'text', 'text/markdown'],
    ['json', 'text', 'application/json'],
    ['csv', 'text', 'text/csv'],
    ['pdf', 'document', 'application/pdf'],
    ['png', 'image', 'image/png'],
    ['jpg', 'image', 'image/jpeg'],
    ['jpeg', 'image', 'image/jpeg'],
    ['gif', 'image', 'image/gif'],
    ['webp', 'image', 'image/webp'],
  ])('%s → kind=%s, mime=%s', (ext, kind, mime) => {
    expect(EXTENSION_TO_KIND[ext]).toEqual({ kind, mime });
  });
});

describe('SUPPORTED_EXTENSIONS', () => {
  it('EXTENSION_TO_KIND の key と一致する', () => {
    expect(SUPPORTED_EXTENSIONS.slice().sort()).toEqual(
      Object.keys(EXTENSION_TO_KIND).sort(),
    );
  });
});

describe('FILE_LIMITS', () => {
  it('1 ファイル 10 MB / 1 メッセージ 10 件 / 警告閾値 30 MB', () => {
    expect(FILE_LIMITS.perFileBytes).toBe(10 * 1024 * 1024);
    expect(FILE_LIMITS.maxFilesPerMessage).toBe(10);
    expect(FILE_LIMITS.warnTotalBytes).toBe(30 * 1024 * 1024);
  });
});
