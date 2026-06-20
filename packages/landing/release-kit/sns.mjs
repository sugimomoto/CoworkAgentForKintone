#!/usr/bin/env node
// sns.mjs — 統合スペックから SNS 投稿文 (X / 長文) のドラフトを生成して標準出力する。
//
//   node packages/landing/release-kit/sns.mjs <spec.json>
//
// 出力はドラフト。投稿前に文面を整える前提（X は文字数目安を表示する）。
// 使う情報: version / sns.tagline / sns.hashtags / url / repo / features[].snsText(||title)。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRODUCT = 'Cowork Agent for kintone';

const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: node sns.mjs <spec.json>');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf-8'));
if (!spec.version || !Array.isArray(spec.features)) {
  console.error('[sns] spec に version / features が必要です');
  process.exit(1);
}

const sns = spec.sns ?? {};
const notes = spec.notes ?? {};
const url = spec.url ?? '';
const repoUrl = spec.repo
  ? spec.repo.startsWith('http')
    ? spec.repo
    : `https://${spec.repo}`
  : '';
const tags = (sns.hashtags ?? []).map((t) => `#${t}`).join(' ');
const tagline = sns.tagline ?? '';

const EMOJI = { bell: '🔔', clock: '⏰', grid: '🧩', shield: '🛡️', wrench: '🔧', doc: '📄' };
const bullet = (f) => `${EMOJI[f.icon] ?? '•'} ${f.snsText ?? f.title}`;

// X の重み付き文字数の目安: 全角(CJK/かな等)=2、半角=1、URL は 23 固定。
function xWeight(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, '');
  const urlCount = (text.match(/https?:\/\/\S+/g) ?? []).length;
  let w = urlCount * 23;
  for (const ch of withoutUrls) {
    const c = ch.codePointAt(0);
    const wide =
      (c >= 0x3000 && c <= 0x30ff) || // CJK 記号・かな
      (c >= 0x3400 && c <= 0x9fff) || // 漢字
      (c >= 0xff00 && c <= 0xffef) || // 全角英数
      c >= 0x1f000; // 絵文字など
    w += wide ? 2 : 1;
  }
  return w;
}

// ── X (Twitter) ──
const xPost = [
  `🚀 ${PRODUCT} ${spec.version} をリリース！`,
  '',
  ...spec.features.map(bullet),
  '',
  `${tagline ? tagline + ' ' : ''}OSS / MIT`,
  url ? `▶ ${url}` : '',
  '',
  tags,
]
  .filter((l) => l !== undefined)
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// ── 長文 (note / Qiita / LinkedIn / Facebook など) ──
const longPost = [
  `${PRODUCT} ${spec.version} をリリースしました。`,
  '',
  notes.summary ?? '',
  '',
  '主な変更:',
  ...spec.features.map((f) => `${EMOJI[f.icon] ?? '•'} ${f.title} — ${f.desc}`),
  '',
  'OSS / MIT・無料でご利用いただけます。',
  url ? `🔗 リリースノート: ${url}` : '',
  repoUrl ? `🔗 リポジトリ: ${repoUrl}` : '',
  '',
  tags,
]
  .filter((l) => l !== undefined)
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const hr = '─'.repeat(60);
console.log(`${hr}\n■ X / Twitter  (重み目安 ${xWeight(xPost)} / 280)\n${hr}`);
console.log(xPost);
console.log(`\n${hr}\n■ 長文 (note / Qiita / LinkedIn / Facebook など)\n${hr}`);
console.log(longPost);
console.log(`\n${hr}\n※ ドラフトです。投稿前に文面を調整してください。`);
