#!/usr/bin/env node
// kintone カスタマイズ REST API 挙動検証スクリプト (#20 V2 設計のため)
//
// 目的:
//   Customizer wedge 実用化の設計を確定する前に、kintone REST API で
//   ローカル JS → kintone への upload → customize.json 反映 → deploy → revert
//   までの一連挙動を実機検証する。
//
// 使い方:
//   node --env-file=.env scripts/verify-customize-rest-api.mjs <step>
//
//   step:
//     1-show       現在の customize.json を取得 (preview / live 両方)
//     2-upload     ローカル JS を /k/v1/file.json で upload → fileKey
//     3-attach     fileKey を preview customize.json に追加して PUT
//     4-deploy     preview を本番に反映 (deploy.json)
//     5-revert     直前の deploy を取消 (deploy.json {revert: true})
//     6-cleanup    customize.json から本検証で追加したエントリを削除
//     all          1 → 2 → 3 → 4 を順に実行 (revert は手動で 5 を呼ぶ)
//
// 必要 env (.env):
//   KINTONE_BASE_URL      例: https://2kzzfr8gc3l6.cybozu.com
//   KINTONE_USERNAME      Basic 認証ユーザ
//   KINTONE_PASSWORD      Basic 認証パスワード
//   KINTONE_TEST_APP_ID   検証対象アプリ ID (= テスト用、本番アプリ NG)
//
// 注意: 検証対象アプリは **本番影響のないテスト用アプリ** にすること。
//       本スクリプトは preview を上書きするため、admin が手動で当該アプリに
//       他のカスタマイズを設定中の場合は競合する。

import { Buffer } from 'node:buffer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env['KINTONE_BASE_URL'];
const USERNAME = process.env['KINTONE_USERNAME'];
const PASSWORD = process.env['KINTONE_PASSWORD'];
const APP_ID = process.env['KINTONE_TEST_APP_ID'];

if (!BASE_URL || !USERNAME || !PASSWORD || !APP_ID) {
  console.error('❌ .env に KINTONE_BASE_URL / KINTONE_USERNAME / KINTONE_PASSWORD / KINTONE_TEST_APP_ID が必要です');
  process.exit(1);
}

const AUTH = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
const OUT_DIR = resolve('scripts/.verify-output');
mkdirSync(OUT_DIR, { recursive: true });

const VERIFY_MARKER = '__cowork-agent-verify__';
const SAMPLE_JS = `// ${VERIFY_MARKER} — REST API 検証用カスタマイズ
// kintone レコード一覧画面を開いたら console.log するだけのシンプルなカスタマイズ。
// このコメントを含むかどうかで「本検証で追加された JS かどうか」を判定する。
(function () {
  'use strict';
  kintone.events.on('app.record.index.show', function (event) {
    console.log('[${VERIFY_MARKER}] レコード一覧画面が表示されました', {
      appId: event.appId,
      records: event.records.length,
    });
    return event;
  });
})();
`;

const HEADERS = {
  // kintone はパスワード認証に独自ヘッダ X-Cybozu-Authorization を要求する
  'X-Cybozu-Authorization': AUTH,
};

/** kintone REST API を呼ぶ薄いラッパー */
async function api(method, path, body, extraHeaders = {}) {
  const url = `${BASE_URL}${path}`;
  const init = {
    method,
    headers: { ...HEADERS, ...extraHeaders },
  };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
    if (!(body instanceof FormData)) {
      init.headers['Content-Type'] = 'application/json';
    }
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, body: json };
}

/** Step 1: 現在の customize.json を preview / live 両方取得 */
async function showCustomize() {
  console.log('\n=== STEP 1: 現状の customize.json ===');
  for (const variant of ['preview', 'live']) {
    const path = variant === 'preview'
      ? `/k/v1/preview/app/customize.json?app=${APP_ID}`
      : `/k/v1/app/customize.json?app=${APP_ID}`;
    const r = await api('GET', path);
    console.log(`\n--- [${variant}] GET ${path} → HTTP ${r.status}`);
    console.log(JSON.stringify(r.body, null, 2));
    writeFileSync(resolve(OUT_DIR, `01-customize-${variant}.json`), JSON.stringify(r.body, null, 2));
  }
}

/** Step 2: ローカル JS を /k/v1/file.json で upload */
async function uploadFile() {
  console.log('\n=== STEP 2: /k/v1/file.json でアップロード ===');
  const form = new FormData();
  const blob = new Blob([SAMPLE_JS], { type: 'application/javascript' });
  form.append('file', blob, 'cowork-agent-verify.js');
  const r = await api('POST', '/k/v1/file.json', form);
  console.log(`POST /k/v1/file.json → HTTP ${r.status}`);
  console.log(JSON.stringify(r.body, null, 2));
  if (r.ok && r.body.fileKey) {
    writeFileSync(resolve(OUT_DIR, '02-fileKey.txt'), r.body.fileKey);
    console.log(`\n✅ fileKey 保存: ${OUT_DIR}/02-fileKey.txt`);
    console.log(`   ${r.body.fileKey}`);
  }
  return r.body.fileKey;
}

