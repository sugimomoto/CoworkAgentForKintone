// プラグイン設定画面の E2E
//
// 設定画面へは直接 URL で遷移可能:
//   /k/admin/app/<APP_ID>/plugin/config?pluginId=<PLUGIN_ID>
//
// 前提:
//   - KINTONE_TEST_APP_ID にプラグイン追加済アプリの ID を設定
//   - KINTONE_TEST_PLUGIN_ID にプラグインの ID (32 文字英数字) を設定
//   - そのアプリの管理権限を持つアカウントで auth.setup ログイン済

import { test, expect } from '@playwright/test';

import { basicAuthHeader, deployAndWait } from '../scripts/lib/kintone-deploy.mjs';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const PLUGIN_ID = process.env['KINTONE_TEST_PLUGIN_ID'];
const REAL_API_KEY = process.env['ANTHROPIC_API_KEY'];
// 一気通貫テストは proxy 設定 + アプリ deploy を実行し、kintone 上の状態を変更する。
// デフォルトでは無効。`ANTHROPIC_API_KEY` が設定されているときのみ有効化される。

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (!PLUGIN_ID) testInfo.skip(true, 'KINTONE_TEST_PLUGIN_ID が未設定のためスキップ');
});

const configUrl = (): string =>
  `/k/admin/app/${APP_ID}/plugin/config?pluginId=${PLUGIN_ID}`;

test.describe('Cowork Agent — プラグイン設定画面', () => {
  test('設定画面が React マウントされ、API Key 入力欄と保存/キャンセルボタンが描画される', async ({
    page,
  }) => {
    await page.goto(configUrl());

    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByLabel('Anthropic API Key')).toBeVisible();
    await expect(root.getByRole('button', { name: '保存' })).toBeVisible();
    await expect(root.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  });

  test('API Key 空のとき保存ボタンは無効', async ({ page }) => {
    await page.goto(configUrl());

    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  test('API Key 入力 → 保存 → REST API でアプリ deploy まで完走する', async ({ page }) => {
    test.skip(
      !REAL_API_KEY,
      'ANTHROPIC_API_KEY が未設定のためスキップ (実 API Key で proxy 設定を上書きするため)',
    );
    test.setTimeout(180_000); // deploy ポーリング用に余裕

    await page.goto(configUrl());

    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    // setProxyConfig 呼び出しを window 上で記録するスパイを仕込む
    await page.evaluate(() => {
      const k = (window as unknown as { kintone?: { plugin?: { app?: Record<string, unknown> } } })
        .kintone;
      if (!k?.plugin?.app) return;
      const original = k.plugin.app['setProxyConfig'] as
        | ((url: string, method: string, headers: Record<string, string>, data: unknown) => void)
        | undefined;
      const calls: unknown[] = [];
      (window as unknown as { __proxyCalls?: unknown[] }).__proxyCalls = calls;
      k.plugin.app['setProxyConfig'] = (
        url: string,
        method: string,
        headers: Record<string, string>,
        data: unknown,
      ) => {
        calls.push({ url, method, headers, data });
        original?.(url, method, headers, data);
      };
    });

    // 保存後の alert を auto-accept (ネイティブ dialog)
    page.on('dialog', (d) => d.accept().catch(() => {}));

    // 実 API Key を使う (deploy 後の kintone proxy が正しく機能するように)
    const apiKey = REAL_API_KEY!;
    await root.getByLabel('Anthropic API Key').fill(apiKey);

    await root.getByRole('button', { name: '保存' }).click();

    // 1. setProxyConfig が 2 回 (GET / POST) 呼ばれるまで待機
    //    setConfig コールバック内で navigation する前にキャプチャ
    await page.waitForFunction(
      () =>
        ((window as unknown as { __proxyCalls?: unknown[] }).__proxyCalls?.length ?? 0) >= 2,
      { timeout: 10_000 },
    );
    const calls = await page.evaluate(
      () => (window as unknown as { __proxyCalls?: unknown[] }).__proxyCalls ?? [],
    );
    expect(calls).toHaveLength(2);
    const methods = (calls as Array<{ method: string }>).map((c) => c.method).sort();
    expect(methods).toEqual(['GET', 'POST']);
    for (const call of calls as Array<{ url: string; headers: Record<string, string> }>) {
      expect(call.url).toBe('https://api.anthropic.com/');
      expect(call.headers['X-Api-Key']).toBe(apiKey);
    }

    // 2. 保存後はプラグイン一覧 (/k/admin/app/<APP_ID>/plugin/?message=CONFIG_SAVED) へ kintone が自動遷移
    await page.waitForURL(new RegExp(`/k/admin/app/${APP_ID}/plugin/`), {
      timeout: 15_000,
    });

    // 3. ローカルから Basic 認証で REST API deploy + 完了 poll
    //    (UI クリック / page.evaluate 経由は CSRF や SPA 遷移挙動で flaky なため、
    //     直接 Node fetch + Basic 認証 で堅牢化)
    await deployAndWait({
      baseUrl: process.env['KINTONE_BASE_URL']!,
      authHeader: basicAuthHeader(
        process.env['KINTONE_USERNAME']!,
        process.env['KINTONE_PASSWORD']!,
      ),
      appId: Number(APP_ID),
      timeoutMs: 120_000,
    });
  });
});
