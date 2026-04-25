// Session 履歴機能の E2E
//
// 確認事項:
//   - 起動直後は messages が空 (自動復元しない)
//   - 初送信で新規 Session が作成され応答が来る
//   - 履歴ボタンで過去 Session 一覧が開ける
//   - 履歴選択で会話が復元される
//   - 新規会話ボタンで messages がクリアされ、再送信時に別 Session が始まる

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const REAL_API_KEY = process.env['ANTHROPIC_API_KEY'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (!REAL_API_KEY) testInfo.skip(true, 'ANTHROPIC_API_KEY が未設定のためスキップ');
});

test.describe('Cowork Agent — Session 履歴', () => {
  test('起動直後はチャット空・送信で新規 Session 作成・応答が来る', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    // 起動直後は messages 空 + WelcomeMessage が表示される
    expect(await root.locator('[data-msg]').count()).toBe(0);
    await expect(root.getByTestId('welcome-message')).toBeVisible();
    await expect(root.getByText(/Cowork Agent へようこそ/)).toBeVisible();

    const marker = `履歴テスト初送信-${Date.now()}`;
    await input.fill(marker);
    await input.press('Enter');

    // ユーザーメッセージ表示
    await expect(root.getByText(marker, { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // agent 応答が来る
    await expect
      .poll(async () => await root.locator('[data-msg-kind="agent"]').count(), {
        timeout: 90_000,
        intervals: [3_000, 5_000],
      })
      .toBeGreaterThanOrEqual(1);
  });

  test('履歴ボタンで一覧が開き、エントリ選択で過去会話が復元される', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    // ベースとなる発言を送って 1 つ Session を作る
    const marker = `履歴復元テスト-${Date.now()}`;
    await input.fill(marker);
    await input.press('Enter');
    await expect(root.getByText(marker, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    // agent 応答が来るまで待つ (Session が listSessions に確実に出現するまで)
    await expect
      .poll(async () => await root.locator('[data-msg-kind="agent"]').count(), {
        timeout: 90_000,
        intervals: [3_000, 5_000],
      })
      .toBeGreaterThanOrEqual(1);

    // 新規会話で一旦クリア
    await root.getByLabel('新規会話').click();
    expect(await root.locator('[data-msg]').count()).toBe(0);

    // 履歴を開く
    await root.getByLabel('履歴').click();
    await expect(page.getByText(/過去の会話/)).toBeVisible();
    const entries = page.getByTestId('history-entry');
    await expect.poll(async () => entries.count(), { timeout: 60_000 }).toBeGreaterThan(0);

    // 直近の Session を開く (新しい順 = 最初のエントリ)
    await entries.first().click();

    // marker が復元される
    await expect(async () => {
      const texts = await root.locator('[data-msg-kind="user"]').allTextContents();
      expect(texts.some((t) => t.includes(marker))).toBe(true);
    }).toPass({ timeout: 60_000, intervals: [3_000, 5_000] });
  });

  test('新規会話ボタンで messages がクリアされ、再送信は別 Session で始まる', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    const m1 = `第1セッション-${Date.now()}`;
    await input.fill(m1);
    await input.press('Enter');
    await expect(root.getByText(m1, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    // 応答到着まで待つ (listSessions に確実に出現させる)
    await expect
      .poll(async () => await root.locator('[data-msg-kind="agent"]').count(), {
        timeout: 90_000,
        intervals: [3_000, 5_000],
      })
      .toBeGreaterThanOrEqual(1);

    // 新規会話 → messages が空、Welcome が再表示される、Composer は引き続き有効
    await root.getByLabel('新規会話').click();
    expect(await root.locator('[data-msg]').count()).toBe(0);
    await expect(root.getByTestId('welcome-message')).toBeVisible();
    await expect(input).toBeEnabled();

    // 第 2 セッションを送る
    const m2 = `第2セッション-${Date.now()}`;
    await input.fill(m2);
    await input.press('Enter');
    await expect(root.getByText(m2, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    // 応答到着まで待つ
    await expect
      .poll(async () => await root.locator('[data-msg-kind="agent"]').count(), {
        timeout: 90_000,
        intervals: [3_000, 5_000],
      })
      .toBeGreaterThanOrEqual(1);

    // 第 1 セッションの marker は表示されていない (別 Session として始まった)
    expect(
      (await root.locator('[data-msg-kind="user"]').allTextContents()).some((t) => t.includes(m1)),
    ).toBe(false);

    // 履歴を開くと両方の Session が出る (件数 >= 2)
    await root.getByLabel('履歴').click();
    await expect.poll(
      async () => await page.getByTestId('history-entry').count(),
      { timeout: 60_000 },
    ).toBeGreaterThanOrEqual(2);
  });
});
