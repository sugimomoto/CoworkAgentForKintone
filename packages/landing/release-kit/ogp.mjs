#!/usr/bin/env node
// ogp.mjs — リリース告知 OGP カードを PNG 生成する (release-kit)
//
// 使い方:
//   node packages/landing/release-kit/ogp.mjs <spec.json> [--out <basePath>] [--no-2x] [--no-archive]
//
//   <spec.json>  : 統合スペック (README.md / examples 参照)。OGP は version / ogp.headline /
//                  ogp.sub / repo / features[] を使う（features は ogpTitle/ogpDesc を優先）。
//                  旧 OGP 専用スペック (トップレベル headline/sub) とも後方互換。
//   --out        : 出力ベースパス (拡張子なし)。既定 packages/landing/public/images/ogp
//                  → <base>.png (1200x630) と <base>@2x.png (2400x1260) を書き出す
//   --no-2x      : 1x のみ生成
//   --no-archive : バージョン別アーカイブを作らない (canonical の <base>.png のみ更新)
//
// 出力は 2 種:
//   (1) canonical  : <base>.png (+@2x)。これが live の og:image。毎回上書き = 常に最新。
//   (2) アーカイブ : <base のディレクトリ>/og/<version>.png (+@2x)。リリースごとに残す
//                    (上書きしない)。canonical を copy するだけ (再レンダリングしない)。
//                    履歴を残したいだけなので、--no-archive で抑止できる。
//
// icon: "bell" | "clock" | "grid" | "shield" | "wrench" | "doc"、または生 SVG 文字列 (26px/currentColor)。
// ogp.headline / ogp.sub は生 HTML 可。`\n` は <br> に変換。highlight=<span class="hl">…</span>、sub の強調=<b>…</b>。
//
// デザイン正本: ./reference/handoff.md と ./reference/ogp-update-1200x630.png。CSS は本ファイル内に固定で持つ。
// Playwright は packages/plugin の devDependency (@playwright/test) を createRequire で解決して使う。

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..'); // packages/landing/release-kit → repo root
const require = createRequire(resolve(repoRoot, 'packages/plugin/package.json'));

// ── args ──
const args = process.argv.slice(2);
const specPath = args.find((a) => !a.startsWith('--'));
if (!specPath) {
  console.error('usage: node render.mjs <spec.json> [--out <basePath>] [--no-2x]');
  process.exit(1);
}
const outIdx = args.indexOf('--out');
const outBase =
  outIdx >= 0 ? resolve(args[outIdx + 1]) : resolve(repoRoot, 'packages/landing/public/images/ogp');
const skip2x = args.includes('--no-2x');
const skipArchive = args.includes('--no-archive');

const spec = JSON.parse(readFileSync(resolve(specPath), 'utf-8'));
// 統合スペック対応: ogp.* を優先し、無ければトップレベル (旧 OGP 専用スペックと互換)。
const ogp = spec.ogp ?? {};
const headline = ogp.headline ?? spec.headline;
const sub = ogp.sub ?? spec.sub;
const repo = ogp.repo ?? spec.repo;
if (!spec.version || !headline || !Array.isArray(spec.features) || spec.features.length < 2) {
  console.error('[ogp] spec に version / (ogp.)headline / features(2〜3) が必要です');
  process.exit(1);
}

// ── helpers ──
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const rich = (s) => String(s ?? '').replace(/\n/g, '<br>'); // headline/sub は生 HTML 許可

// bell/clock/grid は CSS 図形、shield/wrench/doc は lucide 風インライン SVG (notes ページと共通)。
const SVG_ICONS = {
  shield: '<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  wrench:
    '<path d="M14.7 6.3a4 4 0 0 0-5.2 5L4 16.8 7.2 20l5.5-5.5a4 4 0 0 0 5-5.2l-2.6 2.6-2.1-.5-.5-2.1z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
};

