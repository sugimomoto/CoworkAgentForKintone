// レコード一覧画面を開いてチャットパネルが表示されることを確認する E2E スモーク
//
// 前提: KINTONE_TEST_APP_ID にプラグインが追加済みのアプリ ID を設定すること

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) {
    testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  }
});

test.describe('Cowork Agent — レコード一覧画面', () => {
  test('レコード一覧画面でチャットパネルがマウントされる', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);

    // プラグイン側の root 要素が動的に挿入されるまで待つ
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
  });

  test('Header に Agent 名と AGENT バッジが表示される', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);

    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByText('Cowork Agent for kintone')).toBeVisible();
    // AGENT バッジはサイズが小さいため toBeVisible だとレイアウト依存で flaky になりうる。
    // DOM 上に存在することを確認する (描画品質は Vitest 単体テストで担保済み)
    await expect(root.getByText(/^AGENT$/i)).toBeAttached();
  });

  test('Composer の入力欄と送信ボタンが描画される', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);

    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByPlaceholder(/このアプリ|レコード/)).toBeVisible();
    await expect(root.getByRole('button', { name: '送信' })).toBeVisible();
  });
});
