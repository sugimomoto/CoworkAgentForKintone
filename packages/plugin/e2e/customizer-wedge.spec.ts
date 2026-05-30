// Customizer wedge V2 Phase 1 の DOM-only E2E (#20)。
//
// 実 LLM や実 kintone REST を呼ばず、`window.__coworkAgent` テスト API で
// 以下を chatStore に直接注入する:
//   1. Customizer Agent (mock) を builtInAgents にセット + currentAgentId を指定
//   2. kintone-customize-bundle artifact を upsert
//   3. setActiveArtifact で右ペインに表示
//
// 検証ポイント:
//   - ArtifactPane が CustomizerBundleView に切り替わる (`customizer-bundle-view` testid)
//   - FileTree が bundle.files から動的構築される
//   - WorkflowFooter の [プレビューを実行] ボタンが ready 状態で見える
//   - bundle.appId が host appId と違うときに警告バナーが出る
//   - 動作テスト環境 URL がリンクとして用意される (previewed state にしてから検証する)
//
// 実 REST を伴うプレビュー / 適用 / ロールバックの検証は `scripts/verify-customize-rest-api.mjs`
// で手動実行する (副作用が大きく flaky なため E2E 自動化から外す)。

import { test, expect, type Page } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
});

interface BundleUpsertInput {
  id: string;
  kind: 'kintone-customize-bundle';
  title: string;
  content: string;
  language?: string;
}

interface AgentRecord {
  id: string;
  name: string;
  model: 'opus' | 'sonnet';
  modelLabel: 'OPUS' | 'SONNET';
  description: string;
  purpose: 'business' | 'customizer-opus' | 'customizer-sonnet' | 'custom';
  iconKind: string;
  iconColor: string;
  visibility: 'public' | 'private';
  isDefault: boolean;
  source: 'builtin' | 'custom';
}

const CUSTOMIZER_AGENT: AgentRecord = {
  id: 'agent_customizer_test',
  name: 'カスタマイザーエージェント',
  model: 'opus',
  modelLabel: 'OPUS',
  description: 'JS カスタマイズ — 高品質',
  purpose: 'customizer-opus',
  iconKind: 'cust',
  iconColor: 'accent',
  visibility: 'public',
  isDefault: true,
  source: 'builtin',
};

async function gotoWithTestApi(page: Page): Promise<void> {
  await page.goto(`/k/${APP_ID}/?coworkE2e=1`);
  await expect(page.locator('#cowork-agent-root')).toBeAttached({ timeout: 15_000 });
  await page.waitForFunction(
    () => Boolean((window as unknown as { __coworkAgent?: unknown }).__coworkAgent),
    null,
    { timeout: 15_000 },
  );
}

async function setupCustomizerMode(page: Page): Promise<void> {
  await page.evaluate((agent) => {
    const api = (
      window as unknown as {
        __coworkAgent: {
          setBuiltInAgents: (agents: unknown[]) => void;
          setCurrentAgentId: (id: string | null) => void;
        };
      }
    ).__coworkAgent;
    api.setBuiltInAgents([agent]);
    api.setCurrentAgentId(agent.id);
  }, CUSTOMIZER_AGENT);
}

async function upsertBundle(page: Page, input: BundleUpsertInput): Promise<void> {
  await page.evaluate((arg) => {
    const api = (
      window as unknown as {
        __coworkAgent: { upsertArtifact: (i: BundleUpsertInput) => unknown };
      }
    ).__coworkAgent;
    api.upsertArtifact(arg);
  }, input);
}

async function setActive(page: Page, id: string | null): Promise<void> {
  await page.evaluate((arg) => {
    const api = (
      window as unknown as {
        __coworkAgent: { setActiveArtifact: (id: string | null) => void };
      }
    ).__coworkAgent;
    api.setActiveArtifact(arg);
  }, id);
}

function bundleContent(files: Array<{ path: string; content: string }>, appId?: number): string {
  return JSON.stringify(appId !== undefined ? { appId, files } : { files });
}

