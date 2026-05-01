import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse } from '../../test/fixtures';

import { downloadSessionFile, listSessionFiles } from './files';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listSessionFiles', () => {
  it('GET /v1/files?scope_id=<sessionId> を呼び data 配列を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: 'file_1', filename: 'sales.pptx', mime_type: 'application/vnd.ms-powerpoint', size_bytes: 12345 },
          { id: 'file_2', filename: 'notes.txt' },
        ],
      }),
    );

    const result = await listSessionFiles('sesn_abc');

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('file_1');
    expect(result[0]!.filename).toBe('sales.pptx');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/files?scope_id=sesn_abc');
    expect((init as RequestInit).method).toBe('GET');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['anthropic-version']).toBeTruthy();
    expect(headers['anthropic-beta']).toContain('managed-agents');
  });

  it('data 欠けでも空配列を返す', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const result = await listSessionFiles('sesn_abc');
    expect(result).toEqual([]);
  });

  it('scope_id は URL エンコードされる', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await listSessionFiles('sesn with spaces');
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain('scope_id=sesn%20with%20spaces');
  });
});

describe('downloadSessionFile', () => {
  let proxyMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    proxyMock = vi.fn();
    vi.stubGlobal('kintone', {
      plugin: { app: { proxy: proxyMock } },
    });
  });

  it('Worker /files/:id/content (kintone proxy 経由) を呼び base64 → Blob に復元する', async () => {
    // PK ZIP magic を base64 化したもの ("UEsDBA==")
    const responseBody = JSON.stringify({
      contentBase64: 'UEsDBA==',
      mime: 'application/zip',
      sizeBytes: 4,
    });
    proxyMock.mockResolvedValueOnce([responseBody, 200]);

    const blob = await downloadSessionFile({
      pluginId: 'plg_x',
      workerUrl: 'https://worker.example.com',
      fileId: 'file_xyz',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(4);
    expect(blob.type).toBe('application/zip');
    expect(proxyMock).toHaveBeenCalledTimes(1);
    const [pluginId, url, method] = proxyMock.mock.calls[0]!;
    expect(pluginId).toBe('plg_x');
    expect(url).toBe('https://worker.example.com/files/file_xyz/content');
    expect(method).toBe('GET');
  });

  it('non-2xx で throw', async () => {
    proxyMock.mockResolvedValueOnce(['not found', 404]);
    await expect(
      downloadSessionFile({
        pluginId: 'plg_x',
        workerUrl: 'https://worker.example.com',
        fileId: 'missing',
      }),
    ).rejects.toThrow(/404/);
  });

  it('JSON が壊れていれば throw', async () => {
    proxyMock.mockResolvedValueOnce(['not-json', 200]);
    await expect(
      downloadSessionFile({
        pluginId: 'plg_x',
        workerUrl: 'https://worker.example.com',
        fileId: 'file_xyz',
      }),
    ).rejects.toThrow(/invalid JSON/);
  });
});
