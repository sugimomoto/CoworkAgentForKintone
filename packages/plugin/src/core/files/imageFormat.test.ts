import { describe, it, expect } from 'vitest';

import { detectImageFormat } from './imageFormat';

function bytesToBase64(bytes: number[]): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

describe('detectImageFormat', () => {
  it('PNG マジックバイト → image/png', () => {
    const b64 = bytesToBase64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'supported', mime: 'image/png' });
  });

  it('JPEG マジックバイト → image/jpeg', () => {
    const b64 = bytesToBase64([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'supported', mime: 'image/jpeg' });
  });

  it('GIF87a → image/gif', () => {
    const b64 = bytesToBase64([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'supported', mime: 'image/gif' });
  });

  it('WebP (RIFF....WEBP) → image/webp', () => {
    const b64 = bytesToBase64([
      0x52, 0x49, 0x46, 0x46,    // RIFF
      0, 0, 0, 0,                // size (don't care)
      0x57, 0x45, 0x42, 0x50,    // WEBP
    ]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'supported', mime: 'image/webp' });
  });

  it('AVIF (....ftyp avif) → unsupported AVIF', () => {
    const b64 = bytesToBase64([
      0, 0, 0, 0x1c,             // box size
      0x66, 0x74, 0x79, 0x70,    // ftyp
      0x61, 0x76, 0x69, 0x66,    // avif
    ]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'unsupported', label: 'AVIF' });
  });

  it('AVIF mif1 brand も unsupported AVIF/HEIF 扱い', () => {
    const b64 = bytesToBase64([
      0, 0, 0, 0x1c,
      0x66, 0x74, 0x79, 0x70,    // ftyp
      0x6d, 0x69, 0x66, 0x31,    // mif1
    ]);
    const r = detectImageFormat(b64);
    expect(r.kind).toBe('unsupported');
  });

  it('HEIC → unsupported', () => {
    const b64 = bytesToBase64([
      0, 0, 0, 0x1c,
      0x66, 0x74, 0x79, 0x70,    // ftyp
      0x68, 0x65, 0x69, 0x63,    // heic
    ]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'unsupported', label: 'HEIC/HEIF' });
  });

  it('未知のバイト列 → unknown', () => {
    const b64 = bytesToBase64([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0, 0, 0, 0, 0, 0]);
    expect(detectImageFormat(b64)).toEqual({ kind: 'unknown' });
  });

  it('空文字列 → unknown', () => {
    expect(detectImageFormat('')).toEqual({ kind: 'unknown' });
  });
});
