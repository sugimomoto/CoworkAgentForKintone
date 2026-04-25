// 実 Anthropic API 連携 E2E
//
// 前提:
//   - kintone にプラグインが追加済 (KINTONE_TEST_APP_ID で指定)
//   - 該当アプリのプラグイン設定で Anthropic API Key を入力・保存済
//
// 実行をスキップするには `COWORK_E2E_SKIP_LIVE=1` を設定。
// LLM 呼び出しコスト + 外部依存を含むため、CI ではデフォルトでスキップ推奨。

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const SKIP_LIVE = process.env['COWORK_E2E_SKIP_LIVE'] === '1';

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (SKIP_LIVE) testInfo.skip(true, 'COWORK_E2E_SKIP_LIVE=1 によりスキップ');
});

test.describe('Cowork Agent — 実 Anthropic API 連携', () => {
  test('「こんにちは」送信 → Agent から意味のあるテキスト応答が表示される', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    await input.fill('こんにちは');
    await input.press('Enter');

    // UserMessage が即座に表示される (過去 Session 残存と衝突する可能性があるので first)
    await expect(root.getByText('こんにちは', { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });

    // agent kind のメッセージが少なくとも 1 つ届き、かつ "意味のある" テキストである
    // - [object Object] を含まない (content blocks の取り違えバグを検出)
    // - 1 文字以上のテキスト本体を持つ
    const agentMessages = root.locator('[data-msg-kind="agent"]');
    await expect(async () => {
      const count = await agentMessages.count();
      expect(count).toBeGreaterThanOrEqual(1);
      const last = (await agentMessages.last().textContent()) ?? '';
      expect(last).not.toContain('[object Object]');
      expect(last.trim().length).toBeGreaterThan(0);
    }).toPass({ timeout: 90_000, intervals: [3_000, 5_000] });
  });

  test('リロード後はチャットがクリアされ前回会話は自動復元しない (履歴経由でのみ復元)', async ({ page }) => {
    // 設計変更 (20260425-session-redesign) に伴う期待値変更:
    // 前回送信内容は **自動復元されず**、履歴ボタンから明示的に開いた場合のみ復元される
    test.setTimeout(180_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    const marker = `自動復元しないテスト-${Date.now()}`;
    await input.fill(marker);
    await input.press('Enter');
    await expect(root.getByText(marker, { exact: true })).toBeVisible({ timeout: 5_000 });
    // agent 応答到着まで待つ (listSessions に Session が確実に出現するように)
    await expect
      .poll(async () => await root.locator('[data-msg-kind="agent"]').count(), {
        timeout: 90_000,
        intervals: [3_000, 5_000],
      })
      .toBeGreaterThanOrEqual(1);

    // リロード → 履歴は空 (自動復元しない)
    await page.reload();
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(input).toBeEnabled({ timeout: 60_000 });

    // 数秒待ってもユーザー発言が復元されない
    await page.waitForTimeout(5_000);
    const userMsgs = root.locator('[data-msg-kind="user"]');
    expect(await userMsgs.count()).toBe(0);

    // 履歴ボタンを開くと先ほどの会話が一覧に出ている
    await root.getByLabel('履歴').click();
    await expect(page.getByText(/過去の会話/)).toBeVisible();
    const historyEntries = page.getByTestId('history-entry');
    await expect.poll(async () => historyEntries.count(), { timeout: 60_000 }).toBeGreaterThan(0);

    // エントリをクリックすると会話が復元され marker が画面に出る
    await historyEntries.first().click();
    await expect(async () => {
      const texts = await root.locator('[data-msg-kind="user"]').allTextContents();
      expect(texts.some((t) => t.includes(marker))).toBe(true);
    }).toPass({ timeout: 60_000, intervals: [3_000, 5_000] });
  });

  test('連続送信: 1 ターン目応答後に 2 ターン目を送ると新しい応答が来る', async ({ page }) => {
    // ターン終了後にポーリングが止まり 2 ターン目を取りこぼす回帰を防ぐ
    test.setTimeout(180_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    // 過去の Session に残ったメッセージと衝突しないようにユニーク文言を使う
    const turn1 = `テストターン1-${Date.now()}`;
    const turn2 = `テストターン2-${Date.now()}`;

    // === 1 ターン目 ===
    await input.fill(turn1);
    await input.press('Enter');

    const agentMessages = root.locator('[data-msg-kind="agent"]');
    await expect(async () => {
      expect(await agentMessages.count()).toBeGreaterThanOrEqual(1);
      const last = (await agentMessages.last().textContent()) ?? '';
      expect(last).not.toContain('[object Object]');
      expect(last.trim().length).toBeGreaterThan(0);
    }).toPass({ timeout: 90_000, intervals: [3_000, 5_000] });

    const firstTurnAgentCount = await agentMessages.count();
    const firstTurnLastText = (await agentMessages.last().textContent()) ?? '';

    // === 2 ターン目 ===
    await expect(input).toBeEnabled({ timeout: 30_000 });
    await input.fill(turn2);
    await input.press('Enter');

    await expect(root.getByText(turn2, { exact: true })).toBeVisible({ timeout: 5_000 });

    // 新たな agent 応答が増える (件数増 OR 末尾テキスト変化)
    await expect(async () => {
      const count = await agentMessages.count();
      const lastText = (await agentMessages.last().textContent()) ?? '';
      const advanced = count > firstTurnAgentCount || lastText !== firstTurnLastText;
      expect(advanced).toBe(true);
      expect(lastText).not.toContain('[object Object]');
      expect(lastText.trim().length).toBeGreaterThan(0);
    }).toPass({ timeout: 90_000, intervals: [3_000, 5_000] });
  });
});
