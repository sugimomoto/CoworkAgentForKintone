// Artifact 生成基盤 (Step 1: Foundation) の DOM-only E2E。
//
// LLM / Worker / kintone API を介さず、`window.__coworkAgent` のテスト API 経由で
// chatStore を直接操作し、ArtifactPane のレンダリング・切替・閉じる挙動を検証する。
//
// テスト API は `?coworkE2e=1` がクエリに含まれるときだけ window に露出する (本番影響なし)。

import { test, expect, type Page } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
});

interface UpsertInput {
  id: string;
  kind:
    | 'markdown'
    | 'code'
    | 'json'
    | 'react'
    | 'mermaid'
    | 'svg'
    | 'html'
    | 'csv'
    | 'kintone-customize-js';
  title: string;
  content: string;
  language?: string;
}

async function gotoWithTestApi(page: Page): Promise<void> {
  await page.goto(`/k/${APP_ID}/?coworkE2e=1`);
  // App マウント + テスト API 露出を待つ
  await expect(page.locator('#cowork-agent-root')).toBeAttached({ timeout: 15_000 });
  await page.waitForFunction(
    () => Boolean((window as unknown as { __coworkAgent?: unknown }).__coworkAgent),
    null,
    { timeout: 15_000 },
  );
}

async function upsert(page: Page, input: UpsertInput): Promise<void> {
  await page.evaluate((arg) => {
    const api = (window as unknown as {
      __coworkAgent: { upsertArtifact: (i: UpsertInput) => unknown };
    }).__coworkAgent;
    api.upsertArtifact(arg);
  }, input);
}

async function setActive(page: Page, id: string | null): Promise<void> {
  await page.evaluate((arg) => {
    const api = (window as unknown as {
      __coworkAgent: { setActiveArtifact: (id: string | null) => void };
    }).__coworkAgent;
    api.setActiveArtifact(arg);
  }, id);
}

async function clearAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const api = (window as unknown as {
      __coworkAgent: { clearArtifacts: () => void };
    }).__coworkAgent;
    api.clearArtifacts();
  });
}

