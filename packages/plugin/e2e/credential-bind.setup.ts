// kintone 認証情報のバインディングを 1 回だけ実行する setup spec。
//
// Anthropic 側に既存 Vault + User Environment があれば skip、無ければ
// CredentialDialog 経由でバインドして全 spec の前提を整える。
//
// 1 度成功すれば Anthropic 上にリソースが残るので、以降の CI / ローカル実行は
// この setup を通過するだけで bound 状態を維持する。

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const KINTONE_USERNAME = process.env['KINTONE_USERNAME'];
const KINTONE_PASSWORD = process.env['KINTONE_PASSWORD'];

test('kintone 認証情報を Vault/Env にバインドする (idempotent)', async ({ page }, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定');
  if (!KINTONE_USERNAME || !KINTONE_PASSWORD) {
    testInfo.skip(true, 'KINTONE_USERNAME / KINTONE_PASSWORD が未設定');
  }

  test.setTimeout(180_000); // pip install 等で長引く可能性

  await page.goto(`/k/${APP_ID}/`);
  const root = page.locator('#cowork-agent-root');
  await expect(root).toBeAttached({ timeout: 15_000 });

  const input = root.getByPlaceholder(/このアプリ|レコード/);
  await expect(input).toBeEnabled({ timeout: 60_000 });

  // Welcome / 既存メッセージのいずれかが見える状態 = ready
  // 試しに何か送信して、CredentialDialog が出るか確認
  await input.fill('バインド確認テスト');
  await input.press('Enter');

  const dialog = page.getByTestId('credential-dialog');

  // 5 秒待って Dialog が出なければ「既にバインド済」とみなす
  const dialogAppeared = await dialog
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!dialogAppeared) {
    // 既にバインド済 → 何もしない
    return;
  }

  // バインドフロー実行
  await dialog.getByLabel(/kintone ドメイン/).fill(
    new URL(process.env['KINTONE_BASE_URL']!).host,
  );
  await dialog.getByLabel(/ログイン名/).fill(KINTONE_USERNAME!);
  await dialog.getByLabel(/パスワード/).fill(KINTONE_PASSWORD!);
  await dialog.getByRole('button', { name: '登録' }).click();

  // 成功するとダイアログが閉じる
  await expect(dialog).toBeHidden({ timeout: 120_000 });
});
