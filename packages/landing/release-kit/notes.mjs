#!/usr/bin/env node
// notes.mjs — 統合スペックから src/data/releases.ts に貼る Release エントリを生成して標準出力する。
//
//   node packages/landing/release-kit/notes.mjs <spec.json>
//
// 出力された TS オブジェクトを src/data/releases.ts の `releases` 配列の **先頭** に貼り付ける。
// （自動で書き換えはしない。内容を確認してから差し込むこと。）

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: node notes.mjs <spec.json>');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf-8'));
const notes = spec.notes ?? {};
if (!spec.version || !notes.title || !notes.summary || !Array.isArray(spec.features)) {
  console.error('[notes] spec に version / notes.title / notes.summary / features が必要です');
  process.exit(1);
}

// TS 文字列リテラル (シングルクォート)。' と \ をエスケープ。
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const lines = [];
lines.push('  {');
lines.push(`    version: ${q(spec.version)},`);
lines.push(`    date: ${q(spec.date ?? '')},`);
lines.push(`    tag: ${q(spec.tag ?? '')},`);
lines.push(`    title: ${q(notes.title)},`);
lines.push(`    summary:`);
lines.push(`      ${q(notes.summary)},`);
lines.push('    highlights: [');
for (const f of spec.features) {
  lines.push('      {');
  lines.push(`        icon: ${q(f.icon)},`);
  lines.push(`        title: ${q(f.title)},`);
  if (f.new) lines.push('        isNew: true,');
  lines.push(`        desc: ${q(f.desc)},`);
  lines.push('      },');
}
lines.push('    ],');
lines.push('  },');

console.log('// ↓ src/data/releases.ts の releases 配列 先頭に貼り付け');
console.log(lines.join('\n'));