test.describe('Customizer wedge V2 Phase 1', () => {
  test('bundle artifact を upsert + active 化で ArtifactPane が CustomizerBundleView に切替', async ({
    page,
  }) => {
    await gotoWithTestApi(page);
    await setupCustomizerMode(page);

    await upsertBundle(page, {
      id: 'art-deal-color-v1',
      kind: 'kintone-customize-bundle',
      title: '商談フェーズ受注ハイライト',
      content: bundleContent([
        { path: 'desktop.js', content: '// generated JS' },
      ]),
    });
    await setActive(page, 'art-deal-color-v1');

    // Customizer モード切替を確認
    await expect(page.getByTestId('customizer-bundle-view')).toBeVisible();

    // FileTree に desktop.js が出ている
    await expect(page.getByTestId('filetree-file-desktop.js')).toBeVisible();

    // CodeViewer で content が表示
    await expect(page.getByTestId('customizer-bundle-file-desktop.js')).toContainText(
      '// generated JS',
    );

    // WorkflowFooter が ready 状態 (プレビュー実行ボタンが見える)
    await expect(page.getByTestId('workflow-footer')).toBeVisible();
    await expect(page.getByTestId('workflow-action-preview')).toBeVisible();
  });

  test('bundle.appId が host と異なるとき警告バナー表示', async ({ page }) => {
    await gotoWithTestApi(page);
    await setupCustomizerMode(page);

    // host は APP_ID (env)、bundle.appId はわざと別の値
    const otherAppId = Number(APP_ID) + 999;

    await upsertBundle(page, {
      id: 'art-target-app',
      kind: 'kintone-customize-bundle',
      title: '別アプリ向け',
      content: bundleContent([{ path: 'desktop.js', content: '// other app' }], otherAppId),
    });
    await setActive(page, 'art-target-app');

    const hint = page.getByTestId('customizer-bundle-target-app-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(String(otherAppId));
  });

  test('bundle 不正 (parse 不可) なら invalid 表示', async ({ page }) => {
    await gotoWithTestApi(page);
    await setupCustomizerMode(page);

    await upsertBundle(page, {
      id: 'art-broken',
      kind: 'kintone-customize-bundle',
      title: 'broken bundle',
      content: 'not a json',
    });
    await setActive(page, 'art-broken');

    await expect(page.getByTestId('customizer-bundle-invalid')).toBeVisible();
  });

  test('複数 file (Phase 2 想定の multi-file bundle) でファイル切替できる', async ({ page }) => {
    await gotoWithTestApi(page);
    await setupCustomizerMode(page);

    await upsertBundle(page, {
      id: 'art-multi',
      kind: 'kintone-customize-bundle',
      title: 'multi-file',
      content: bundleContent([
        { path: 'desktop.js', content: '// JS body' },
        { path: 'desktop.css', content: '/* CSS body */' },
      ]),
    });
    await setActive(page, 'art-multi');

    // 初期表示は最初の file
    await expect(page.getByTestId('customizer-bundle-file-desktop.js')).toContainText('// JS body');

    // FileTree の desktop.css クリックで切替
    await page.getByTestId('filetree-file-desktop.css').click();
    await expect(page.getByTestId('customizer-bundle-file-desktop.css')).toContainText('/* CSS body */');
  });

  test('Business Agent (customizer 以外) では Customizer モードに切替えない', async ({ page }) => {
    await gotoWithTestApi(page);
    // business purpose の Agent を currentAgentId にセット
    await page.evaluate(() => {
      const businessAgent = {
        id: 'agent_business_test',
        name: '業務エージェント',
        model: 'sonnet',
        modelLabel: 'SONNET',
        description: 'レコード操作',
        purpose: 'business',
        iconKind: 'biz',
        iconColor: 'accentSoft',
        visibility: 'public',
        isDefault: false,
        source: 'builtin',
      };
      const api = (
        window as unknown as {
          __coworkAgent: {
            setBuiltInAgents: (agents: unknown[]) => void;
            setCurrentAgentId: (id: string | null) => void;
          };
        }
      ).__coworkAgent;
      api.setBuiltInAgents([businessAgent]);
      api.setCurrentAgentId(businessAgent.id);
    });

    await upsertBundle(page, {
      id: 'art-not-cust',
      kind: 'kintone-customize-bundle',
      title: 'bundle but not customizer mode',
      content: bundleContent([{ path: 'desktop.js', content: '// js' }]),
    });
    await setActive(page, 'art-not-cust');

    // CustomizerBundleView は表示されない (business agent のため)
    await expect(page.getByTestId('customizer-bundle-view')).toHaveCount(0);
  });
});
