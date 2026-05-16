// ConfigScreen (Phase 1b-3 OAuth ウィザード) のテスト。
//
// 検証:
// - workerUrl 入力で callbackUrl が `<workerUrl>/oauth/callback` で計算される
// - cybozu admin リンクが `https://<location.hostname>/admin/integrations/oauth/list`
// - 保存時 setProxyConfig が 3 経路 (oauth2/token + Worker root POST + Worker root GET) — kintone proxy URL 前方一致を活用
// - setConfig には secret (client_secret / anthropic_api_key) が含まれない

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigScreen } from './ConfigScreen';

const PLUGIN_ID = 'plg_x';

let setProxyConfigMock: ReturnType<typeof vi.fn>;
let setConfigMock: ReturnType<typeof vi.fn>;
let getConfigMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setProxyConfigMock = vi.fn((_url, _method, _headers, _data, cb) => cb && cb());
  setConfigMock = vi.fn((_cfg, cb) => cb && cb());
  getConfigMock = vi.fn(() => ({}));
  // @ts-expect-error global kintone shim — proxy / events 等は test では未使用
  globalThis.kintone = {
    plugin: {
      app: {
        setProxyConfig: setProxyConfigMock,
        setConfig: setConfigMock,
        getConfig: getConfigMock,
        proxy: vi.fn(),
      },
    },
    app: { getId: () => 1 },
  };
  Object.defineProperty(window, 'location', {
    value: { hostname: 'tenant.cybozu.com', href: '' },
    writable: true,
  });
  // alert をモック
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error cleanup
  delete globalThis.kintone;
});

