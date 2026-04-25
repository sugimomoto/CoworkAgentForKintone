// チャットパネル開閉トグル E2E
//
// 確認事項:
//   - 既定では開いている
//   - Header の閉じるボタンで FAB のみになる
//   - FAB クリックで再表示される
//   - ⌘K / Ctrl+K でトグルする
//   - localStorage (cowork-agent:isOpen) に状態が永続化され、リロード後も復元される

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
});

test.describe('Cowork Agent — パネル開閉トグル', () => {
  test('閉じるボタン → FAB → 再オープン の往復ができる', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);

    const panel = page.getByTestId('cowork-agent-panel');
    await expect(panel).toBeAttached({ timeout: 15_000 });

    // 既定: 開いている
    await expect(panel).toHaveAttribute('data-open', '1');
    await expect(page.getByTestId('cowork-agent-fab')).toHaveCount(0);

    // 閉じる
    await panel.getByLabel('閉じる').click();
    await expect(panel).toHaveAttribute('data-open', '0');
    const fab = page.getByTestId('cowork-agent-fab');
    await expect(fab).toBeVisible();

    // FAB クリックで再オープン
    await fab.click();
    await expect(panel).toHaveAttribute('data-open', '1');
    await expect(page.getByTestId('cowork-agent-fab')).toHaveCount(0);
  });

  test('⌘K / Ctrl+K でトグルする', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);
    const panel = page.getByTestId('cowork-agent-panel');
    await expect(panel).toBeAttached({ timeout: 15_000 });
    await expect(panel).toHaveAttribute('data-open', '1');

    // Mac/Win 両対応のため Meta+K と Control+K の両方を試す
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await page.keyboard.press(`${modifier}+KeyK`);
    await expect(panel).toHaveAttribute('data-open', '0');

    await page.keyboard.press(`${modifier}+KeyK`);
    await expect(panel).toHaveAttribute('data-open', '1');
  });

  test('閉じた状態でリロードしても閉じたまま (localStorage 永続化)', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);
    const panel = page.getByTestId('cowork-agent-panel');
    await expect(panel).toBeAttached({ timeout: 15_000 });

    // 一度閉じる
    await panel.getByLabel('閉じる').click();
    await expect(panel).toHaveAttribute('data-open', '0');

    // localStorage に永続化されているか
    const stored = await page.evaluate(() => localStorage.getItem('cowork-agent:isOpen'));
    expect(stored).toBe('false');

    // リロード後も閉じたまま
    await page.reload();
    const panelAfter = page.getByTestId('cowork-agent-panel');
    await expect(panelAfter).toBeAttached({ timeout: 15_000 });
    await expect(panelAfter).toHaveAttribute('data-open', '0');
    await expect(page.getByTestId('cowork-agent-fab')).toBeVisible();
  });
});
