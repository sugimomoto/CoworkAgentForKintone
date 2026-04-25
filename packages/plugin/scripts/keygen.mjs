#!/usr/bin/env node
// Cowork Agent for kintone — 秘密鍵 (.ppk) 生成スクリプト
//
// .ppk は **プラグイン ID を決定する永続的な鍵** であり、紛失または再生成すると
// 既存インストール済みプラグインの更新ができなくなる。
//
// このスクリプトは安全のため:
//   1. 既存 .ppk があれば拒否する (誤再生成を防止)
//   2. --force / -f を渡した場合のみ上書き (バックアップを取った前提)

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const PPK_PATH = resolve('.keys/plugin.ppk');
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');

if (existsSync(PPK_PATH)) {
  if (!force) {
    console.error('\x1b[31m[Cowork Agent] .keys/plugin.ppk は既に存在します。\x1b[0m');
    console.error('');
    console.error('この .ppk はプラグイン ID を決定する永続的な鍵です。');
    console.error('再生成すると既存インストール済みプラグインが更新不能になります。');
    console.error('');
    console.error('意図的に再生成する場合は、まず既存 .ppk をバックアップしてから:');
    console.error('  pnpm plugin:keygen -- --force');
    process.exit(1);
  }
  console.warn('\x1b[33m[Cowork Agent] --force 指定。既存 .ppk を上書きします。\x1b[0m');
}

mkdirSync('.keys', { recursive: true });

const result = spawnSync(
  'cli-kintone',
  ['plugin', 'keygen', '--output', '.keys/plugin.ppk'],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('\x1b[31m[Cowork Agent] cli-kintone の起動に失敗しました。インストールされているか確認してください: npm install -g @kintone/cli\x1b[0m');
  process.exit(1);
}

process.exit(result.status ?? 1);
