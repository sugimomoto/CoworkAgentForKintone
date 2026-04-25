#!/usr/bin/env node
// deploy-app.mjs — kintone REST API でアプリ設定を運用環境に反映する
//
// 使い方:
//   pnpm plugin:app-deploy           # KINTONE_TEST_APP_ID をデプロイ
//   pnpm plugin:app-deploy 42        # 引数の APP ID をデプロイ

import { basicAuthHeader, deployAndWait } from './lib/kintone-deploy.mjs';

const baseUrl = process.env['KINTONE_BASE_URL'];
const username = process.env['KINTONE_USERNAME'];
const password = process.env['KINTONE_PASSWORD'];
const appIdArg = process.argv[2] ?? process.env['KINTONE_TEST_APP_ID'];

if (!baseUrl || !username || !password) {
  console.error('[deploy-app] KINTONE_BASE_URL / USERNAME / PASSWORD が未設定です。');
  console.error('  .env に登録するか、引数で渡してください。');
  process.exit(1);
}
if (!appIdArg) {
  console.error('[deploy-app] アプリ ID が指定されていません。');
  console.error('  使い方: pnpm plugin:app-deploy [APP_ID]');
  process.exit(1);
}

const appId = Number(appIdArg);

console.log(`[deploy-app] starting deploy for app ${appId}...`);
try {
  await deployAndWait({
    baseUrl,
    authHeader: basicAuthHeader(username, password),
    appId,
    onStatus: (status) => process.stdout.write(`  status: ${status}\r`),
  });
  console.log('\n\x1b[32m[deploy-app] ✅ deployed successfully\x1b[0m');
} catch (err) {
  console.error(`\n\x1b[31m[deploy-app] ${err.message}\x1b[0m`);
  process.exit(1);
}
