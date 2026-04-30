import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadFileToKintone } from './fileUploadKintone';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('uploadFileToKintone', () => {
  it('POST /k/v1/file.json + multipart + X-Requested-With ヘッダで送信', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fileKey: 'fk-1' }));

    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const result = await uploadFileToKintone(file);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/k/v1/file.json');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(init.credentials).toBe('include');

    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    const f = form.get('file');
    expect(f).toBeInstanceOf(File);
    expect((f as File).name).toBe('a.txt');

    expect(result).toEqual({ fileKey: 'fk-1' });
  });

  it('4xx は status と本文を含む例外', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }),
    );

    const file = new File(['x'], 'x.txt');
    await expect(uploadFileToKintone(file)).rejects.toThrow(/403.*forbidden/);
  });

  it('5xx は例外', async () => {
    fetchMock.mockResolvedValue(new Response('upstream', { status: 502 }));
    const file = new File(['x'], 'x.txt');
    await expect(uploadFileToKintone(file)).rejects.toThrow(/502/);
  });
});
