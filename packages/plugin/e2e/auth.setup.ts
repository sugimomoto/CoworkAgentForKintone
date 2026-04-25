// kintone ログイン → セッションを .auth/kintone.json に保存
// 以降の spec はこの storageState を再利用する

import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = '.auth/kintone.json';

setup('kintone へログインしてセッションを保存', async ({ page }) => {
  const baseUrl = process.env['KINTONE_BASE_URL'];
  const username = process.env['KINTONE_USERNAME'];
  const password = process.env['KINTONE_PASSWORD'];

  if (!baseUrl || !username || !password) {
    throw new Error(
      'KINTONE_BASE_URL / KINTONE_USERNAME / KINTONE_PASSWORD が未設定です。.env を確認してください。',
    );
  }

  await page.goto(`${baseUrl}/login?saml=off`);

  // kintone のログインフォーム input は name 属性が安定 (label は rememberMe にも紐づくため避ける)
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[type="submit"], button[type="submit"]').first().click();

  // ログイン後のポータルへ遷移 (URL に /login が含まれなくなるまで待つ)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await expect(page).toHaveURL(/cybozu\.com|kintone\.com/);

  await page.context().storageState({ path: AUTH_FILE });
});
