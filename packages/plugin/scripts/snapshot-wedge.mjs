#!/usr/bin/env node
// snapshot-wedge.mjs — Customizer wedge V1 の実機スクリーンショットを撮影
//
// 動作:
//   1. .env から KINTONE_BASE_URL / USERNAME / PASSWORD / TEST_APP_ID を取得
//   2. 既存の .auth/kintone.json (auth.setup.ts で保存済) を再利用
//   3. レコード一覧画面 → チャットパネル開く → Settings View 遷移
//   4. 各画面でスクリーンショットを dist/snapshots/ に保存
//
// 使い方:
//   pnpm --filter @cowork-agent/plugin run snapshot
//
// 出力:
//   dist/snapshots/01-chat-panel.png    — Conversation View (Header + Composer)
//   dist/snapshots/02-agent-picker.png  — Agent プルダウン展開
//   dist/snapshots/03-settings-agents.png — Settings View / 🤖 Agents
//   dist/snapshots/04-settings-skills.png — Settings View / 🧠 Skills

import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env['KINTONE_BASE_URL'];
const USERNAME = process.env['KINTONE_USERNAME'];
const PASSWORD = process.env['KINTONE_PASSWORD'];
const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const AUTH_FILE = resolve(process.cwd(), '.auth/kintone.json');
const OUT_DIR = resolve(process.cwd(), 'dist/snapshots');

if (!BASE_URL || !USERNAME || !PASSWORD || !APP_ID) {
  console.error('❌ KINTONE_BASE_URL / KINTONE_USERNAME / KINTONE_PASSWORD / KINTONE_TEST_APP_ID が必要です');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT_HEIGHT = 1000;

async function loginIfNeeded(page) {
  // 既に storageState で認証済なら login 画面に飛ばされない
  await page.goto(`${BASE_URL}/k/${APP_ID}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) {
    console.log('▶ ログイン (storageState 期限切れ or 未保存)');
    await page.locator('input[name="username"]').fill(USERNAME);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('input[type="submit"], button[type="submit"]').first().click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    // storageState を保存し直す
    mkdirSync(resolve(process.cwd(), '.auth'), { recursive: true });
    await page.context().storageState({ path: AUTH_FILE });
    console.log('▶ ログイン完了 + storageState 保存');
    // レコード一覧に戻る
    await page.goto(`${BASE_URL}/k/${APP_ID}/`, { waitUntil: 'domcontentloaded' });
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctxOptions = {
    viewport: { width: 1440, height: VIEWPORT_HEIGHT },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  };
  // storageState があれば再利用、無ければ後で login して保存
  if (existsSync(AUTH_FILE)) {
    ctxOptions.storageState = AUTH_FILE;
  }
  const context = await browser.newContext(ctxOptions);
  const page = await context.newPage();

  try {
    console.log(`▶ open レコード一覧 (app ${APP_ID})`);
    await loginIfNeeded(page);

    // ユーザーが普段リサイズして使っているワイド幅 (1100px) で表示するため、
    // localStorage に width を仕込んでからリロード。default 380px の狭幅でなく
    // 「実機で確認している幅」と整合させる目的。
    await page.evaluate(() => {
      window.localStorage.setItem('cowork-agent.panel-width', '1100');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // kintone SPA の event 起動 (app.record.index.show) を待つ
    await page.waitForTimeout(3000);

    // プラグイン root のマウント待ち (kintone カスタマイズ JS が走るまで時間がかかる)
    const root = page.locator('#cowork-agent-root');
    await root.waitFor({ state: 'attached', timeout: 60_000 });

    // パネルが閉じていれば FAB クリックで開く
    const fab = root.getByTestId('cowork-agent-fab');
    if (await fab.count()) {
      console.log('▶ FAB クリックでパネルを開く');
      await fab.click();
    }
    const panel = root.getByTestId('cowork-agent-panel');
    await panel.waitFor({ state: 'visible', timeout: 10_000 });

    // bootstrap 完了待ち (ready 状態 + Agent pill が出るまで)
    await panel.getByTestId('agent-picker-trigger').waitFor({ timeout: 60_000 });

    // 1. Conversation View (デフォルト)
    console.log('▶ snapshot 01: chat-panel');
    await panel.screenshot({ path: resolve(OUT_DIR, '01-chat-panel.png') });

    // 2. Agent picker 展開
    console.log('▶ snapshot 02: agent-picker (展開状態)');
    await panel.getByTestId('agent-picker-trigger').click();
    await panel.getByTestId('agent-picker-dropdown').waitFor({ state: 'visible' });
    await panel.screenshot({ path: resolve(OUT_DIR, '02-agent-picker.png') });
    // 閉じる
    await page.keyboard.press('Escape');
    // 念のためトリガを再度クリックして close 状態に
    await page.waitForTimeout(200);

    // 3. Settings View / Agents (admin の場合のみ)
    const gear = panel.getByTestId('header-gear');
    if (await gear.count()) {
      console.log('▶ snapshot 03: settings-agents');
      await gear.click();
      await panel.getByTestId('settings-view').waitFor({ state: 'visible' });
      await panel.screenshot({ path: resolve(OUT_DIR, '03-settings-agents.png') });

      // 4. Settings View / Skills
      console.log('▶ snapshot 04: settings-skills');
      await panel.getByTestId('settings-nav-skills').click();
      await panel.getByTestId('skills-pane').waitFor({ state: 'visible' });
      await panel.screenshot({ path: resolve(OUT_DIR, '04-settings-skills.png') });
    } else {
      console.log('⚠ admin ではないので Settings View はスキップ');
    }

    console.log(`✅ snapshots saved to ${OUT_DIR}`);
  } catch (e) {
    console.error('❌ snapshot 失敗:', e.message);
    // 失敗時にもパネルの状態を撮る
    await page.screenshot({ path: resolve(OUT_DIR, '99-error.png'), fullPage: false });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
