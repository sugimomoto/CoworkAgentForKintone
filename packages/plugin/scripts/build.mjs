#!/usr/bin/env node
// build.mjs — プラグインの完全ビルド
//
//   1. manifest.json の build 番号を +1 (kintone 側の単調増加要件)
//   2. src/desktop/index.tsx → plugin/js/desktop.js (esbuild / IIFE)
//   3. src/config/index.tsx  → plugin/js/config.js  (esbuild / IIFE)
//   4. src/styles/global.css + Tailwind → plugin/css/desktop.css
//   5. plugin/css/config.css は簡易 (グローバルスタイル共通)
//
// 出力先 plugin/js/* と plugin/css/desktop.css は .gitignore で除外 (生成物)

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as esbuild from 'esbuild';

const MANIFEST_PATH = resolve('plugin/manifest.json');
const JS_OUT_DIR = resolve('plugin/js');
const CSS_OUT_DIR = resolve('plugin/css');

// ----- 1. manifest.json の build 番号を +1 ---------------------------------
function bumpBuildNumber() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const old = Number(manifest.version);
  if (!Number.isInteger(old) || old < 1) {
    throw new Error(`manifest.json の version が整数ではありません: ${manifest.version}`);
  }
  manifest.version = old + 1;
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[build] manifest.json version (build): ${old} → ${manifest.version}`);
  return manifest.version;
}

// ----- 2-3. esbuild で 2 エントリを IIFE バンドル ---------------------------
async function bundleJs() {
  mkdirSync(JS_OUT_DIR, { recursive: true });

  const commonOptions = {
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    jsx: 'automatic',
    loader: { '.ts': 'ts', '.tsx': 'tsx' },
    minify: true,
    sourcemap: false,
    logLevel: 'warning',
  };

  await esbuild.build({
    ...commonOptions,
    entryPoints: ['src/desktop/index.tsx'],
    outfile: resolve(JS_OUT_DIR, 'desktop.js'),
  });
  console.log('[build] plugin/js/desktop.js generated');

  await esbuild.build({
    ...commonOptions,
    entryPoints: ['src/config/index.tsx'],
    outfile: resolve(JS_OUT_DIR, 'config.js'),
  });
  console.log('[build] plugin/js/config.js generated');
}

// ----- 4-5. Tailwind CSS ビルド --------------------------------------------
function buildCss() {
  mkdirSync(CSS_OUT_DIR, { recursive: true });

  // desktop 用 CSS (グローバル + Tailwind)
  const desktopOut = resolve(CSS_OUT_DIR, 'desktop.css');
  const result = spawnSync(
    'tailwindcss',
    [
      '-i',
      'src/styles/global.css',
      '-o',
      desktopOut,
      '--minify',
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`tailwindcss build failed with exit ${result.status}`);
  }
  console.log('[build] plugin/css/desktop.css generated');

  // config 画面も同じスタイルを使う (小さいのでコピー)
  const contents = readFileSync(desktopOut, 'utf-8');
  writeFileSync(resolve(CSS_OUT_DIR, 'config.css'), contents);
  console.log('[build] plugin/css/config.css generated');
}

// ----- main ----------------------------------------------------------------
async function main() {
  bumpBuildNumber();
  await bundleJs();
  buildCss();
  console.log('[build] done');
}

main().catch((err) => {
  console.error('[build] failed:', err);
  process.exit(1);
});