/** Step 3: fileKey を preview customize.json の desktop.js[] に追加して PUT */
async function attachFile(fileKey) {
  console.log('\n=== STEP 3: preview customize.json に attach (PUT) ===');
  // 現状取得
  const cur = await api('GET', `/k/v1/preview/app/customize.json?app=${APP_ID}`);
  if (!cur.ok) {
    console.error('現状取得に失敗:', cur.body);
    process.exit(1);
  }
  const next = {
    app: Number(APP_ID),
    scope: cur.body.scope ?? 'ALL',
    desktop: {
      js: [
        ...(cur.body.desktop?.js ?? []),
        { type: 'FILE', file: { fileKey } },
      ],
      css: cur.body.desktop?.css ?? [],
    },
    mobile: {
      js: cur.body.mobile?.js ?? [],
    },
    revision: cur.body.revision ?? '-1',
  };
  console.log('PUT body:', JSON.stringify(next, null, 2));
  const r = await api('PUT', '/k/v1/preview/app/customize.json', next);
  console.log(`\nPUT /k/v1/preview/app/customize.json → HTTP ${r.status}`);
  console.log(JSON.stringify(r.body, null, 2));
  writeFileSync(resolve(OUT_DIR, '03-attach-resp.json'), JSON.stringify(r.body, null, 2));
  return r.ok;
}

/** Step 4: preview を本番に反映 */
async function deploy() {
  console.log('\n=== STEP 4: deploy (preview → live) ===');
  const r = await api('POST', '/k/v1/preview/app/deploy.json', {
    apps: [{ app: Number(APP_ID) }],
  });
  console.log(`POST /k/v1/preview/app/deploy.json → HTTP ${r.status}`);
  console.log(JSON.stringify(r.body, null, 2));

  // deploy status をポーリング
  console.log('\n--- deploy status をポーリング ---');
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const s = await api('GET', `/k/v1/preview/app/deploy.json?apps[0]=${APP_ID}`);
    const status = s.body.apps?.[0]?.status;
    console.log(`  [${i + 1}/30] status=${status}`);
    if (status === 'SUCCESS' || status === 'FAIL' || status === 'CANCEL') {
      writeFileSync(resolve(OUT_DIR, '04-deploy-final.json'), JSON.stringify(s.body, null, 2));
      break;
    }
  }
}

/** Step 5: 直前 deploy を revert */
async function revertDeploy() {
  console.log('\n=== STEP 5: revert (直前 deploy を取消) ===');
  const r = await api('POST', '/k/v1/preview/app/deploy.json', {
    apps: [{ app: Number(APP_ID) }],
    revert: true,
  });
  console.log(`POST /k/v1/preview/app/deploy.json {revert:true} → HTTP ${r.status}`);
  console.log(JSON.stringify(r.body, null, 2));
  writeFileSync(resolve(OUT_DIR, '05-revert-resp.json'), JSON.stringify(r.body, null, 2));
}

/** Step 6: customize.json から本検証で追加したエントリ (name 一致) を削除 (preview) */
async function cleanup() {
  console.log('\n=== STEP 6: customize.json から検証エントリ (name=cowork-agent-verify.js) を除去 ===');
  // 重要: customize.json 内の fileKey は 49 桁 hex で kintone 内部 ID に変換されているため
  //       upload 時の UUID (file.json レスポンスの fileKey) では一致しない。
  //       name ベースで filter する。
  const TARGET_NAME = 'cowork-agent-verify.js';

  const cur = await api('GET', `/k/v1/preview/app/customize.json?app=${APP_ID}`);
  if (!cur.ok) {
    console.error('現状取得失敗:', cur.body);
    return;
  }
  const filterByName = (entries) =>
    (entries ?? []).filter((e) => {
      if (e.type !== 'FILE') return true;
      return e.file?.name !== TARGET_NAME;
    });

  const next = {
    app: Number(APP_ID),
    scope: cur.body.scope ?? 'ALL',
    desktop: {
      js: filterByName(cur.body.desktop?.js),
      css: filterByName(cur.body.desktop?.css),
    },
    mobile: { js: filterByName(cur.body.mobile?.js) },
    revision: cur.body.revision ?? '-1',
  };
  console.log('PUT body (clean):', JSON.stringify(next, null, 2));
  const r = await api('PUT', '/k/v1/preview/app/customize.json', next);
  console.log(`PUT → HTTP ${r.status}`);
  console.log(JSON.stringify(r.body, null, 2));

  console.log('\n→ deploy で本番反映してください (4-deploy を再度呼ぶ)');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── CLI dispatch ─────────────────────────────────────────────────────────

const step = process.argv[2];
switch (step) {
  case '1-show':
  case '1':
    await showCustomize();
    break;
  case '2-upload':
  case '2':
    await uploadFile();
    break;
  case '3-attach':
  case '3': {
    const fileKey = (await import('node:fs')).readFileSync(resolve(OUT_DIR, '02-fileKey.txt'), 'utf8').trim();
    await attachFile(fileKey);
    break;
  }
  case '4-deploy':
  case '4':
    await deploy();
    break;
  case '5-revert':
  case '5':
    await revertDeploy();
    break;
  case '6-cleanup':
  case '6':
    await cleanup();
    break;
  case 'all': {
    await showCustomize();
    const fileKey = await uploadFile();
    if (!fileKey) {
      console.error('❌ fileKey 取得失敗、中断');
      process.exit(1);
    }
    await attachFile(fileKey);
    await deploy();
    console.log('\n✅ 全 step 完了。動作確認後に revert したい場合は:');
    console.log(`   pnpm verify:customize 5-revert`);
    break;
  }
  default:
    console.log(
      'usage: node --env-file=.env scripts/verify-customize-rest-api.mjs <step>\n' +
        '\n' +
        '  step:\n' +
        '    1-show       現在の customize.json (preview / live) 表示\n' +
        '    2-upload     ローカル JS を /k/v1/file.json で upload\n' +
        '    3-attach     fileKey を preview customize.json に追加 (PUT)\n' +
        '    4-deploy     preview を本番反映 (deploy.json)\n' +
        '    5-revert     直前 deploy を取消 (deploy.json {revert: true})\n' +
        '    6-cleanup    customize.json から検証 fileKey を除去\n' +
        '    all          1 → 2 → 3 → 4 を順に実行\n',
    );
}
