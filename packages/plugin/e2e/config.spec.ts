// プラグイン設定画面の E2E (Phase 1b-3 — 3 ステップウィザード)
//
// 設定画面 URL:
//   /k/admin/app/<APP_ID>/plugin/config?pluginId=<PLUGIN_ID>
//
// 前提:
//   - KINTONE_TEST_APP_ID (アプリ ID)
//   - KINTONE_TEST_PLUGIN_ID (プラグイン ID)
//   - 管理権限を持つアカウントで auth.setup ログイン済
//
// deploy 完走テストは ANTHROPIC_API_KEY + KINTONE_OAUTH_CLIENT_ID/SECRET 全部設定時のみ実行。

import { test, expect } from '@playwright/test';

import { basicAuthHeader, deployAndWait } from '../scripts/lib/kintone-deploy.mjs';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const PLUGIN_ID = process.env['KINTONE_TEST_PLUGIN_ID'];
const REAL_API_KEY = process.env['ANTHROPIC_API_KEY'];
const REAL_OAUTH_CLIENT_ID = process.env['KINTONE_OAUTH_CLIENT_ID'];
const REAL_OAUTH_CLIENT_SECRET = process.env['KINTONE_OAUTH_CLIENT_SECRET'];
const CF_API_TOKEN = process.env['CLOUDFLARE_API_TOKEN'];
const CF_ACCOUNT_ID = process.env['CLOUDFLARE_ACCOUNT_ID'];
const CF_SCRIPT_NAME = 'cowork-agent-kintone-mcp';
const WORKER_URL = 'https://cowork-agent-kintone-mcp.sugimomoto.workers.dev';

