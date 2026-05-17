#!/usr/bin/env node
// snapshot-diff.mjs — dist/snapshots/{impl,handoff}/ を横並びで比較する HTML を生成
//
// 動作:
//   1. dist/snapshots/impl/*.png と dist/snapshots/handoff/*.png をリスト
//   2. 同じファイル名で対応付け
//   3. dist/snapshots/diff.html に左右 2 列の比較ページを書き出す
//   4. ブラウザで diff.html を開くと「左: 実装 / 右: ハンドオフ」が並ぶ
//
// 使い方:
//   pnpm --filter @cowork-agent/plugin run snapshot:diff

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAP_ROOT = resolve(__dirname, '..', 'dist', 'snapshots');
const IMPL_DIR = resolve(SNAP_ROOT, 'impl');
const HANDOFF_DIR = resolve(SNAP_ROOT, 'handoff');
const OUT = resolve(SNAP_ROOT, 'diff.html');

function listPngs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png') && !f.startsWith('99-'))
    .sort();
}

const implFiles = listPngs(IMPL_DIR);
const handoffFiles = new Set(listPngs(HANDOFF_DIR));
const allFiles = [...new Set([...implFiles, ...handoffFiles])].sort();

const rows = allFiles
  .map((name) => {
    const implSrc = implFiles.includes(name) ? `impl/${name}` : null;
    const handoffSrc = handoffFiles.has(name) ? `handoff/${name}` : null;
    return { name, implSrc, handoffSrc };
  });

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Cowork Agent — snapshot diff (impl vs handoff)</title>
  <style>
    :root {
      --bg: #faf8f3;
      --text: #231200;
      --muted: #6b5f4a;
      --border: rgba(35,18,0,0.1);
      --accent: #0d9488;
    }
    body { margin: 0; padding: 24px; background: var(--bg); color: var(--text); font-family: 'Hiragino Sans', sans-serif; font-size: 13px; line-height: 1.5; }
    h1 { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .lead { color: var(--muted); margin-bottom: 24px; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-bottom: 40px; align-items: start; }
    .panel { background: white; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .panel h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--muted); padding: 8px 12px; background: rgba(35,18,0,0.04); border-bottom: 1px solid var(--border); margin: 0; }
    .panel img { display: block; width: 100%; height: auto; }
    .panel .missing { padding: 80px 12px; text-align: center; color: var(--muted); font-style: italic; }
    .row-header { grid-column: 1 / -1; font-size: 14px; font-weight: 600; color: var(--accent); padding-top: 8px; }
    .footer { margin-top: 48px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--border); padding-top: 12px; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 1px 5px; background: rgba(35,18,0,0.06); border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Cowork Agent — UI snapshot diff</h1>
  <p class="lead">
    左: 実装版 (<code>dist/snapshots/impl/</code>) ／ 右: デザインハンドオフ (<code>dist/snapshots/handoff/</code>) を並べた目視比較ページ。<br>
    再生成: <code>pnpm --filter @cowork-agent/plugin run snapshot:all</code>
  </p>

  ${rows
    .map(
      (r) => `
  <div class="row-header">📷 ${r.name}</div>
  <div class="row">
    <div class="panel">
      <h2>実装 (impl)</h2>
      ${r.implSrc ? `<img src="${r.implSrc}" alt="impl ${r.name}">` : `<div class="missing">未撮影</div>`}
    </div>
    <div class="panel">
      <h2>ハンドオフ (handoff)</h2>
      ${r.handoffSrc ? `<img src="${r.handoffSrc}" alt="handoff ${r.name}">` : `<div class="missing">未撮影</div>`}
    </div>
  </div>`,
    )
    .join('\n')}

  <div class="footer">
    Generated: ${new Date().toISOString()}<br>
    実装側: <code>scripts/snapshot-wedge.mjs</code> ／ ハンドオフ側: <code>scripts/snapshot-handoff.mjs</code> ／ 本 HTML: <code>scripts/snapshot-diff.mjs</code>
  </div>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');
console.log(`✅ diff page generated: ${OUT}`);
console.log(`   open it: open ${OUT}`);
