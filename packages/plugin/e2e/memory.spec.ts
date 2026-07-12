// Memory Stores (#15) 実 Anthropic API 連携 E2E
//
// 設定 →「メモリ」セクションを開き、2 store (preferences / agent-context) が
// find-or-create + seed され、ファイルツリー・閲覧・編集 UI が動くことを確認する。
// LLM 呼び出しは伴わない (Memory API のみ) が実 API に依存するため、
// COWORK_E2E_SKIP_LIVE=1 でスキップ可。
//
// 前提:
//   - kintone にプラグインが追加済 (KINTONE_TEST_APP_ID)
//   - 該当アプリのプラグイン設定で Anthropic API Key を入力・保存済
//   - Memory トグルは既定 ON

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const SKIP_LIVE = process.env['COWORK_E2E_SKIP_LIVE'] === '1';

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (SKIP_LIVE) testInfo.skip(true, 'COWORK_E2E_SKIP_LIVE=1 によりスキップ');
});

test.describe('Cowork Agent — Memory Stores (#15)', () => {
  test('設定→メモリで 2 store が解決され、ツリー・閲覧・編集 UI が動く', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    await expect(root.getByPlaceholder(/このアプリ|レコード/)).toBeEnabled({ timeout: 60_000 });

    // #15/#81: gear は全ユーザーに開放。設定 →「メモリ」nav。
    await root.getByTestId('header-gear').click();
    const memoryNav = root.getByTestId('settings-nav-memory');
    await expect(memoryNav).toBeVisible();
    await memoryNav.click();

    // store 解決 + seed + 一覧取得が完了して MemorySection が出る
    await expect(root.getByTestId('memory-section')).toBeVisible({ timeout: 45_000 });

    // 2 store の見出し
    await expect(root.getByText('個人設定（全エージェント共通）')).toBeVisible();
    await expect(root.getByText(/このエージェント（/)).toBeVisible();

    // seed 済ファイルがツリーに出る (preferences: general.md)
    const generalRow = root.getByTestId('memory-file-general.md');
    await expect(generalRow).toBeVisible({ timeout: 15_000 });

    // ファイル選択 → 内容 (retrieve view=full) が表示され、編集 UI に入れる
    await generalRow.click();
    // 閲覧 or 空プレースホルダのどちらかが出る (seed 済なら本文)
    await expect(root.getByTestId('memory-edit')).toBeVisible({ timeout: 15_000 });
    await root.getByTestId('memory-edit').click();
    // textarea が出て、取消で閲覧に戻る (サーバーを変更しない安全な検証)
    await expect(root.getByTestId('memory-editor')).toBeVisible();
    await root.getByText('取消').click();
    await expect(root.getByTestId('memory-edit')).toBeVisible();
  });
});
