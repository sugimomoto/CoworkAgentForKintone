#!/usr/bin/env node
// deploy-worker.mjs — Cloudflare Workers にバンドル済 Worker をデプロイ
//
// Plugin Config 画面の「Cloudflare Workers をデプロイ」ボタンと同じことを
// Node.js 環境 (= 自動デプロイフック) から実行できるようにする。
//
// 使い方 (リポジトリ root から):
//   pnpm worker:deploy
// もしくは直接:
//   node --env-file=.env packages/plugin/scripts/deploy-worker.mjs [--silent]
//
// 必須環境変数 (.env):
//   CLOUDFLARE_API_TOKEN   — Workers Scripts:Edit 権限を持つ API token
//   CLOUDFLARE_ACCOUNT_ID  — 対象 Cloudflare アカウントの Account ID
//
// 動作:
//   1. esbuild で kintone-mcp Worker を ESM バンドル
//   2. GET /accounts/{id}/workers/subdomain         — subdomain 取得
//   3. PUT /accounts/{id}/workers/scripts/{name}    — multipart で script アップロード
//   4. POST /accounts/{id}/workers/scripts/{name}/subdomain — workers.dev 有効化
//   5. https://<name>.<subdomain>.workers.dev を出力
//
// Plugin Config の cfDeploy.ts と同じ Cloudflare API 呼び出し手順を踏むが、
// kintone.proxy は使わず native fetch を使う。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

// この script は packages/plugin/scripts/ にあるので REPO_ROOT は 3 階層上
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const CF_BASE = 'https://api.cloudflare.com/client/v4';
const SCRIPT_NAME = 'cowork-agent-kintone-mcp';
const COMPATIBILITY_DATE = '2026-04-01';

const SILENT = process.argv.includes('--silent');

function log(msg) {
  if (!SILENT) console.log(`[deploy-worker] ${msg}`);
}
function fail(msg, exit = 1) {
  console.error(`[deploy-worker] ❌ ${msg}`);
  process.exit(exit);
}

// ----- 1. env チェック ------------------------------------------------------

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!apiToken) fail('CLOUDFLARE_API_TOKEN が未設定です (.env を確認)');
if (!accountId) fail('CLOUDFLARE_ACCOUNT_ID が未設定です (.env を確認)');

// ----- 2. Worker を esbuild で ESM バンドル ---------------------------------

async function bundleWorker() {
  const entry = resolve(REPO_ROOT, 'packages/kintone-mcp/src/index.ts');
  const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const buildVersion = `auto.${buildTime}`;
  const result = await esbuild.build({
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    loader: { '.ts': 'ts' },
    minify: true,
    sourcemap: false,
    write: false,
    logLevel: 'warning',
    entryPoints: [entry],
    define: {
      __BUILD_VERSION__: JSON.stringify(buildVersion),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
  });
  const text = result.outputFiles[0]?.text ?? '';
  if (!text) throw new Error('worker bundle is empty');
  return { text, buildVersion };
}

// ----- 3. Cloudflare API 呼び出しヘルパ ------------------------------------

async function cfFetch(path, init = {}) {
  const url = `${CF_BASE}${path}`;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    ...(init.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function getAccountSubdomain() {
  const { status, body } = await cfFetch(
    `/accounts/${encodeURIComponent(accountId)}/workers/subdomain`,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`failed to get subdomain (${status}): ${body}`);
  }
  const parsed = JSON.parse(body);
  if (!parsed.success || !parsed.result?.subdomain) {
    throw new Error(
      `Cloudflare account に workers.dev サブドメインが未設定です。Cloudflare Dashboard で 1 度設定してください: ${body}`,
    );
  }
  return parsed.result.subdomain;
}

async function uploadWorkerScript(workerJs) {
  const path = `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(
    SCRIPT_NAME,
  )}`;
  const form = new FormData();
  form.append(
    'metadata',
    new Blob(
      [
        JSON.stringify({
          main_module: 'worker.js',
          compatibility_date: COMPATIBILITY_DATE,
        }),
      ],
      { type: 'application/json' },
    ),
  );
  form.append(
    'worker.js',
    new Blob([workerJs], { type: 'application/javascript+module' }),
    'worker.js',
  );
  const res = await fetch(`${CF_BASE}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${apiToken}` },
    body: form,
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`failed to upload Worker (${res.status}): ${body}`);
  }
}

async function enableWorkersDev() {
  const path = `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(
    SCRIPT_NAME,
  )}/subdomain`;
  const { status, body } = await cfFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  if (status < 200 || status >= 300) {
    throw new Error(`failed to enable workers.dev (${status}): ${body}`);
  }
}

// ----- 4. main --------------------------------------------------------------

async function main() {
  log('bundling Worker...');
  const { text: workerJs, buildVersion } = await bundleWorker();
  log(`bundle size: ${workerJs.length} bytes (version=${buildVersion})`);

  log('fetching account subdomain...');
  const subdomain = await getAccountSubdomain();

  log(`uploading Worker to Cloudflare (script=${SCRIPT_NAME})...`);
  await uploadWorkerScript(workerJs);

  log('enabling workers.dev endpoint...');
  await enableWorkersDev();

  const workerUrl = `https://${SCRIPT_NAME}.${subdomain}.workers.dev`;
  log(`✅ deployed: ${workerUrl}`);
  // 呼出側 (auto-deploy script) で URL を拾うため stdout 末尾に出す
  console.log(workerUrl);
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
