// #42 M4: AgentDetailModal の MCP attach セクションの E2E（実 kintone）。
//
// admin がカタログに bearer サーバーを登録 → アプリ deploy → Chat Panel Settings → エージェント →
// 任意エージェントの「編集」→ AgentDetailModal に MCP attach セクションが出て、登録サーバーが
// attach 候補として並ぶ、までを検証する（attach の ON/OFF 保存は agent spec を変えるため E2E では
// トグルせず、UI 配線＝カタログ→モーダルの表示までを確認。spec 構築は attachSpec の unit でカバー）。

import { test, expect, type Page } from '@playwright/test';

import { basicAuthHeader, deployAndWait } from '../scripts/lib/kintone-deploy.mjs';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const PLUGIN_ID = process.env['KINTONE_TEST_PLUGIN_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID || !PLUGIN_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID/PLUGIN_ID 未設定');
});

const configUrl = (): string => `/k/admin/app/${APP_ID}/plugin/config?pluginId=${PLUGIN_ID}`;

async function deployApp(): Promise<void> {
  await deployAndWait({
    baseUrl: process.env['KINTONE_BASE_URL']!,
    authHeader: basicAuthHeader(process.env['KINTONE_USERNAME']!, process.env['KINTONE_PASSWORD']!),
    appId: Number(APP_ID),
    timeoutMs: 120_000,
  });
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

test.describe('Cowork Agent — Agent attach セクション (#42 M4)', () => {
  test('カタログ登録 → Agent 編集モーダルに MCP attach セクション + 登録サーバー表示', async ({ page }) => {
    test.setTimeout(300_000);
    const name = `E2E Attach ${Date.now()}`;

    try {
      // 1. カタログに bearer サーバー登録 → deploy
      await page.goto(configUrl());
      const croot = page.locator('#cowork-agent-config-root');
      await expect(croot).toBeAttached({ timeout: 15_000 });
      await croot.getByTestId('mcp-add-button').click();
      await croot.getByTestId('mcp-name-input').fill(name);
      await croot.getByTestId('mcp-url-input').fill('https://e2e-attach.example.com/mcp');
      await croot.getByRole('button', { name: 'API キー' }).click();
      await croot.getByTestId('mcp-save-button').click();
      await expect(croot.locator('li', { hasText: name })).toBeVisible({ timeout: 10_000 });
      await deployApp();

      // 2. Chat Panel → Settings → エージェント
      await page.goto(`/k/${APP_ID}/`);
      const root = page.locator('#cowork-agent-root');
      await expect(root).toBeAttached({ timeout: 15_000 });
      await expect(root.getByPlaceholder(/このアプリ|レコード/)).toBeEnabled({ timeout: 60_000 });
      await root.getByTestId('header-gear').click();
      await root.getByTestId('settings-nav-agents').click();

      // 3. 任意エージェントの「編集」→ モーダル
      await root.locator('[data-testid^="agent-edit-"]').first().click();
      await expect(root.getByTestId('agent-detail-modal')).toBeVisible({ timeout: 15_000 });
      await expect(root.getByTestId('agent-detail-system')).toBeVisible({ timeout: 20_000 });

      // 4. MCP attach セクションに登録サーバーが出る
      const section = root.getByTestId('mcp-attach-section');
      await expect(section).toBeVisible();
      await expect(section).toContainText(name); // 登録したサーバーが attach 候補に並ぶ
      // attach トグルが少なくとも1つ出る（カタログに他サーバーがあれば複数）
      await expect(section.getByTestId('mcp-attach-toggle').first()).toBeVisible();
    } finally {
      await deleteServer(page, name);
      await deployApp().catch(() => {});
    }
  });
});
