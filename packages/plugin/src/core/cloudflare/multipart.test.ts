import { describe, expect, it } from 'vitest';

import { buildMultipartBody, generateBoundary } from './multipart';

describe('buildMultipartBody', () => {
  it('単一 part: 期待 RFC 形式で出力', () => {
    const body = buildMultipartBody(
      [{ name: 'metadata', contentType: 'application/json', content: '{"main":"x"}' }],
      'B',
    );
    expect(body).toBe(
      '--B\r\n' +
        'Content-Disposition: form-data; name="metadata"\r\n' +
        'Content-Type: application/json\r\n' +
        '\r\n' +
        '{"main":"x"}\r\n' +
        '--B--\r\n',
    );
  });

  it('ファイル part: filename 付き', () => {
    const body = buildMultipartBody(
      [{ name: 'worker.js', filename: 'worker.js', contentType: 'application/javascript+module', content: 'export default {};' }],
      'B',
    );
    expect(body).toContain('Content-Disposition: form-data; name="worker.js"; filename="worker.js"');
    expect(body).toContain('Content-Type: application/javascript+module');
    expect(body).toContain('export default {};');
  });

  it('複数 part を順序通り出力', () => {
    const body = buildMultipartBody(
      [
        { name: 'metadata', contentType: 'application/json', content: '{}' },
        { name: 'worker.js', filename: 'worker.js', contentType: 'application/javascript+module', content: 'CODE' },
      ],
      'B',
    );
    const metadataIdx = body.indexOf('name="metadata"');
    const workerIdx = body.indexOf('name="worker.js"');
    expect(metadataIdx).toBeLessThan(workerIdx);
    expect(body.endsWith('--B--\r\n')).toBe(true);
  });

  it('Content-Type 省略時は出力されない', () => {
    const body = buildMultipartBody([{ name: 'x', content: 'y' }], 'B');
    expect(body).not.toContain('Content-Type');
  });
});

describe('generateBoundary', () => {
  it('プレフィクス付き 16 進文字列', () => {
    const b = generateBoundary();
    expect(b).toMatch(/^cowork-agent-[0-9a-f]{32}$/);
  });

  it('連続呼出で異なる値を返す', () => {
    expect(generateBoundary()).not.toBe(generateBoundary());
  });
});
