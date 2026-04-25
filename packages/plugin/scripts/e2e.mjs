#!/usr/bin/env node
// e2e.mjs — リポジトリルート .env を読み込んで Playwright を起動するラッパ
//
// pnpm plugin:e2e から呼ばれる:
//   1. `--env-file=../../.env` で KINTONE_BASE_URL / USERNAME / PASSWORD / TEST_APP_ID を注入
//   2. playwright test に追加引数を渡す
//
// 使い方:
//   pnpm plugin:e2e               # 全テスト実行
//   pnpm plugin:e2e -- smoke      # smoke spec だけ
//   pnpm plugin:e2e:ui            # UI モード

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, '..');
const playwrightBin = resolve(pluginRoot, 'node_modules', '.bin', 'playwright');

// `pnpm plugin:e2e:ui` の場合はサブコマンド `--ui` を補足
const extraArgs = process.argv.slice(2);
const baseArgs = ['test'];

if (process.env['COWORK_E2E_UI']) {
  baseArgs.push('--ui');
}

const result = spawnSync(playwrightBin, [...baseArgs, ...extraArgs], {
  cwd: pluginRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error('[e2e] playwright が見つかりません。`pnpm plugin:e2e:install` でインストールしてください:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