/** Cloudflare Workers script を削除する (404 は無視)。 */
async function deleteWorkerScript(): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${CF_SCRIPT_NAME}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Failed to delete Worker script (${res.status}): ${text}`);
  }
}

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (!PLUGIN_ID) testInfo.skip(true, 'KINTONE_TEST_PLUGIN_ID が未設定のためスキップ');
});

const configUrl = (): string =>
  `/k/admin/app/${APP_ID}/plugin/config?pluginId=${PLUGIN_ID}`;

test.describe('Cowork Agent — プラグイン設定画面 (3 ステップウィザード)', () => {
  test('設定画面が React マウントされ、Step 1 の入力欄と保存/キャンセルが描画される', async ({
    page,
  }) => {
    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByLabel('Worker URL')).toBeVisible();
    await expect(root.getByLabel('Anthropic API Key')).toBeVisible();
    await expect(root.getByRole('button', { name: '保存' })).toBeVisible();
    await expect(root.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  });

  test('全項目が空のとき保存ボタンは無効', async ({ page }) => {
    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  test('Worker URL 入力で callbackUrl と cybozu admin リンクが動的計算される', async ({
    page,
  }) => {
    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    await root.getByLabel('Worker URL').fill(WORKER_URL);

    const callback = root.getByTestId('callback-url');
    await expect(callback).toHaveText(`${WORKER_URL}/oauth/callback`);

    const link = root.getByTestId('cybozu-admin-link');
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/admin\/integrations\/oauth\/list$/);
  });

  test('全フィールドを埋めるまで保存ボタンが disabled', async ({ page }) => {
    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const saveBtn = root.getByRole('button', { name: '保存' });
    await expect(saveBtn).toBeDisabled();

    await root.getByLabel('Worker URL').fill(WORKER_URL);
    await expect(saveBtn).toBeDisabled();
    await root.getByLabel('Anthropic API Key').fill('sk-ant-x');
    await expect(saveBtn).toBeDisabled();
    await root.getByLabel('client_id').fill('cid');
    await expect(saveBtn).toBeDisabled();
    await root.getByLabel('client_secret').fill('csec');
    await expect(saveBtn).not.toBeDisabled();
  });

  test('全項目入力 → 保存 → 4 経路の setProxyConfig + REST API deploy まで完走する', async ({
    page,
  }) => {
    test.skip(
      !REAL_API_KEY || !REAL_OAUTH_CLIENT_ID || !REAL_OAUTH_CLIENT_SECRET,
      'ANTHROPIC_API_KEY / KINTONE_OAUTH_CLIENT_ID / KINTONE_OAUTH_CLIENT_SECRET が未設定のためスキップ',
    );
    test.setTimeout(180_000);

    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    // setProxyConfig 呼び出しを記録するスパイ
    await page.evaluate(() => {
      const k = (window as unknown as { kintone?: { plugin?: { app?: Record<string, unknown> } } })
        .kintone;
      if (!k?.plugin?.app) return;
      const original = k.plugin.app['setProxyConfig'] as
        | ((url: string, method: string, headers: Record<string, string>, data: unknown, cb?: () => void) => void)
        | undefined;
      const calls: unknown[] = [];
      (window as unknown as { __proxyCalls?: unknown[] }).__proxyCalls = calls;
      k.plugin.app['setProxyConfig'] = (
        url: string,
        method: string,
        headers: Record<string, string>,
        data: unknown,
        cb?: () => void,
      ) => {
        calls.push({ url, method, headers, data });
        original?.(url, method, headers, data, cb);
      };
    });

    // 保存後の alert を auto-accept
    page.on('dialog', (d) => d.accept().catch(() => {}));

    await root.getByLabel('Worker URL').fill(WORKER_URL);
    await root.getByLabel('Anthropic API Key').fill(REAL_API_KEY!);
    await root.getByLabel('client_id').fill(REAL_OAUTH_CLIENT_ID!);
    await root.getByLabel('client_secret').fill(REAL_OAUTH_CLIENT_SECRET!);

    await root.getByRole('button', { name: '保存' }).click();

    // 4 経路すべての setProxyConfig が呼ばれるまで待機 (delay があるので最大 60s)
    await page.waitForFunction(
      () =>
        ((window as unknown as { __proxyCalls?: unknown[] }).__proxyCalls?.length ?? 0) >= 4,
      { timeout: 60_000 },
    );
    const calls = (await page.evaluate(
      () => (window as unknown as { __proxyCalls?: unknown[] }).__proxyCalls ?? [],
    )) as Array<{ url: string; method: string; headers: Record<string, string> }>;
    expect(calls.length).toBeGreaterThanOrEqual(4);

    const urls = calls.map((c) => c.url);
    expect(urls).toContain(`${WORKER_URL}/credentials/upsert`);
    expect(urls).toContain('https://api.anthropic.com/');
    expect(urls.some((u) => u.endsWith('/oauth2/token'))).toBe(true);

    // /credentials/upsert は 3 つの secret ヘッダを持つ
    const upsert = calls.find((c) => c.url === `${WORKER_URL}/credentials/upsert`);
    expect(upsert?.headers['X-Anthropic-Api-Key']).toBe(REAL_API_KEY);
    expect(upsert?.headers['X-Kintone-OAuth-Client-Id']).toBe(REAL_OAUTH_CLIENT_ID);
    expect(upsert?.headers['X-Kintone-OAuth-Client-Secret']).toBe(REAL_OAUTH_CLIENT_SECRET);

    // 保存後はプラグイン一覧へ遷移
    await page.waitForURL(new RegExp(`/k/admin/app/${APP_ID}/plugin/`), {
      timeout: 30_000,
    });

    // REST API deploy + 完了 poll
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

  test('Step 0: Cloudflare Workers を削除 → ConfigScreen から再デプロイ → /version 照合まで完走する', async ({
    page,
  }) => {
    test.skip(
      !CF_API_TOKEN || !CF_ACCOUNT_ID,
      'CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が未設定のためスキップ',
    );
    test.setTimeout(180_000);

    // 1. 既存 Worker を削除 (テスト前提条件: 真っさらな状態から)
    await deleteWorkerScript();

    // 2. ConfigScreen を開いて Step 0 を埋める
    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    await root.getByLabel('Cloudflare Account ID').fill(CF_ACCOUNT_ID!);
    await root.getByLabel('Cloudflare API Token').fill(CF_API_TOKEN!);

    // 3. デプロイボタンを押す
    await root.getByTestId('cf-deploy-button').click();

    // 4. 成功メッセージを待つ (timeout は subdomain 取得 + script PUT + workers.dev 有効化 + /version retry を含む)
    const successMessage = root.getByTestId('cf-deploy-message');
    await expect(successMessage).toBeVisible({ timeout: 120_000 });
    await expect(successMessage).toContainText('✓ デプロイ成功', { timeout: 120_000 });
    await expect(successMessage).toContainText('Version: plugin.');
    await expect(successMessage).toContainText('Built At:');

    // エラーメッセージは表示されていない
    await expect(root.getByTestId('cf-deploy-error')).toHaveCount(0);

    // 5. Step 1 の Worker URL 欄に自動入力された
    const workerUrlInput = root.getByLabel('Worker URL');
    const value = await workerUrlInput.inputValue();
    expect(value).toMatch(/^https:\/\/cowork-agent-kintone-mcp\..+\.workers\.dev$/);

    // 6. デプロイされた Worker の /version を直接叩いて整合性を確認
    const versionUrl = `${value}/version`;
    const verRes = await fetch(versionUrl, { cache: 'no-store' });
    expect(verRes.status).toBe(200);
    const ver = (await verRes.json()) as { name: string; version: string; builtAt: string };
    expect(ver.name).toBe('cowork-agent-kintone-mcp');
    expect(ver.version).toMatch(/^plugin\.\d+\+/);
  });
});
