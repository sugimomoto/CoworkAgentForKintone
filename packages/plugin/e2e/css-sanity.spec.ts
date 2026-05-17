// CSS sanity E2E — Tailwind utility class が実 CSS として適用されているかを実ブラウザで検証する
//
// 背景:
//   `.cowork-agent-root *` や `.cowork-agent-root p` のような element-scoped reset を
//   素朴に書くと specificity (0,1,1) が Tailwind utility (0,1,0) を打ち消し、見た目が崩れる。
//   jsdom (vitest) では実 CSS が評価されないため class 検証では検出できない。
//   このスペックは getComputedStyle() で **数値** を assertion し、specificity 事故を即時に
//   検出することを目的とする。
//
// 検証対象 (代表 element の最小集合):
//   1. MemoryToggle pill        — `border` utility が効くか (= border-width: 1px)
//   2. AgentPicker trigger      — border + padding utility が <button> reset を上書きできるか
//   3. WelcomeMessage <p>       — `mt-[10px]` 等の任意値 margin が効くか
//   4. WelcomeMessage <ul>      — `list-disc` が `ul { list-style: none }` に勝つか
//
// これらが緑のままなら、reset と Tailwind utility の specificity 関係が健全と言える。

import { test, expect, type Page, type Locator } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
});

/**
 * 指定 element の computed style から、検査したい property だけを抜き出して返す。
 * Playwright の evaluate は serializable な値のみ返せるため、CSSStyleDeclaration から
 * 必要な keys だけ object に詰める。
 */
async function readStyle<K extends string>(
  locator: Locator,
  keys: readonly K[],
): Promise<Record<K, string>> {
  return locator.evaluate((el, props) => {
    const style = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const k of props as string[]) out[k] = style.getPropertyValue(k);
    return out as Record<string, string>;
  }, keys);
}

async function getPanel(page: Page): Promise<Locator> {
  const panel = page.getByTestId('cowork-agent-panel');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // bootstrap 完了 (Agent pill が出る) まで待つ
  await expect(panel.getByTestId('agent-picker-trigger')).toBeVisible({ timeout: 30_000 });
  return panel;
}

test.describe('Cowork Agent — CSS sanity (Tailwind utility が specificity 競合で消えていないか)', () => {
  test('MemoryToggle pill は 1px ボーダーで描画される', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);
    const panel = await getPanel(page);
    const style = await readStyle(panel.getByTestId('memory-toggle'), [
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
      'border-top-style',
    ] as const);
    // `.cowork-agent-root *` reset の specificity が高いと "0px" に潰される回帰
    expect(style['border-top-width']).toBe('1px');
    expect(style['border-right-width']).toBe('1px');
    expect(style['border-bottom-width']).toBe('1px');
    expect(style['border-left-width']).toBe('1px');
    expect(style['border-top-style']).toBe('solid');
  });

  test('AgentPicker trigger は border + padding utility が button reset を上書きできている', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);
    const panel = await getPanel(page);
    const style = await readStyle(panel.getByTestId('agent-picker-trigger'), [
      'border-top-width',
      'border-bottom-width',
      'border-radius',
      'padding-left',
      'padding-right',
      'padding-top',
      'padding-bottom',
    ] as const);
    // border
    expect(style['border-top-width']).toBe('1px');
    expect(style['border-bottom-width']).toBe('1px');
    expect(style['border-radius']).toBe('10px');
    // px-[8px] py-[6px] — `button { padding: 0 }` reset が勝つと全 0px になる回帰
    expect(style['padding-left']).toBe('8px');
    expect(style['padding-right']).toBe('8px');
    expect(style['padding-top']).toBe('6px');
    expect(style['padding-bottom']).toBe('6px');
  });

  test('WelcomeMessage の <p> に mt-[10px] が効いて margin-top:10px が反映される', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);
    const panel = await getPanel(page);

    // welcome-message は messages 空 + sessionId なしの初期 state でのみ出る。
    // bind-setup を経由している前提 (binding=bound) では、空セッションで描画される。
    const welcome = panel.getByTestId('welcome-message');
    await expect(welcome).toBeVisible();

    // 最初の <p class="mt-[10px]"> が "私は kintone..." のテキストを含む
    const firstP = welcome.locator('p').first();
    const style = await readStyle(firstP, ['margin-top'] as const);
    // `.cowork-agent-root p { margin: 0 }` reset の specificity が勝つと "0px" になる回帰
    expect(style['margin-top']).toBe('10px');
  });

  test('WelcomeMessage の <ul> は list-disc で bullet を表示する', async ({ page }) => {
    await page.goto(`/k/${APP_ID}/`);
    const panel = await getPanel(page);
    const welcome = panel.getByTestId('welcome-message');
    await expect(welcome).toBeVisible();

    const firstUl = welcome.locator('ul').first();
    const style = await readStyle(firstUl, [
      'list-style-type',
      'padding-left',
    ] as const);
    // `.cowork-agent-root ul { list-style: none }` reset が勝つと "none" になる回帰
    expect(style['list-style-type']).toBe('disc');
    // pl-[20px]
    expect(style['padding-left']).toBe('20px');
  });

});
