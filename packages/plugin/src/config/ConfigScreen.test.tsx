import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigScreen } from './ConfigScreen';

function makeKintoneStub(overrides?: { getConfig?: () => Record<string, string> }) {
  return {
    plugin: {
      app: {
        getConfig: overrides?.getConfig ?? vi.fn(() => ({})),
        setConfig: vi.fn((_config: Record<string, string>, cb?: () => void) => {
          cb?.();
        }),
        setProxyConfig: vi.fn(),
      },
    },
    app: { getId: () => 42 },
  };
}

beforeEach(() => {
  vi.stubGlobal('kintone', makeKintoneStub());
  // window.location をスタブ (setConfig 後の遷移用)
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '', hostname: 'example.cybozu.com' },
  });
  // alert はテスト中ノーオペ
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConfigScreen', () => {
  it('Anthropic API Key 入力欄を表示する (password type)', () => {
    render(<ConfigScreen pluginId="abc" />);
    const input = screen.getByLabelText(/Anthropic API Key/);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('既に proxy 登録済 (marker あり) の場合は登録済バッジを表示する', () => {
    vi.stubGlobal(
      'kintone',
      makeKintoneStub({ getConfig: () => ({ proxyConfigured: 'true' }) }),
    );
    render(<ConfigScreen pluginId="abc" />);
    // ラベル隣の小さいバッジ要素が描画されること (Tailwind class で識別)
    const badges = screen.getAllByText('登録済み');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('API Key 入力欄は常に空でレンダリングされる (セキュリティのため平文保持しない)', () => {
    vi.stubGlobal(
      'kintone',
      makeKintoneStub({ getConfig: () => ({ proxyConfigured: 'true' }) }),
    );
    render(<ConfigScreen pluginId="abc" />);
    expect(screen.getByLabelText(/Anthropic API Key/)).toHaveValue('');
  });

  it('保存ボタン押下で GET / POST 各メソッドに setProxyConfig が呼ばれる', async () => {
    const setProxyConfig = vi.fn();
    const setConfig = vi.fn((_config: Record<string, string>, cb?: () => void) => cb?.());
    vi.stubGlobal('kintone', {
      plugin: {
        app: {
          getConfig: vi.fn(() => ({})),
          setConfig,
          setProxyConfig,
        },
      },
      app: { getId: () => 42 },
    });
    const user = userEvent.setup();
    render(<ConfigScreen pluginId="abc" />);

    await user.type(screen.getByLabelText(/Anthropic API Key/), 'sk-ant-new');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(setProxyConfig).toHaveBeenCalledTimes(2);
    });

    const methods = setProxyConfig.mock.calls.map((c) => c[1]);
    expect(methods).toEqual(expect.arrayContaining(['GET', 'POST']));

    for (const call of setProxyConfig.mock.calls) {
      expect(call[0]).toBe('https://api.anthropic.com/'); // URL prefix
      expect(call[2]).toMatchObject({ 'X-Api-Key': 'sk-ant-new' });
      expect(call[3]).toEqual({}); // 固定 body なし (動的に渡す)
    }
  });

  it('保存後は setConfig に proxyConfigured マーカーのみ書き、API Key 自体は保存しない', async () => {
    const setProxyConfig = vi.fn();
    const setConfig = vi.fn((_config: Record<string, string>, cb?: () => void) => cb?.());
    vi.stubGlobal('kintone', {
      plugin: {
        app: { getConfig: vi.fn(() => ({})), setConfig, setProxyConfig },
      },
      app: { getId: () => 42 },
    });
    const user = userEvent.setup();
    render(<ConfigScreen pluginId="abc" />);

    await user.type(screen.getByLabelText(/Anthropic API Key/), 'sk-ant-secret');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(setConfig).toHaveBeenCalled());
    const config = setConfig.mock.calls[0]![0] as Record<string, string>;
    expect(config['proxyConfigured']).toBe('true');
    expect(config['anthropicApiKey']).toBeUndefined();
  });

  it('API Key が空の状態では保存ボタンは無効', () => {
    render(<ConfigScreen pluginId="abc" />);
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('キャンセルボタン押下で history.back が呼ばれる', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ConfigScreen pluginId="abc" />);

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(back).toHaveBeenCalled();
  });
});
