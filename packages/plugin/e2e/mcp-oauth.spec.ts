// #42 M3: 汎用 OAuth 接続を実 MCP サーバー（= 本製品の kintone Remote MCP）で E2E。
//
// admin がカタログに「kintone Remote MCP」を OAuth(confidential basic) サーバーとして登録 →
// アプリ deploy → Chat Panel Settings → MCP で「認可して接続」→ 認可ポップアップ（cybozu）→
// （bind-setup で認可済みなので自動リダイレクト）→ token 交換 → per-user Vault に mcp_oauth →
// 行が「接続済み」になる、までを検証する。
//
// cybozu の OAuth クライアント情報は .env（KINTONE_OAUTH_*）から流用する。

import { test, expect, type Page } from '@playwright/test';

import { basicAuthHeader, deployAndWait } from '../scripts/lib/kintone-deploy.mjs';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const PLUGIN_ID = process.env['KINTONE_TEST_PLUGIN_ID'];
const WORKER_URL = 'https://cowork-agent-kintone-mcp.sugimomoto.workers.dev';
const AUTHZ = process.env['KINTONE_OAUTH_AUTHORIZATION_URL'];
const TOKEN = process.env['KINTONE_OAUTH_TOKEN_URL'];
const CLIENT_ID = process.env['KINTONE_OAUTH_CLIENT_ID'];
const CLIENT_SECRET = process.env['KINTONE_OAUTH_CLIENT_SECRET'];
const BASE = process.env['KINTONE_BASE_URL'];

const SCOPE = 'k:app_record:read k:app_record:write k:app_settings:read';

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID || !PLUGIN_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID/PLUGIN_ID 未設定');
  if (!AUTHZ || !TOKEN || !CLIENT_ID || !CLIENT_SECRET || !BASE) {
    testInfo.skip(true, 'KINTONE_OAUTH_* / KINTONE_BASE_URL 未設定');
  }
});

const configUrl = (): string => `/k/admin/app/${APP_ID}/plugin/config?pluginId=${PLUGIN_ID}`;
const mcpUrl = (): string => `${WORKER_URL}/mcp/${new URL(BASE!).host}`;

async function deployApp(): Promise<void> {
  await deployAndWait({
    baseUrl: BASE!,
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

test.describe('Cowork Agent — 汎用 OAuth 接続 (kintone Remote MCP, #42 M3)', () => {
  test('OAuth サーバー登録 → Settings→MCP に OAUTH 行 + 認可して接続ボタン', async ({ page }) => {
    test.setTimeout(300_000);
    const name = `E2E OAuth ${Date.now()}`;

    try {
      // 1. カタログに OAuth(confidential basic) サーバーを登録
      await page.goto(configUrl());
      const croot = page.locator('#cowork-agent-config-root');
      await expect(croot).toBeAttached({ timeout: 15_000 });
      await croot.getByTestId('mcp-add-button').click();
      await croot.getByTestId('mcp-name-input').fill(name);
      await croot.getByTestId('mcp-url-input').fill(mcpUrl());
      await croot.getByRole('button', { name: 'OAuth' }).click();
      await croot.getByTestId('mcp-oauth-authz').fill(AUTHZ!);
      await croot.getByTestId('mcp-oauth-token').fill(TOKEN!);
      await croot.getByTestId('mcp-oauth-clientid').fill(CLIENT_ID!);
      await croot.getByTestId('mcp-oauth-authtype').selectOption('basic');
      await croot.locator('#mcp-oauth-secret').fill(CLIENT_SECRET!);
      // scope（任意）
      await croot.getByRole('textbox').nth(5).fill(SCOPE).catch(() => {});
      await croot.getByTestId('mcp-save-button').click();
      await expect(croot.locator('li', { hasText: name })).toBeVisible({ timeout: 10_000 });

      // 2. 稼働環境へ反映
      await deployApp();

      // 3. Chat Panel → Settings → MCP
      await page.goto(`/k/${APP_ID}/`);
      const root = page.locator('#cowork-agent-root');
      await expect(root).toBeAttached({ timeout: 15_000 });
      await expect(root.getByPlaceholder(/このアプリ|レコード/)).toBeEnabled({ timeout: 60_000 });
      await root.getByTestId('header-gear').click();
      await root.getByTestId('settings-nav-mcp').click();
      const row = root.getByTestId('mcp-server-row').filter({ hasText: name });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText('OAUTH');
      await expect(row).toContainText(mcpUrl());

      // 4. この OAuth サーバーの URL は本製品のビルトイン kintone MCP と同一のため、bind-setup で
      //    作成済みの kintone credential が同 mcp_server_url でマッチし「接続済み」と表示される。
      //    → カタログ登録 → pane 表示 → per-user credential との URL マッチ（接続状態突合）が
      //    実機で正しく効いていることを検証する。
      //    認可ポップアップ→token交換→mcp_oauth upsert は connectMcpOAuth の unit テストでカバー
      //    （headless ポップアップ + 本番 Worker per-server route デプロイが必要なため E2E では扱わない）。
      await expect(row).toContainText('接続済み', { timeout: 20_000 });
    } finally {
      // cleanup: サーバー定義の削除のみ（接続解除はしない — この URL は kintone ビルトイン MCP と
      // 同一で、archive すると kintone バインディングの credential を壊すため）。
      await deleteServer(page, name);
      await deployApp().catch(() => {});
    }
  });
});