describe('ConfigScreen', () => {
  it('Worker URL 入力で callbackUrl が動的に計算される', async () => {
    const user = userEvent.setup();
    render(<ConfigScreen pluginId={PLUGIN_ID} />);

    const workerUrlInput = screen.getByLabelText('Worker URL');
    await user.type(workerUrlInput, 'https://my-worker.example.com');

    const cb = screen.getByTestId('callback-url');
    expect(cb.textContent).toBe('https://my-worker.example.com/oauth/callback');
  });

  it('cybozu admin 画面のリンクが location.hostname から組み立てられる', () => {
    render(<ConfigScreen pluginId={PLUGIN_ID} />);
    const link = screen.getByTestId('cybozu-admin-link');
    expect(link.getAttribute('href')).toBe(
      'https://tenant.cybozu.com/admin/integrations/oauth/list',
    );
  });

  it('全項目入力 → 保存で setProxyConfig が 3 経路呼ばれる (Worker root を前方一致で活用)', async () => {
    const user = userEvent.setup();
    render(<ConfigScreen pluginId={PLUGIN_ID} />);

    await user.type(screen.getByLabelText('Worker URL'), 'https://w.example.com');
    await user.type(screen.getByLabelText('Anthropic API Key'), 'sk-ant-x');
    await user.type(screen.getByLabelText('client_id'), 'cid');
    await user.type(screen.getByLabelText('client_secret'), 'csec');

    await user.click(screen.getByRole('button', { name: '保存' }));

    // setProxyConfig は逐次 await + sleep(700ms) を入れているので待つ
    await waitFor(() => expect(setProxyConfigMock).toHaveBeenCalledTimes(3), {
      timeout: 6_000,
    });

    const calls = setProxyConfigMock.mock.calls;
    const urls = calls.map((c) => c[0]);
    const methods = calls.map((c) => c[1]);

    // 1) oauth2/token POST (kintone 自身のドメイン)
    const tokenIdx = urls.indexOf('https://tenant.cybozu.com/oauth2/token');
    expect(tokenIdx).toBeGreaterThanOrEqual(0);
    expect(methods[tokenIdx]).toBe('POST');
    const tokenHeaders = calls[tokenIdx]![2] as Record<string, string>;
    expect(tokenHeaders['Authorization']).toContain('Basic ');

    // 2) Worker root URL POST — 配下の全 POST エンドポイントを 1 つの登録でカバー
    //    (/credentials/upsert / /skills/sync / /anthropic/*)
    const workerPost = calls.find(
      (c) => c[0] === 'https://w.example.com/' && c[1] === 'POST',
    );
    expect(workerPost).toBeTruthy();
    const postHeaders = workerPost![2] as Record<string, string>;
    expect(postHeaders['X-Anthropic-Api-Key']).toBe('sk-ant-x');
    expect(postHeaders['X-Kintone-OAuth-Client-Id']).toBe('cid');
    expect(postHeaders['X-Kintone-OAuth-Client-Secret']).toBe('csec');
    expect(postHeaders['Content-Type']).toBe('application/json');

    // 3) Worker root URL GET — 配下の GET エンドポイント (/files/, /anthropic/*) をカバー
    const workerGet = calls.find(
      (c) => c[0] === 'https://w.example.com/' && c[1] === 'GET',
    );
    expect(workerGet).toBeTruthy();
    const getHeaders = workerGet![2] as Record<string, string>;
    expect(getHeaders['X-Anthropic-Api-Key']).toBe('sk-ant-x');
  });

  it('保存時 setConfig には secret が含まれない', async () => {
    const user = userEvent.setup();
    render(<ConfigScreen pluginId={PLUGIN_ID} />);

    await user.type(screen.getByLabelText('Worker URL'), 'https://w.example.com');
    await user.type(screen.getByLabelText('Anthropic API Key'), 'sk-ant-secret');
    await user.type(screen.getByLabelText('client_id'), 'cid');
    await user.type(screen.getByLabelText('client_secret'), 'csec-secret');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(setConfigMock).toHaveBeenCalled(), { timeout: 10_000 });
    const config = setConfigMock.mock.calls[0]![0] as Record<string, string>;
    expect(config.workerUrl).toBe('https://w.example.com');
    expect(config.oauthClientId).toBe('cid');
    expect(config.saved).toBe('true');
    // secret 値は setConfig に含まれない
    expect(JSON.stringify(config)).not.toContain('sk-ant-secret');
    expect(JSON.stringify(config)).not.toContain('csec-secret');
  });

  it('全項目を埋めるまで保存ボタンが disabled', async () => {
    const user = userEvent.setup();
    render(<ConfigScreen pluginId={PLUGIN_ID} />);

    const saveBtn = screen.getByRole('button', { name: '保存' });
    expect(saveBtn).toBeDisabled();

    await user.type(screen.getByLabelText('Worker URL'), 'https://w.example.com');
    expect(saveBtn).toBeDisabled();
    await user.type(screen.getByLabelText('Anthropic API Key'), 'sk');
    expect(saveBtn).toBeDisabled();
    await user.type(screen.getByLabelText('client_id'), 'cid');
    expect(saveBtn).toBeDisabled();
    await user.type(screen.getByLabelText('client_secret'), 'csec');
    expect(saveBtn).not.toBeDisabled();
  });

  it('既存設定がある状態で開くと workerUrl / clientId が復元される (secret は復元されない)', () => {
    getConfigMock.mockReturnValue({
      saved: 'true',
      workerUrl: 'https://prev.example.com',
      oauthClientId: 'prev-cid',
    });
    render(<ConfigScreen pluginId={PLUGIN_ID} />);

    expect((screen.getByLabelText('Worker URL') as HTMLInputElement).value).toBe(
      'https://prev.example.com',
    );
    expect((screen.getByLabelText('client_id') as HTMLInputElement).value).toBe('prev-cid');
    // secret は空欄
    expect((screen.getByLabelText('client_secret') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Anthropic API Key') as HTMLInputElement).value).toBe('');
  });

  it('Worker URL が無効なら Step 2 / Step 3 は disabled (aria-disabled=true)', async () => {
    const user = userEvent.setup();
    render(<ConfigScreen pluginId={PLUGIN_ID} />);

    // 無効な URL
    await user.type(screen.getByLabelText('Worker URL'), 'not-a-url');

    const heading2 = screen.getByText('Step 2. cybozu.com に OAuth クライアントを登録');
    const heading3 = screen.getByText('Step 3. OAuth クライアント情報');
    expect(heading2.closest('section')!.getAttribute('aria-disabled')).toBe('true');
    expect(heading3.closest('section')!.getAttribute('aria-disabled')).toBe('true');
  });
});
