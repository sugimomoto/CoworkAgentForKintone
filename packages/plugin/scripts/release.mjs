#!/usr/bin/env node
// release.mjs — プラグインの semver を bump し、Git commit + tag を作成
//
// 使い方:
//   pnpm plugin:release            # patch (default): 0.0.1 → 0.0.2
//   pnpm plugin:release:minor      # minor:           0.0.1 → 0.1.0
//   pnpm plugin:release:major      # major:           0.0.1 → 1.0.0
//
// 動作:
//   1. Git working tree が clean か確認 (汚れていれば中止)
//   2. packages/plugin/package.json の version を bump
//   3. git add packages/plugin/package.json
//   4. git commit -m "chore: release v<new>"
//   5. git tag "v<new>"
//   6. 次手順 (push) を案内

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const KIND = (process.argv[2] || 'patch').toLowerCase();
if (!['patch', 'minor', 'major'].includes(KIND)) {
  console.error(`\x1b[31m[Cowork Agent] 不明なリリース種別: ${KIND}\x1b[0m`);
  console.error('使い方: pnpm plugin:release [patch|minor|major]');
  process.exit(1);
}

const PKG_PATH = resolve('package.json');
const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!match) {
  console.error(`\x1b[31m[Cowork Agent] package.json の version が semver ではありません: ${pkg.version}\x1b[0m`);
  process.exit(1);
}
const [, majorStr, minorStr, patchStr] = match;
const [major, minor, patch] = [majorStr, minorStr, patchStr].map(Number);

let next;
if (KIND === 'major') next = `${major + 1}.0.0`;
else if (KIND === 'minor') next = `${major}.${minor + 1}.0`;
else next = `${major}.${minor}.${patch + 1}`;

// 1. Working tree clean check
const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf-8' });
if (status.status !== 0) {
  console.error('\x1b[31m[Cowork Agent] git status の取得に失敗しました\x1b[0m');
  process.exit(1);
}
const dirty = status.stdout.trim();
if (dirty) {
  console.error('\x1b[31m[Cowork Agent] Working tree に未コミットの変更があります。先にコミット/退避してください:\x1b[0m');
  console.error(dirty);
  process.exit(1);
}

// 2. Bump version
pkg.version = next;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
console.log(`[Cowork Agent] plugin version: ${major}.${minor}.${patch} → ${next}`);

// 3. git add
const add = spawnSync('git', ['add', PKG_PATH], { stdio: 'inherit' });
if (add.status !== 0) process.exit(add.status ?? 1);

// 4. git commit
const commitMsg = `chore: release v${next}`;
const commit = spawnSync('git', ['commit', '-m', commitMsg], { stdio: 'inherit' });
if (commit.status !== 0) process.exit(commit.status ?? 1);

// 5. git tag
const tagName = `v${next}`;
const tag = spawnSync('git', ['tag', tagName], { stdio: 'inherit' });
if (tag.status !== 0) process.exit(tag.status ?? 1);

// 6. Next steps
console.log('');
console.log(`\x1b[32m✅ Released ${tagName}\x1b[0m`);
console.log('');
console.log('次手順:');
console.log(`  git push origin main --tags`);
console.log('  → GitHub Actions が plugin.zip を自動ビルドし、Release に添付します');
