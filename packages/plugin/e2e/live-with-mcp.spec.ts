// kintone MCP 経由で実データ取得まで通す E2E。
//
// 前提:
//   - kintone にプラグインが追加済 (KINTONE_TEST_APP_ID で指定)
//   - Plugin 設定済 (Worker URL, OAuth client, Anthropic API Key)
//   - Vault Credential 作成済 (credential-bind.setup.ts が通っている)
//
// 「kintone のアプリ一覧を見せて」を送り、agent.message に
//   - kintone-get-apps が呼び出されたことを示すアプリ ID / 名前が含まれる
// ことを検証する。
//
// LLM 呼び出しコスト + Worker → kintone API 通信を伴うため、CI では
// COWORK_E2E_SKIP_LIVE=1 でスキップ可能。

import { test, expect } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];
const SKIP_LIVE = process.env['COWORK_E2E_SKIP_LIVE'] === '1';

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定');
  if (SKIP_LIVE) testInfo.skip(true, 'COWORK_E2E_SKIP_LIVE=1 によりスキップ');
});

test('「アプリ一覧を見せて」→ MCP ツール経由でアプリ情報が応答に現れる', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto(`/k/${APP_ID}/`);
  const root = page.locator('#cowork-agent-root');
  await expect(root).toBeAttached({ timeout: 15_000 });

  const input = root.getByPlaceholder(/このアプリ|レコード/);
  await expect(input).toBeEnabled({ timeout: 60_000 });

  await input.fill('kintone のアプリ一覧を 3 件くらい教えて');
  await input.press('Enter');

  // user message が即時表示される (履歴復元と区別するため first)
  await expect(root.getByText('kintone のアプリ一覧を 3 件くらい教えて', { exact: false }).first()).toBeVisible({
    timeout: 5_000,
  });

  // agent message が「アプリ ID」「アプリ名」相当の数値 + 文字を含むまで待つ
  // - 数字 (アプリ ID) が含まれる
  // - 1 件以上のアプリ名らしき行 (日本語含む) がある
  const agentMessages = root.locator('[data-msg-kind="agent"]');
  await expect(async () => {
    const count = await agentMessages.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const text = (await agentMessages.last().textContent()) ?? '';
    expect(text).not.toContain('[object Object]');
    // ID + 名前 が並ぶ Markdown 表 or リスト (緩めの正規表現で検出)
    expect(text).toMatch(/\d/); // アプリ ID 数値
    expect(text.length).toBeGreaterThan(20); // 単なる挨拶でない
  }).toPass({ timeout: 150_000, intervals: [3_000, 5_000] });

  // ツール実行カード (Phase 1b-5 で追加) が DOM に現れていること
  // get-apps の tool_use イベントが ToolCardMessage として描画される想定
  const toolCards = root.locator('[data-msg-kind="tool"]');
  expect(await toolCards.count()).toBeGreaterThanOrEqual(1);
});