test.describe('Artifact 基盤 — 表示 / 切替 / 閉じる', () => {
  test('markdown artifact を upsert + active 化すると ArtifactPane が表示される', async ({ page }) => {
    await gotoWithTestApi(page);

    await upsert(page, {
      id: 'a-md',
      kind: 'markdown',
      title: 'Q1 売上レポート',
      content: '# 売上\n\n- A 社: 100\n- B 社: 200',
    });
    await setActive(page, 'a-md');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane).toBeVisible();
    // タイトル / kind バッジ / 本文の見出しが見える
    await expect(pane).toContainText('Q1 売上レポート');
    await expect(pane).toContainText('Markdown');
    await expect(pane.locator('h1')).toContainText('売上');
    // フッタアクション
    await expect(pane.getByRole('button', { name: /コピー/ })).toBeVisible();
    await expect(pane.getByRole('button', { name: /ダウンロード/ })).toBeVisible();
  });

  test('code artifact は <pre> + 言語ラベル付きで表示される', async ({ page }) => {
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-code',
      kind: 'code',
      title: 'sum.js',
      language: 'javascript',
      content: 'const sum = (n) => (n * (n + 1)) / 2;\nconsole.log(sum(10));',
    });
    await setActive(page, 'a-code');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane).toBeVisible();
    await expect(pane).toContainText('javascript');
    await expect(pane.locator('pre code')).toContainText('sum');
  });

  test('json artifact は parse して整形された <pre> で表示される', async ({ page }) => {
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-json',
      kind: 'json',
      title: 'sample',
      content: '{"items":[{"id":1,"name":"A"},{"id":2,"name":"B"}]}',
    });
    await setActive(page, 'a-json');

    const pane = page.locator('[data-artifact-pane]');
    const rendered = (await pane.locator('pre code').textContent()) ?? '';
    // 整形されると改行 + インデントが入る
    expect(rendered).toContain('\n');
    expect(rendered).toMatch(/^\s+"items":/m);
  });

  test('未対応 kind (kintone-customize-js) は Placeholder 表示で raw が出る', async ({ page }) => {
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-kjs',
      kind: 'kintone-customize-js',
      title: 'kintone JS',
      content: 'kintone.events.on("app.record.index.show", () => {});',
    });
    await setActive(page, 'a-kjs');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane).toContainText('専用レンダラ未対応');
    await expect(pane.locator('pre code')).toContainText('kintone.events.on');
  });

  test('csv artifact はテーブルとして表示される', async ({ page }) => {
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-csv',
      kind: 'csv',
      title: 'sample.csv',
      content: 'id,name,score\n1,Alice,95\n2,Bob,82\n3,Carol,78',
    });
    await setActive(page, 'a-csv');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane.locator('table thead th').first()).toContainText('id');
    await expect(pane.locator('table tbody tr')).toHaveCount(3);
    await expect(pane).toContainText('Alice');
    await expect(pane).toContainText('3 列 / 3 行');
  });

  test('html artifact は iframe sandbox で render される', async ({ page }) => {
    test.setTimeout(20_000);
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-html',
      kind: 'html',
      title: 'wireframe',
      content: '<h1 style="color:#0f5132">Hello HTML</h1><p>本文</p>',
    });
    await setActive(page, 'a-html');

    const pane = page.locator('[data-artifact-pane]');
    const wrap = pane.locator('[data-artifact-state]');
    await expect(wrap).toHaveAttribute('data-artifact-state', 'rendered', { timeout: 10_000 });
    await expect(pane.locator('iframe')).toBeAttached();
  });

  test('svg artifact は iframe sandbox で render される', async ({ page }) => {
    test.setTimeout(20_000);
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-svg',
      kind: 'svg',
      title: 'circle',
      content: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#3b82f6"/></svg>',
    });
    await setActive(page, 'a-svg');

    const pane = page.locator('[data-artifact-pane]');
    const wrap = pane.locator('[data-artifact-state]');
    await expect(wrap).toHaveAttribute('data-artifact-state', 'rendered', { timeout: 10_000 });
  });

  test('mermaid artifact は esm.sh から mermaid をロードして render される', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoWithTestApi(page);
    await upsert(page, {
      id: 'a-mmd-render',
      kind: 'mermaid',
      title: 'flow',
      content: 'graph TD; A-->B; B-->C;',
    });
    await setActive(page, 'a-mmd-render');

    const pane = page.locator('[data-artifact-pane]');
    const wrap = pane.locator('[data-artifact-state]');
    await expect(wrap).toHaveAttribute('data-artifact-state', 'rendered', { timeout: 30_000 });
  });

  test('閉じるボタンで ペインが消える', async ({ page }) => {
    await gotoWithTestApi(page);
    await upsert(page, { id: 'a-md', kind: 'markdown', title: 'T', content: 'x' });
    await setActive(page, 'a-md');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane).toBeVisible();

    await pane.getByLabel('アーティファクトペインを閉じる').click();
    await expect(pane).toHaveCount(0);

    // 内部状態も null になる
    const activeId = await page.evaluate(() => {
      const api = (window as unknown as {
        __coworkAgent: { getActiveArtifactId: () => string | null };
      }).__coworkAgent;
      return api.getActiveArtifactId();
    });
    expect(activeId).toBeNull();
  });

  test('複数 artifact があるとセレクタで切替できる', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAll(page);
    await upsert(page, { id: 'a1', kind: 'markdown', title: 'レポート 1', content: '# A' });
    await upsert(page, { id: 'a2', kind: 'json', title: 'データ 2', content: '{"k":1}' });
    await setActive(page, 'a1');

    const pane = page.locator('[data-artifact-pane]');
    const selector = pane.getByLabel('アーティファクトを選択');
    await expect(selector).toBeVisible();

    // a2 に切替えて本文が変わる
    await selector.selectOption('a2');
    await expect(pane.locator('pre code')).toContainText('"k": 1');
  });

  test('同じ id で再 upsert すると content が更新される (version up)', async ({ page }) => {
    await gotoWithTestApi(page);
    await upsert(page, { id: 'a-up', kind: 'markdown', title: 'T', content: '# v1' });
    await setActive(page, 'a-up');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane.locator('h1')).toContainText('v1');

    await upsert(page, { id: 'a-up', kind: 'markdown', title: 'T (改訂)', content: '# v2 改訂版' });

    // タイトルが更新され、本文が v2 に切替わる
    await expect(pane).toContainText('T (改訂)');
    await expect(pane.locator('h1')).toContainText('v2 改訂版');
    // version 表記が出る (v2)
    await expect(pane).toContainText('v2');
  });
});

test.describe('Artifact 基盤 — React kind (sandbox iframe)', () => {
  // CDN (esm.sh) からのロードを待つので長め
  test('React artifact は iframe 内で render され data-artifact-state="rendered" になる', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoWithTestApi(page);

    const userCode = `
export default function App() {
  return React.createElement('div', { style: { padding: 12, fontSize: 14 } },
    React.createElement('h2', null, 'E2E React Artifact'),
    React.createElement('p', { 'data-testid': 'react-artifact-body' }, 'rendered ok'));
}
`.trim();

    await upsert(page, { id: 'a-react', kind: 'react', title: 'React Demo', content: userCode });
    await setActive(page, 'a-react');

    const pane = page.locator('[data-artifact-pane]');
    await expect(pane).toBeVisible();

    // 親側のレンダラ wrapper (data-artifact-state) を待つ
    const wrap = pane.locator('[data-artifact-state]');
    await expect(wrap).toHaveAttribute('data-artifact-state', 'rendered', { timeout: 30_000 });

    // iframe がぶら下がっていることだけ確認 (sandbox=allow-scripts のみなので
    // frameLocator で中身を読むことはできないが、DOM ノードは存在する)
    await expect(pane.locator('iframe')).toBeAttached();
  });

  test('構文エラーを含む React artifact は data-artifact-state="error" になる', async ({ page }) => {
    test.setTimeout(45_000);
    await gotoWithTestApi(page);

    const broken = 'export default function App() { return <div };'; // 構文エラー
    await upsert(page, { id: 'a-react-bad', kind: 'react', title: 'broken', content: broken });
    await setActive(page, 'a-react-bad');

    const pane = page.locator('[data-artifact-pane]');
    const wrap = pane.locator('[data-artifact-state]');
    await expect(wrap).toHaveAttribute('data-artifact-state', 'error', { timeout: 30_000 });
    // エラーメッセージが親側にも表示される
    await expect(pane).toContainText('実行エラー');
  });
});
