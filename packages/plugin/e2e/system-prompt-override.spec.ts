// システムプロンプト base/persona 分離 + session override (#141) 実 API 連携 E2E
//
// 新規会話の初回送信で session override (system = base + persona) が組み立てられ、
// window.__coworkLastSystemOverride に記録されることを確認する。特に **二重 base に
// なっていない** (baseMarkerCount === 1) ことを検証する (レビュー指摘の回帰防止)。
//
// override 構築は ensureSession (初回送信時) に同期的に走るため、LLM 応答は待たない。
// COWORK_E2E_SKIP_LIVE=1 でスキップ可。

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const SKIP_LIVE = process.env['COWORK_E2E_SKIP_LIVE'] === '1';

interface OverrideSummary {
  usingCustomBase: boolean;
  baseLen: number;
  personaLen: number;
  totalLen: number;
  baseMarkerCount: number;
}

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
  if (SKIP_LIVE) testInfo.skip(true, 'COWORK_E2E_SKIP_LIVE=1 によりスキップ');
});

test.describe('Cowork Agent — system prompt override (#141)', () => {
  test('新規会話で base+persona override が注入され、二重 base にならない', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto(`/k/${APP_ID}/`);
    const root = page.locator('#cowork-agent-root');
    await expect(root).toBeAttached({ timeout: 15_000 });
    const input = root.getByPlaceholder(/このアプリ|レコード/);
    await expect(input).toBeEnabled({ timeout: 60_000 });

    // 新規会話の初回送信 → ensureSession → buildSystemOverride が window に記録
    await input.fill('こんにちは');
    await input.press('Enter');

    // override サマリが window に載るまで待つ (LLM 応答は待たない)
    await expect
      .poll(
        async () =>
          await page.evaluate(
            () =>
              (window as unknown as { __coworkLastSystemOverride?: unknown })
                .__coworkLastSystemOverride ?? null,
          ),
        { timeout: 60_000, intervals: [1_000, 2_000] },
      )
      .not.toBeNull();

    const summary = (await page.evaluate(
      () =>
        (window as unknown as { __coworkLastSystemOverride?: OverrideSummary })
          .__coworkLastSystemOverride,
    )) as OverrideSummary;

    // base と persona の両方が注入されている
    expect(summary.baseLen).toBeGreaterThan(0);
    expect(summary.personaLen).toBeGreaterThan(0);
    // system = base + '\n\n' + persona (完全一致の長さ)
    expect(summary.totalLen).toBe(summary.baseLen + summary.personaLen + 2);
    // **二重 base 回帰防止**: コード既定 base の見出しは 1 回だけ (2 なら二重 base のバグ)
    expect(summary.baseMarkerCount).toBe(1);
    expect(typeof summary.usingCustomBase).toBe('boolean');
  });
});
