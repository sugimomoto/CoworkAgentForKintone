// PlanPanel (#128 タスク機構) 実 Anthropic API 連携 E2E
//
// 多段タスクを依頼して agent に `update_plan` を呼ばせ、会話スクロールの外側に
// 進捗チェックリスト帯 (PlanPanel) がピン留め表示されることを確認する。
//
// 前提:
//   - kintone にプラグインが追加済 (KINTONE_TEST_APP_ID で指定)
//   - 該当アプリのプラグイン設定で Anthropic API Key を入力・保存済
//   - Default Agent が v20 (update_plan ツール付き) に更新されていること
//
// LLM 呼び出しコストを含むため COWORK_E2E_SKIP_LIVE=1 でスキップ可。

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const SKIP_LIVE = process.env['COWORK_E2E_SKIP_LIVE'] === '1';

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (SKIP_LIVE) testInfo.skip(true, 'COWORK_E2E_SKIP_LIVE=1 によりスキップ');
});

test.describe('Cowork Agent — PlanPanel (#128)', () => {
  test('多段タスク依頼で update_plan が発火し PlanPanel が表示される', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });

    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    // 明示的に「計画を立てて段階的に進める」多段依頼を出して update_plan を誘発する。
    const prompt =
      'これから複数の手順が必要な作業をお願いします。' +
      'まず update_plan で 3 つ以上のサブタスクに分けた計画を宣言し、' +
      '各ステップの進捗を更新しながら進めてください。' +
      '内容は「このアプリのフィールド構成を調べて、要点を3行で要約する」です。';
    await input.fill(prompt);
    await input.press('Enter');

    // PlanPanel (進捗チェックリスト帯) が出現する = update_plan が処理された証拠
    const planPanel = root.getByTestId('plan-panel');
    await expect(planPanel).toBeVisible({ timeout: 120_000 });

    // 帯の中に進捗カウンタ (N / M 形式) が表示されている
    await expect(async () => {
      const text = (await planPanel.textContent()) ?? '';
      expect(text).toMatch(/\d+\s*\/\s*\d+/); // "1 / 3" など
    }).toPass({ timeout: 120_000, intervals: [2_000, 4_000] });

    // ヘッダのタイトルが「作業を実行中」か「作業が完了しました」のいずれかである
    await expect(async () => {
      const text = (await planPanel.textContent()) ?? '';
      expect(/作業を実行中|作業が完了しました|中$/.test(text)).toBe(true);
    }).toPass({ timeout: 120_000, intervals: [2_000, 4_000] });
  });
});
