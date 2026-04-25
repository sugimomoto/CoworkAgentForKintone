import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createKintoneProxyTransport } from './proxyTransport';

let proxyMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  proxyMock = vi.fn();
  vi.stubGlobal('kintone', {
    plugin: { app: { proxy: proxyMock, getConfig: vi.fn(() => ({})), setConfig: vi.fn() } },
    app: { getId: () => 42 },
    getLoginUser: () => ({ code: 'sato' }),
    events: { on: () => {} },
    api: () => Promise.resolve({}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createKintoneProxyTransport', () => {
  it('指定 pluginId / URL / method / headers / body で kintone.plugin.app.proxy を呼ぶ', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ ok: true }), 200, {}]);

    const transport = createKintoneProxyTransport('plugin-id-xyz');
    const res = await transport('https://api.anthropic.com/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-ant-x' },
      body: JSON.stringify({ name: 'A' }),
    });

    expect(proxyMock).toHaveBeenCalledTimes(1);
    const args = proxyMock.mock.calls[0]!;
    expect(args[0]).toBe('plugin-id-xyz');
    expect(args[1]).toBe('https://api.anthropic.com/v1/agents');
    expect(args[2]).toBe('POST');
    expect(args[3]).toEqual({ 'Content-Type': 'application/json', 'x-api-key': 'sk-ant-x' });
    expect(args[4]).toBe(JSON.stringify({ name: 'A' }));

    const text = await res.text();
    expect(text).toBe(JSON.stringify({ ok: true }));
    expect(res.status).toBe(200);
  });

  it('body 未指定 (GET) のときは空文字を data に渡す', async () => {
    proxyMock.mockResolvedValue(['', 204, {}]);

    const transport = createKintoneProxyTransport('plugin-id-xyz');
    const res = await transport('https://api.anthropic.com/v1/sessions', {
      method: 'GET',
      headers: {},
    });

    expect(proxyMock.mock.calls[0]![4]).toBe('');
    expect(res.status).toBe(204);
  });

  it('ステータス >= 400 でも Response として返す (apiRequest 側でエラー化)', async () => {
    proxyMock.mockResolvedValue([JSON.stringify({ error: { message: 'bad' } }), 400, {}]);

    const transport = createKintoneProxyTransport('plugin-id-xyz');
    const res = await transport('https://api.anthropic.com/v1/agents', { method: 'GET' });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe('bad');
  });

  it('headers が undefined のとき空オブジェクトを渡す', async () => {
    proxyMock.mockResolvedValue(['{}', 200, {}]);

    const transport = createKintoneProxyTransport('plugin-id-xyz');
    await transport('https://api.anthropic.com/v1/agents', { method: 'GET' });

    expect(proxyMock.mock.calls[0]![3]).toEqual({});
  });
});