function iconHtml(icon) {
  if (icon === 'bell')
    return '<span class="i-bell"><span class="b"></span><span class="r"></span><span class="c"></span></span>';
  if (icon === 'clock') return '<span class="i-clock"></span>';
  if (icon === 'grid') return '<span class="i-grid"><b></b><b></b><b></b><b></b></span>';
  if (typeof icon === 'string' && icon.trim().startsWith('<svg')) return icon;
  if (SVG_ICONS[icon])
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG_ICONS[icon]}</svg>`;
  return '<span class="i-grid"><b></b><b></b><b></b><b></b></span>'; // fallback
}

function featHtml(f, i) {
  const lead = f.lead ?? i === 0;
  const title = f.ogpTitle ?? f.title; // OGP は短い copy を優先
  const desc = f.ogpDesc ?? f.desc;
  const badge = f.new ? ' <span class="new">NEW</span>' : '';
  const chips =
    f.chips && f.chips.length
      ? `<div class="plats">${f.chips
          .map((c) => `<span><i style="background:${esc(c.color)}"></i>${esc(c.label)}</span>`)
          .join('')}</div>`
      : '';
  const spark = lead ? '<div class="spark" style="right:-8px; top:-8px;"></div>' : '';
  return `<div class="feat${lead ? ' lead' : ''}">
        <span class="ico">${iconHtml(f.icon)}</span>
        <div class="tx">
          <div class="tt">${esc(title)}${badge}</div>
          <div class="dd">${esc(desc)}</div>
          ${chips}
        </div>
        ${spark}
      </div>`;
}

const STYLE = `
  :root{
    --bg:#faf8f3; --bg-alt:#f4f0e7; --bg-deep:#efe9dc; --card:#ffffff;
    --ink:#231200; --muted:#6b5f4a; --subtle:#a89d85;
    --border:rgba(35,18,0,0.10); --border-strong:rgba(35,18,0,0.16);
    --accent:#0d9488; --accent-deep:#0a766c; --accent-soft:rgba(13,148,136,0.10); --accent-line:rgba(13,148,136,0.22);
    --ok:#15803d; --warn:#b45309;
    --kt-header:#3a2f24; --kt-amber:#ffbf00;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  html,body{background:#0b0b0b;}
  .stage{
    position:absolute; top:0; left:0;
    width:1200px; height:630px;
    font-family:'Noto Sans JP','Hiragino Sans',sans-serif;
    color:var(--ink); background:var(--bg); overflow:hidden;
  }
  .mono{font-family:'JetBrains Mono',monospace; font-feature-settings:'tnum';}
  .stage::before{
    content:''; position:absolute; inset:0; pointer-events:none;
    background:
      radial-gradient(44% 54% at 92% 4%, rgba(13,148,136,0.09), transparent 70%),
      radial-gradient(40% 44% at 2% 98%, rgba(255,191,0,0.07), transparent 70%);
  }
  .stage::after{
    content:''; position:absolute; inset:0; pointer-events:none; opacity:0.55;
    background:radial-gradient(circle at 1px 1px, rgba(35,18,0,0.045) 1px, transparent 0) 0 0/ 26px 26px;
    -webkit-mask-image:radial-gradient(74% 80% at 80% 50%, #000 0%, transparent 74%);
            mask-image:radial-gradient(74% 80% at 80% 50%, #000 0%, transparent 74%);
  }
  .safe{
    position:absolute; inset:0; z-index:2;
    display:grid; grid-template-columns:454px 1fr; align-items:center; gap:50px;
    padding:80px 90px;
  }
  .left{ min-width:0; display:flex; flex-direction:column; height:100%; justify-content:center; }
  .brand{ display:flex; align-items:center; gap:13px; margin-bottom:30px; }
  .brand .mk{
    width:44px; height:44px; border-radius:11px; background:var(--accent); flex:none;
    display:inline-flex; align-items:center; justify-content:center;
    color:#fff; font-weight:800; font-size:18px; box-shadow:0 4px 14px rgba(13,148,136,0.28);
  }
  .brand .wm{ font-size:23px; font-weight:700; letter-spacing:-0.02em; line-height:1.1; white-space:nowrap; }
  .brand .wm .ag{ color:var(--accent); }
  .brand .wm .for{ color:var(--subtle); font-weight:600; }
  .rel{ display:inline-flex; align-items:center; gap:9px; margin-bottom:20px; }
  .rel .whats{
    display:inline-flex; align-items:center; gap:8px; white-space:nowrap;
    font-size:12.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;
    color:var(--accent-deep); background:var(--accent-soft);
    padding:6px 13px; border-radius:999px;
  }
  .rel .whats .dot{ width:7px; height:7px; border-radius:50%; background:var(--accent); }
  .rel .ver{
    font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:700; letter-spacing:0.02em;
    color:#3a2f24; background:var(--kt-amber);
    padding:5px 11px; border-radius:8px; white-space:nowrap;
    box-shadow:0 3px 10px rgba(255,191,0,0.35);
  }
  .headline{
    font-size:50px; font-weight:700; letter-spacing:-0.035em; line-height:1.16;
    text-wrap:balance; margin-bottom:22px;
  }
  .headline .hl{ color:var(--accent); }
  .sub{ font-size:16px; color:var(--muted); line-height:1.6; margin-bottom:26px; max-width:400px; text-wrap:pretty; }
  .sub b{ color:var(--ink); font-weight:600; }
  .foot{ display:flex; align-items:center; gap:11px; flex-wrap:nowrap; }
  .foot .lic{
    font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; letter-spacing:0.03em; flex:none;
    color:var(--accent-deep); background:var(--accent-soft); padding:4px 10px; border-radius:6px; white-space:nowrap;
  }
  .foot .repo{ font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--subtle); white-space:nowrap; }
  .feats{ display:flex; flex-direction:column; gap:14px; }
  .feat{
    position:relative;
    display:flex; align-items:center; gap:16px;
    background:var(--card); border:1px solid var(--border);
    border-radius:16px; padding:17px 19px;
    box-shadow:0 10px 30px rgba(35,18,0,0.07), 0 2px 6px rgba(35,18,0,0.04);
  }
  .feat.lead{ border-color:var(--accent-line); box-shadow:0 16px 38px rgba(13,148,136,0.12), 0 2px 6px rgba(35,18,0,0.05); }
  .feat .ico{
    width:54px; height:54px; border-radius:13px; flex:none;
    background:var(--accent-soft); color:var(--accent-deep);
    display:flex; align-items:center; justify-content:center; position:relative;
  }
  .feat.lead .ico{ background:var(--accent); color:#fff; }
  .feat .tx{ min-width:0; flex:1; }
  .feat .tt{ font-size:20px; font-weight:700; letter-spacing:-0.01em; line-height:1.2; display:flex; align-items:center; gap:9px; }
  .feat .dd{ font-size:13.5px; color:var(--muted); line-height:1.5; margin-top:4px; text-wrap:pretty; }
  .feat .new{
    font-size:10px; font-weight:800; letter-spacing:0.06em; color:#3a2f24;
    background:var(--kt-amber); padding:2px 8px; border-radius:999px; white-space:nowrap;
  }
  .plats{ display:flex; gap:6px; margin-top:9px; }
  .plats span{
    font-size:10.5px; font-weight:600; color:var(--muted);
    padding:3px 10px 3px 8px; border-radius:999px;
    background:var(--bg-alt); border:1px solid var(--border);
    display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  }
  .plats span i{ width:8px; height:8px; border-radius:2px; flex:none; }
  .i-bell{ position:relative; width:24px; height:24px; }
  .i-bell .b{ position:absolute; left:3px; top:2px; width:18px; height:16px; border:2.4px solid currentColor; border-radius:11px 11px 7px 7px; border-bottom:none; }
  .i-bell .r{ position:absolute; left:5px; bottom:3px; right:5px; height:2.4px; background:currentColor; border-radius:2px; }
  .i-bell .c{ position:absolute; left:9.5px; bottom:-1px; width:5px; height:5px; border-radius:50%; background:currentColor; }
  .i-clock{ width:26px; height:26px; border:2.4px solid currentColor; border-radius:50%; position:relative; }
  .i-clock::before{ content:''; position:absolute; left:50%; top:6px; width:2.2px; height:7px; background:currentColor; border-radius:2px; transform:translateX(-50%); }
  .i-clock::after{ content:''; position:absolute; left:50%; top:50%; width:7px; height:2.2px; background:currentColor; border-radius:2px; transform:translate(-1px,-50%); }
  .i-grid{ width:24px; height:24px; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:4px; }
  .i-grid b{ background:currentColor; border-radius:4px; opacity:0.9; }
  .i-grid b:nth-child(1){ opacity:1; }
  .i-grid b:nth-child(4){ opacity:0.55; }
  .spark{
    position:absolute; z-index:6; width:16px; height:16px; border-radius:50%; background:var(--kt-amber);
    box-shadow:0 0 0 5px rgba(255,191,0,0.18), 0 4px 12px rgba(255,191,0,0.45);
  }
`;

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style></head>
<body>
  <div class="stage" id="card">
    <div class="safe">
      <div class="left">
        <div class="brand">
          <span class="mk">CA</span>
          <div class="wm">Cowork <span class="ag">Agent</span> <span class="for">for kintone</span></div>
        </div>
        <div class="rel">
          <span class="whats"><span class="dot"></span>What's New</span>
          <span class="ver">${esc(spec.version)}</span>
        </div>
        <h1 class="headline">${rich(headline)}</h1>
        ${sub ? `<p class="sub">${rich(sub)}</p>` : ''}
        <div class="foot">
          <span class="lic">OSS / MIT</span>
          ${repo ? `<span class="repo">${esc(repo)}</span>` : ''}
        </div>
      </div>
      <div class="feats">
        ${spec.features.slice(0, 3).map(featHtml).join('\n        ')}
      </div>
    </div>
  </div>
</body></html>`;

// ── render ──
const { chromium } = require('@playwright/test');

async function shoot(scale, outPath) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: scale,
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({ path: outPath });
  } finally {
    await browser.close();
  }
}

mkdirSync(dirname(outBase), { recursive: true });
await shoot(1, `${outBase}.png`);
console.log(`[ogp] wrote ${outBase}.png (1200x630)  ← canonical (og:image)`);
if (!skip2x) {
  await shoot(2, `${outBase}@2x.png`);
  console.log(`[ogp] wrote ${outBase}@2x.png (2400x1260)`);
}

// バージョン別アーカイブ: canonical を <dir>/og/<version>.png に複製して履歴を残す
// (再レンダリングせず copy)。--no-archive で抑止。--out で直接 og/ を指していれば二重化を避ける。
if (!skipArchive) {
  const archiveBase = resolve(dirname(outBase), 'og', spec.version);
  if (archiveBase !== outBase) {
    mkdirSync(dirname(archiveBase), { recursive: true });
    copyFileSync(`${outBase}.png`, `${archiveBase}.png`);
    console.log(`[ogp] archived ${archiveBase}.png`);
    if (!skip2x) {
      copyFileSync(`${outBase}@2x.png`, `${archiveBase}@2x.png`);
      console.log(`[ogp] archived ${archiveBase}@2x.png`);
    }
  }
}
console.log('[ogp] done');
