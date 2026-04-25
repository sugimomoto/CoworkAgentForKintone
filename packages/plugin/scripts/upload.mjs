#!/usr/bin/env node
// Cowork Agent for kintone — ローカル開発用アップロードスクリプト
//
// 使い方:
//   pnpm plugin:upload
//
// 動作:
//   1. リポジトリルートの .env を読み込む (node --env-file 経由)
//   2. 必須環境変数を検証
//   3. cli-kintone plugin upload を呼び出す
//
// .env が読み込まれる場所:
//   package.json の upload スクリプトで `node --env-file=../../.env` を指定

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const REQUIRED = ['KINTONE_BASE_URL', 'KINTONE_USERNAME', 'KINTONE_PASSWORD'];
const ZIP_PATH = 'dist/plugin.zip';

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[31m[Cowork Agent] 必要な環境変数が未設定です: ${missing.join(', ')}[0m`);
  console.error('リポジトリルートに .env を作成してください:');
  console.error('  cp .env.example .env');
  console.error('  $EDITOR .env');
  process.exit(1);
}

if (!existsSync(ZIP_PATH)) {
  console.error(`[31m[Cowork Agent] ${ZIP_PATH} が見つかりません。先に \`pnpm plugin:pack\` を実行してください。[0m`);
  process.exit(1);
}

console.log(`[Cowork Agent] Uploading ${ZIP_PATH} to ${process.env.KINTONE_BASE_URL} ...`);

const result = spawnSync(
  'cli-kintone',
  [
    'plugin',
    'upload',
    '--base-url',
    process.env.KINTONE_BASE_URL,
    '--username',
    process.env.KINTONE_USERNAME,
    '--password',
    process.env.KINTONE_PASSWORD,
    '--input',
    ZIP_PATH,
    '--yes',
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('[31m[Cowork Agent] cli-kintone の起動に失敗しました。インストールされているか確認してください: npm install -g @kintone/cli[0m');
  process.exit(1);
}

process.exit(result.status ?? 1);
