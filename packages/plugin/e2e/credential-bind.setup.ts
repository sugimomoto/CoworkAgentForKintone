// kintone OAuth バインディングを自動化する setup spec (Phase 1b-3)。
//
// 仕組み:
//   1. レコード一覧画面を開いて ChatPanel をマウント
//   2. 既に bound (Composer 表示済) なら何もしない (idempotent)
//   3. unbound なら ConnectKintoneButton をクリック → popup を開く
//   4. popup 内で cybozu OAuth 同意画面を「許可」クリック
//      (storageState で kintone ログイン済のため、ログイン画面は出ない)
//   5. popup が Worker /oauth/callback に遷移、postMessage で opener に code 転送
//      → window.close()
//   6. メイン画面で Composer が表示されるのを待つ (= bound 完了)
//
// 一度成功すれば Anthropic Vault に Credential が残るため、以降の実行は Step 2 で skip。

import { test as setup, expect, type Page } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'];
const FORCE_REBIND = process.env['COWORK_E2E_FORCE_REBIND'] === '1';

const POPUP_TIMEOUT = 15_000;
const BIND_TIMEOUT = 60_000;

setup('kintone OAuth バインディング (idempotent / FORCE_REBIND 対応)', async ({ page, context }, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定');

  setup.setTimeout(180_000);

  // FORCE_REBIND モード: 既存 Vault Credential をすべて archive してから OAuth flow を実行
  if (FORCE_REBIND) {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('COWORK_E2E_FORCE_REBIND=1 のときは ANTHROPIC_API_KEY が必要です');
    }
    await archiveAllPluginVaults(ANTHROPIC_API_KEY);
  }

  await page.goto(`/k/${APP_ID}/`);
  const root = page.locator('#cowork-agent-root');
  await expect(root).toBeAttached({ timeout: 15_000 });

  // bound か unbound かを判定: どちらが先に visible になるか競争させる
  const composer = root.getByPlaceholder(/このアプリ|レコード/);
  const connectButton = root.getByTestId('connect-kintone-button');

  const state = await Promise.race([
    composer.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'bound' as const),
    connectButton.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'unbound' as const),
  ]).catch(() => null);

  if (state === 'bound') {
    // 既にバインド済 → 何もしない
    return;
  }
  if (state !== 'unbound') {
    throw new Error('ChatPanel が ready 状態になりません (Composer / ConnectKintoneButton どちらも非表示)');
  }

  // popup を待ち受けつつクリック
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: POPUP_TIMEOUT }),
    connectButton.click(),
  ]);

  await handleConsent(popup);

  // popup が閉じる (postMessage 後に自動 close)
  await popup.waitForEvent('close', { timeout: BIND_TIMEOUT });

  // メイン画面で bound 完了を待つ
  await expect(composer).toBeVisible({ timeout: BIND_TIMEOUT });
});

/**
 * popup 内で cybozu OAuth 同意画面の「許可」/「Authorize」ボタンを押す。
 * 同意済みのケースでは画面が即時 callback にリダイレクトされ、ボタンが表示されない。
 */
async function handleConsent(popup: Page): Promise<void> {
  // popup の遷移完了を待つ (cybozu の認可画面 or 直接 callback)
  await popup.waitForLoadState('domcontentloaded', { timeout: POPUP_TIMEOUT });

  // 既に Worker /oauth/callback に到達しているなら同意は済 (skip)
  const url = new URL(popup.url());
  if (url.pathname === '/oauth/callback') {
    return;
  }

  // 同意画面の「許可」/「Authorize」ボタンを探してクリック
  const allowJa = popup.getByRole('button', { name: /許可/ });
  const allowEn = popup.getByRole('button', { name: /Authorize|Allow/i });

  const button = (await allowJa.first().isVisible({ timeout: 5_000 }).catch(() => false))
    ? allowJa.first()
    : (await allowEn.first().isVisible({ timeout: 5_000 }).catch(() => false))
      ? allowEn.first()
      : null;

  if (button) {
    await button.click();
  }
  // クリック後は Worker /oauth/callback にリダイレクトされ、postMessage 後に自動 close する
}

/**
 * COWORK_E2E_FORCE_REBIND モード用: Plugin が作成した Vault をすべて archive する。
 * archive 済 Vault に紐づく Credential も使えなくなり、Plugin 起動時の bound 判定が
 * 必ず unbound になる。
 */
async function archiveAllPluginVaults(apiKey: string): Promise<void> {
  const headers = {
    'X-Api-Key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'managed-agents-2026-04-01',
  };
  const list = await fetch('https://api.anthropic.com/v1/vaults?limit=100', { headers });
  if (!list.ok) {
    throw new Error(`Anthropic /v1/vaults list failed: ${list.status}`);
  }
  const body = (await list.json()) as { data: Array<{ id: string; archived_at: string | null; metadata?: Record<string, string> }> };
  const targets = body.data.filter(
    (v) => v.archived_at === null && v.metadata?.['source'] === 'cowork-agent-for-kintone',
  );
  for (const v of targets) {
    const r = await fetch(`https://api.anthropic.com/v1/vaults/${v.id}/archive`, {
      method: 'POST',
      headers,
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Anthropic /v1/vaults/${v.id}/archive failed: ${r.status} ${t}`);
    }
  }
}
