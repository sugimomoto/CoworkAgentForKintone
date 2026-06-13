#!/usr/bin/env node
// snapshot-handoff.mjs — design ハンドオフ HTML から各 artboard をスクリーンショット
//
// 動作:
//   1. docs/design-handoff/customizer-wedge/project/Cowork Agent Chat Panel.html を
//      Playwright で file:// 経由で開く
//   2. data-dc-slot="..." の DOM 要素 (= 各 DCArtboard) を順に locate
//   3. boundingBox を切り出して PNG として dist/snapshots/handoff/ 配下に保存
//
// 撮影対象 artboard (実装 snapshot との対応):
//   handoff/01-chat-panel.png      ← header-c-customizer (案 C · Customizer Opus 選択中)
//   handoff/02-agent-picker.png    ← header-c-open       (案 C · ドロップダウン展開)
//   handoff/03-settings-agents.png ← settings-agents-solo (Settings View 単体 · 一覧)
//   handoff/04-settings-skills.png ← settings-skills-solo (Skills 単体)
//
// 使い方:
//   pnpm --filter @cowork-agent/plugin run snapshot:handoff

import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const HANDOFF_PROJECT_DIR = resolve(
  REPO_ROOT,
  'docs',
  'design-handoff',
  'customizer-wedge',
  'project',
);
const HANDOFF_ENTRY = 'Cowork Agent Chat Panel.html';
const OUT_DIR = resolve(__dirname, '..', 'dist', 'snapshots', 'handoff');
const PORT = 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.napkin': 'text/plain; charset=utf-8',
};

/** 静的ファイルを serve する最小限の HTTP サーバ (CORS 回避用) */
function startStaticServer(rootDir, port) {
  const server = createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const rel = urlPath === '/' ? `/${HANDOFF_ENTRY}` : urlPath;
      const filePath = join(rootDir, rel);
      const stat = statSync(filePath);
      if (!stat.isFile()) {
        res.writeHead(404).end();
        return;
      }
      const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolveListen) => {
    server.listen(port, '127.0.0.1', () => resolveListen(server));
  });
}

/** 実装 snapshot との対応 (file 名 → handoff artboard id) */
const TARGETS = [
  { outFile: '01-chat-panel.png', dcSlot: 'header-c-customizer' },
  { outFile: '02-agent-picker.png', dcSlot: 'header-c-open' },
  { outFile: '03-settings-agents.png', dcSlot: 'settings-agents-solo' },
  { outFile: '04-settings-skills.png', dcSlot: 'settings-skills-solo' },
];

mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  console.log(`▶ static server on http://127.0.0.1:${PORT} (root=${HANDOFF_PROJECT_DIR.split('/').slice(-3).join('/')})`);
  const server = await startStaticServer(HANDOFF_PROJECT_DIR, PORT);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 2400 }, // design canvas は縦長
    locale: 'ja-JP',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // page error / console error をログ出力 (handoff page が render されているかの確認)
  page.on('pageerror', (err) => console.error(`  [page-error] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`  [console-error] ${msg.text()}`);
  });

  try {
    const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(HANDOFF_ENTRY)}`;
    console.log(`▶ load handoff HTML: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // babel-transform-jsx の compile が走るまで待つ (DesignCanvas は重め)
    await page.waitForTimeout(5000);

    // デバッグ: fullPage スクショで現在の描画状態を保存
    await page.screenshot({
      path: resolve(OUT_DIR, '00-debug-full.png'),
      fullPage: true,
    });

    // DOM に data-dc-slot 要素が存在するか確認
    const slotCount = await page.locator('[data-dc-slot]').count();
    console.log(`  [debug] data-dc-slot elements: ${slotCount}`);
    if (slotCount === 0) {
      console.warn('⚠ React render が完了していない可能性。デバッグ fullPage は 00-debug-full.png');
      return;
    }

    // 全 artboard をマウントさせるため十分にスクロールさせる
    // (design-canvas が visibility 制御で lazy mount している可能性があるため)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);

    for (const t of TARGETS) {
      console.log(`▶ snapshot ${t.outFile} ← data-dc-slot="${t.dcSlot}"`);
      const locator = page.locator(`[data-dc-slot="${t.dcSlot}"]`);
      const count = await locator.count();
      if (count === 0) {
        console.warn(`⚠ data-dc-slot="${t.dcSlot}" が見つかりません (artboard 未マウント)`);
        continue;
      }
      // 該当要素を view 内にスクロールしてから撮影
      await locator.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await locator.first().screenshot({ path: resolve(OUT_DIR, t.outFile) });
    }

    console.log(`✅ handoff snapshots saved to ${OUT_DIR}`);
  } catch (e) {
    console.error('❌ snapshot 失敗:', e.message);
    await page.screenshot({ path: resolve(OUT_DIR, '99-error.png'), fullPage: false });
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
})();
