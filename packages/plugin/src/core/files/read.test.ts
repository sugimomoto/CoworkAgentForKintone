import { describe, it, expect } from 'vitest';

import { readAsBase64, readAsText } from './read';

describe('readAsText', () => {
  it('UTF-8 でデコードする', async () => {
    const blob = new Blob(['Hello, 世界'], { type: 'text/plain' });
    expect(await readAsText(blob as unknown as File)).toBe('Hello, 世界');
  });

  it('CRLF / LF を保持する', async () => {
    const blob = new Blob(['a\r\nb\nc'], { type: 'text/plain' });
    expect(await readAsText(blob as unknown as File)).toBe('a\r\nb\nc');
  });

  it('空 Blob は空文字列を返す', async () => {
    const blob = new Blob([], { type: 'text/plain' });
    expect(await readAsText(blob as unknown as File)).toBe('');
  });
});

describe('readAsBase64', () => {
  it('既知バイト列 (PNG signature の先頭 4 byte) を base64 化できる', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const blob = new Blob([bytes], { type: 'image/png' });
    // btoa('\x89PNG') === 'iVBORw==' が期待値
    expect(await readAsBase64(blob as unknown as File)).toBe('iVBORw==');
  });

  it('data: prefix を含めずに返す', async () => {
    const blob = new Blob(['x'], { type: 'text/plain' });
    const result = await readAsBase64(blob as unknown as File);
    expect(result).not.toContain('data:');
    expect(result).not.toContain(',');
    // 'x' (0x78) → 'eA=='
    expect(result).toBe('eA==');
  });

  it('空 Blob は空文字列を返す', async () => {
    const blob = new Blob([], { type: 'application/pdf' });
    expect(await readAsBase64(blob as unknown as File)).toBe('');
  });
});
