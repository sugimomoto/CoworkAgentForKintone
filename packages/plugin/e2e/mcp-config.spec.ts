// #42 M1: Plugin Config の「追加 MCP サーバー」カタログ CRUD の E2E（実 kintone 設定画面）。
//
// 前提（config.spec.ts と同じ）:
//   - KINTONE_TEST_APP_ID / KINTONE_TEST_PLUGIN_ID
//   - 管理権限アカウントで auth.setup ログイン済
//
// bearer サーバーで検証（client_secret / setProxyConfig 副作用なし）。
// 追加 → 一覧表示 → setConfig に mcpServers が永続化 → 削除 までを通す。

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const PLUGIN_ID = process.env['KINTONE_TEST_PLUGIN_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (!PLUGIN_ID) testInfo.skip(true, 'KINTONE_TEST_PLUGIN_ID が未設定のためスキップ');
});

const configUrl = (): string => `/k/admin/app/${APP_ID}/plugin/config?pluginId=${PLUGIN_ID}`;

interface SetConfigCall {
  mcpServers?: string;
}

test.describe('Cowork Agent — Plugin Config 追加 MCP サーバー (#42)', () => {
  test('MCP サーバーを追加 → 一覧表示 + mcpServers 永続化 → 削除', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(configUrl());
    const root = page.locator('#cowork-agent-config-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    // セクション見出し
    await expect(root.getByRole('heading', { name: '追加 MCP サーバー' })).toBeVisible();

    // setConfig をスパイ（mcpServers の永続化を捕捉。original を呼んで callback も発火させる）
    await page.evaluate(() => {
      const k = (window as unknown as { kintone?: { plugin?: { app?: Record<string, unknown> } } }).kintone;
      if (!k?.plugin?.app) return;
      const original = k.plugin.app['setConfig'] as
        | ((config: Record<string, string>, cb?: () => void) => void)
        | undefined;
      const calls: Record<string, string>[] = [];
      (window as unknown as { __setConfigCalls?: Record<string, string>[] }).__setConfigCalls = calls;
      k.plugin.app['setConfig'] = (config: Record<string, string>, cb?: () => void) => {
        calls.push(config);
        original?.(config, cb);
      };
    });
    // 削除確認ダイアログは accept
    page.on('dialog', (d) => {
      d.accept().catch(() => {});
    });

    const name = `E2E MCP ${Date.now()}`;
    const url = 'https://e2e.example.com/mcp';

    // 追加フォームを開く
    await root.getByTestId('mcp-add-button').click();
    await root.getByTestId('mcp-name-input').fill(name);
    await root.getByTestId('mcp-url-input').fill(url);
    await root.getByRole('button', { name: 'API キー' }).click(); // authType=bearer
    await root.getByTestId('mcp-save-button').click();

    // 一覧に追加された行が出る
    const row = root.locator('li', { hasText: name });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText('API KEY');
    await expect(row).toContainText(url);

    // setConfig に mcpServers が永続化された（name/url/authType を含む）
    const afterAdd = (await page.evaluate(
      () => (window as unknown as { __setConfigCalls?: SetConfigCall[] }).__setConfigCalls ?? [],
    )) as SetConfigCall[];
    const lastWithServers = [...afterAdd].reverse().find((c) => typeof c.mcpServers === 'string');
    expect(lastWithServers, 'mcpServers を含む setConfig が呼ばれている').toBeTruthy();
    const servers = JSON.parse(lastWithServers!.mcpServers!) as Array<{
      name: string;
      url: string;
      authType: string;
    }>;
    const added = servers.find((s) => s.name === name);
    expect(added).toMatchObject({ name, url, authType: 'bearer' });

    // 削除 → 行が消える
    await row.getByRole('button', { name: '削除' }).click();
    await expect(root.locator('li', { hasText: name })).toHaveCount(0, { timeout: 10_000 });

    // 永続化からも消えた
    const afterDelete = (await page.evaluate(
      () => (window as unknown as { __setConfigCalls?: SetConfigCall[] }).__setConfigCalls ?? [],
    )) as SetConfigCall[];
    const lastServers = [...afterDelete].reverse().find((c) => typeof c.mcpServers === 'string');
    const finalServers = JSON.parse(lastServers!.mcpServers!) as Array<{ name: string }>;
    expect(finalServers.find((s) => s.name === name)).toBeUndefined();
  });
});
