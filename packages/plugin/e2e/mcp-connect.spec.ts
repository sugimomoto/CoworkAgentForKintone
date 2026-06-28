// #42 M2: Settings → MCP の per-user 接続ペインの E2E（実 kintone）。
//
// カタログ（Plugin Config で登録）→ Chat Panel Settings → MCP に一覧表示され、
// 未接続行の「接続」で bearer 入力が開くところまでを実機で検証する。
// （実 bearer サーバーが無いため接続完了までは unit でカバー。ここは catalog→pane→接続UI の配線確認。）

import { test, expect, type Page } from '@playwright/test';

import { basicAuthHeader, deployAndWait } from '../scripts/lib/kintone-deploy.mjs';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const PLUGIN_ID = process.env['KINTONE_TEST_PLUGIN_ID'];

/** Plugin Config の変更を稼働環境へ反映（chat panel から読めるように）。 */
async function deployApp(): Promise<void> {
  await deployAndWait({
    baseUrl: process.env['KINTONE_BASE_URL']!,
    authHeader: basicAuthHeader(process.env['KINTONE_USERNAME']!, process.env['KINTONE_PASSWORD']!),
    appId: Number(APP_ID),
    timeoutMs: 120_000,
  });
}

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID 未設定');
  if (!PLUGIN_ID) testInfo.skip(true, 'KINTONE_TEST_PLUGIN_ID 未設定');
});

const configUrl = (): string => `/k/admin/app/${APP_ID}/plugin/config?pluginId=${PLUGIN_ID}`;

async function addBearerServer(page: Page, name: string, url: string): Promise<void> {
  await page.goto(configUrl());
  const root = page.locator('#cowork-agent-config-root');
  await expect(root).toBeAttached({ timeout: 15_000 });
  await root.getByTestId('mcp-add-button').click();
  await root.getByTestId('mcp-name-input').fill(name);
  await root.getByTestId('mcp-url-input').fill(url);
  await root.getByRole('button', { name: 'API キー' }).click();
  await root.getByTestId('mcp-save-button').click();
  await expect(root.locator('li', { hasText: name })).toBeVisible({ timeout: 10_000 });
}

async function deleteServer(page: Page, name: string): Promise<void> {
  page.on('dialog', (d) => {
    d.accept().catch(() => {});
  });
  await page.goto(configUrl());
  const root = page.locator('#cowork-agent-config-root');
  await expect(root).toBeAttached({ timeout: 15_000 });
  const row = root.locator('li', { hasText: name });
  if ((await row.count()) > 0) {
    await row.getByRole('button', { name: '削除' }).click();
    await expect(root.locator('li', { hasText: name })).toHaveCount(0, { timeout: 10_000 });
  }
}

test.describe('Cowork Agent — Settings → MCP per-user 接続 (#42 M2)', () => {
  test('カタログ登録 → Settings→MCP に一覧表示 → 接続で bearer 入力が開く', async ({ page }) => {
    test.setTimeout(300_000);
    const name = `E2E Connect ${Date.now()}`;
    const url = 'https://e2e-connect.example.com/mcp';

    try {
      // 1. admin がカタログに bearer サーバーを登録 → アプリ deploy で稼働環境に反映
      await addBearerServer(page, name, url);
      await deployApp();

      // 2. Chat Panel を開く（bootstrap 完了まで待つ）
      await page.goto(`/k/${APP_ID}/`);
      const root = page.locator('#cowork-agent-root');
      await expect(root).toBeAttached({ timeout: 15_000 });
      await expect(root.getByPlaceholder(/このアプリ|レコード/)).toBeEnabled({ timeout: 60_000 });

      // 3. ⚙ → Settings → MCP
      await root.getByTestId('header-gear').click();
      await root.getByTestId('settings-nav-mcp').click();
      await expect(root.getByTestId('mcp-pane')).toBeVisible();

      // 4. 登録したサーバー行が未接続で出る
      const row = root.getByTestId('mcp-server-row').filter({ hasText: name });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText('API KEY');
      await expect(row).toContainText(url);

      // 5. 「接続」で bearer 入力欄が開く
      await row.getByTestId('mcp-connect-button').click();
      await expect(row.getByTestId('mcp-bearer-input')).toBeVisible();
    } finally {
      // cleanup（登録解除 → deploy で稼働環境も元に戻す）
      await deleteServer(page, name);
      await deployApp().catch(() => {});
    }
  });
});
