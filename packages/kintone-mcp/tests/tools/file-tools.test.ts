// kintone-upload-file / kintone-download-file の統合テスト。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadFile } from '../../src/tools/download-file';
import { uploadFile } from '../../src/tools/upload-file';

import { TEST_CREDS as CREDS, jsonResponse } from './_helpers';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const HELLO_BASE64 = 'aGVsbG8='; // 'hello'

describe('kintone-upload-file', () => {
  it('POST /k/v1/file.json + multipart body + Authorization Bearer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fileKey: 'fk-123' }));

    const result = await uploadFile.callback(
      { filename: 'hello.txt', content: HELLO_BASE64, contentType: 'text/plain' },
      { creds: CREDS },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://tenant.cybozu.com/k/v1/file.json');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer oauth-access-token');
    // FormData 利用時、明示的に Content-Type は付けない (fetch が自動)
    expect(headers['Content-Type']).toBeUndefined();

    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    const file = form.get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('hello.txt');
    expect((file as Blob).type).toBe('text/plain');
    expect(await (file as Blob).text()).toBe('hello');

    expect(result.structuredContent).toEqual({ fileKey: 'fk-123' });
  });

  it('contentType 未指定でもアップロードできる', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fileKey: 'fk-1' }));

    await uploadFile.callback({ filename: 'a.bin', content: HELLO_BASE64 }, { creds: CREDS });

    const [, init] = fetchMock.mock.calls[0]!;
    const form = init.body as FormData;
    const file = form.get('file') as Blob;
    expect(file).toBeInstanceOf(Blob);
    // Blob({ type: undefined }) は ''
    expect(file.type).toBe('');
  });

  it('10 MB 超は client side で例外', async () => {
    // base64 で 10 MB + 1 byte 相当のダミーを作る (10MB 超)。
    const bigSize = 10 * 1024 * 1024 + 16;
    const big = 'A'.repeat(bigSize);
    const b64 = btoa(big);

    await expect(
      uploadFile.callback({ filename: 'big.bin', content: b64 }, { creds: CREDS }),
    ).rejects.toThrow(/too large/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filename 必須 / content 必須', async () => {
    await expect(
      uploadFile.callback({ filename: '', content: HELLO_BASE64 }, { creds: CREDS }),
    ).rejects.toThrow(/filename/);
    await expect(
      uploadFile.callback({ filename: 'a.txt', content: '' }, { creds: CREDS }),
    ).rejects.toThrow(/content/);
  });

  it('4xx は KintoneApiError として伝播', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'CB_VA01', message: 'invalid' }), { status: 400 }),
    );

    await expect(
      uploadFile.callback({ filename: 'a.txt', content: HELLO_BASE64 }, { creds: CREDS }),
    ).rejects.toThrow(/400.*CB_VA01/);
  });
});

describe('kintone-download-file', () => {
  it('GET /k/v1/file.json?fileKey=... + base64 で返す', async () => {
    const bin = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // 'hello'
    fetchMock.mockResolvedValue(
      new Response(bin, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );

    const result = await downloadFile.callback({ fileKey: 'fk-abc' }, { creds: CREDS });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/k/v1/file.json');
    expect(String(url)).toContain('fileKey=fk-abc');
    expect(init.method).toBe('GET');

    const out = result.structuredContent as {
      content: string;
      contentType: string | null;
      size: number;
    };
    expect(out.content).toBe(HELLO_BASE64);
    expect(out.contentType).toBe('application/pdf');
    expect(out.size).toBe(5);
  });

  it('Content-Type ヘッダ無しでも null を返して成功', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const result = await downloadFile.callback({ fileKey: 'fk-x' }, { creds: CREDS });
    const out = result.structuredContent as { contentType: string | null };
    expect(out.contentType).toBeNull();
  });

  it('10 MB 超はサーバから受信した後に client side で例外', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    fetchMock.mockResolvedValue(new Response(big, { status: 200 }));

    await expect(downloadFile.callback({ fileKey: 'fk-x' }, { creds: CREDS })).rejects.toThrow(
      /too large/,
    );
  });

  it('fileKey 必須', async () => {
    await expect(downloadFile.callback({ fileKey: '' }, { creds: CREDS })).rejects.toThrow(
      /fileKey/,
    );
  });

  it('404 は KintoneApiError として伝播', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'GAIA_FU01', message: 'not found' }), { status: 404 }),
    );

    await expect(downloadFile.callback({ fileKey: 'fk-no' }, { creds: CREDS })).rejects.toThrow(
      /404.*GAIA_FU01/,
    );
  });
});
