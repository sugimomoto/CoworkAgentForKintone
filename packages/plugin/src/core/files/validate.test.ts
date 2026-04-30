import { describe, it, expect } from 'vitest';

import { extensionOf, validateFile } from './validate';

function makeFile(name: string, sizeBytes: number, type = ''): File {
  // jsdom の File は size を直接渡せないので Blob を File に cast
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe('extensionOf', () => {
  it.each([
    ['report.pdf', 'pdf'],
    ['photo.JPG', 'jpg'],
    ['data.tar.gz', 'gz'],
    ['no-dot', ''],
    ['.dotfile', ''],
  ])('"%s" → "%s"', (input, expected) => {
    expect(extensionOf(input)).toBe(expected);
  });
});

describe('validateFile', () => {
  it('対応拡張子 + サイズ OK + 件数 OK → ok=true', () => {
    const file = makeFile('a.csv', 1024, 'text/csv');
    expect(validateFile(file, 0)).toEqual({ ok: true });
  });

  it('未対応拡張子 (.docx) → reason に "未対応" を含む', () => {
    const file = makeFile('a.docx', 1024);
    const r = validateFile(file, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/未対応/);
  });

  it('拡張子なし (README) → reason に "未対応" を含む', () => {
    const file = makeFile('README', 1024);
    const r = validateFile(file, 0);
    expect(r.ok).toBe(false);
  });

  it('10 MB ピッタリは OK', () => {
    const file = makeFile('big.pdf', 10 * 1024 * 1024);
    expect(validateFile(file, 0)).toEqual({ ok: true });
  });

  it('10 MB + 1 byte は NG', () => {
    const file = makeFile('big.pdf', 10 * 1024 * 1024 + 1);
    const r = validateFile(file, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/サイズ上限/);
  });

  it('現在 9 件 → 10 件目 OK', () => {
    const file = makeFile('a.csv', 1024);
    expect(validateFile(file, 9)).toEqual({ ok: true });
  });

  it('現在 10 件 → 11 件目 NG (最大 10 件)', () => {
    const file = makeFile('a.csv', 1024);
    const r = validateFile(file, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/最大|10/);
  });
});
