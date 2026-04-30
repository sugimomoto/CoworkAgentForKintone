// ファイル添付機能 (Step 1) の DOM-only E2E。
//
// LLM / Worker / kintone API を介さず、`window.__coworkAgent` のテスト API 経由で
// chatStore.attachedFiles を直接操作し、Composer のチップ表示・footer 警告・
// 削除・複数添付の DOM 挙動を検証する。
//
// テスト API は `?coworkE2e=1` がクエリに含まれるときだけ window に露出する。

import { test, expect, type Page } from '@playwright/test';

const APP_ID = process.env['KINTONE_TEST_APP_ID'];

test.beforeEach(async ({}, testInfo) => {
  if (!APP_ID) testInfo.skip(true, 'KINTONE_TEST_APP_ID が未設定のためスキップ');
});

interface AttachedFileInput {
  localId: string;
  filename: string;
  size: number;
  mimeType: string;
  kind: 'text' | 'document' | 'image';
  status: 'pending' | 'reading' | 'ready' | 'error';
  errorText?: string;
  content?: string;
}

async function gotoWithTestApi(page: Page): Promise<void> {
  await page.goto(`/k/${APP_ID}/?coworkE2e=1`);
  await expect(page.locator('#cowork-agent-root')).toBeAttached({ timeout: 15_000 });
  await page.waitForFunction(
    () => Boolean((window as unknown as { __coworkAgent?: unknown }).__coworkAgent),
    null,
    { timeout: 15_000 },
  );
}

async function clearAttachments(page: Page): Promise<void> {
  await page.evaluate(() => {
    const api = (window as unknown as {
      __coworkAgent: { clearAttachedFiles: () => void };
    }).__coworkAgent;
    api.clearAttachedFiles();
  });
}

async function addAttachment(page: Page, input: AttachedFileInput): Promise<void> {
  await page.evaluate((arg) => {
    const api = (window as unknown as {
      __coworkAgent: { addAttachedFile: (i: AttachedFileInput) => void };
    }).__coworkAgent;
    api.addAttachedFile(arg);
  }, input);
}

function readyText(localId: string, filename: string, size: number): AttachedFileInput {
  return {
    localId,
    filename,
    size,
    mimeType: 'text/csv',
    kind: 'text',
    status: 'ready',
    content: 'a,b\n1,2',
  };
}

function readyDoc(localId: string, filename: string, size: number): AttachedFileInput {
  return {
    localId,
    filename,
    size,
    mimeType: 'application/pdf',
    kind: 'document',
    status: 'ready',
    content: 'JVBERg==',
  };
}

function readyImg(localId: string, filename: string, size: number): AttachedFileInput {
  return {
    localId,
    filename,
    size,
    mimeType: 'image/png',
    kind: 'image',
    status: 'ready',
    content: 'iVBORw==',
  };
}

test.describe('Attachment 基盤 — Composer チップ表示 / footer / 削除', () => {
  test('📎 ボタンが Composer に描画される', async ({ page }) => {
    await gotoWithTestApi(page);
    const root = page.locator('#cowork-agent-root');
    await expect(root.getByLabel('ファイルを添付')).toBeVisible();
  });

  test('addAttachedFile (ready) でチップが表示され、ファイル名と subline が出る', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, readyText('f1', 'customers.csv', 12 * 1024));

    const chip = page.locator('[data-attachment-chip]');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('customers.csv');
    await expect(chip).toContainText(/テキスト/);
  });

  test('reading 状態のチップは spinner を表示し削除ボタンを出さない', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, {
      localId: 'r1',
      filename: 'big.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      kind: 'document',
      status: 'reading',
    });

    const chip = page.locator('[data-attachment-chip]');
    await expect(chip).toContainText('読込中…');
    await expect(chip.locator('[data-attach-spinner]')).toBeVisible();
    await expect(chip.getByLabel('削除')).toHaveCount(0);
  });

  test('error 状態のチップは errorText を表示し削除可能', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, {
      localId: 'e1',
      filename: 'over.pdf',
      size: 11 * 1024 * 1024,
      mimeType: 'application/pdf',
      kind: 'document',
      status: 'error',
      errorText: 'サイズ上限 (10 MB) を超えています',
    });

    const chip = page.locator('[data-attachment-chip]');
    await expect(chip).toContainText(/サイズ上限/);
    await expect(chip).toHaveAttribute('data-status', 'error');
    await chip.getByLabel('削除').click();
    await expect(page.locator('[data-attachment-chip]')).toHaveCount(0);
  });

  test('複数添付 → footer に件数 + 合計サイズ', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, readyText('a', 'a.csv', 100));
    await addAttachment(page, readyDoc('b', 'b.pdf', 200));
    await addAttachment(page, readyImg('c', 'c.png', 300));

    const chips = page.locator('[data-attachment-chip]');
    await expect(chips).toHaveCount(3);
    const root = page.locator('#cowork-agent-root');
    await expect(root.getByText('3件')).toBeVisible();
  });

  test('合計 30 MB 以上で footer に警告メッセージが出る', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    // 11 MB × 3 = 33 MB
    await addAttachment(page, readyDoc('a', 'a.pdf', 11 * 1024 * 1024));
    await addAttachment(page, readyDoc('b', 'b.pdf', 11 * 1024 * 1024));
    await addAttachment(page, readyDoc('c', 'c.pdf', 11 * 1024 * 1024));

    const root = page.locator('#cowork-agent-root');
    await expect(root.getByText(/合計サイズが大きめ/)).toBeVisible();
  });

  test('合計 30 MB 未満なら警告は出ない', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, readyDoc('a', 'a.pdf', 5 * 1024 * 1024));
    await addAttachment(page, readyDoc('b', 'b.pdf', 5 * 1024 * 1024));

    const root = page.locator('#cowork-agent-root');
    await expect(root.getByText(/合計サイズが大きめ/)).toHaveCount(0);
  });

  test('添付ありで Composer placeholder が「添付について聞く」に切替', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, readyText('p', 'a.csv', 100));

    const root = page.locator('#cowork-agent-root');
    await expect(root.getByPlaceholder(/添付について/)).toBeVisible();
  });

  test('reading 中のチップがあると送信ボタンが disabled', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, {
      localId: 'r1',
      filename: 'loading.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      kind: 'document',
      status: 'reading',
    });

    const root = page.locator('#cowork-agent-root');
    const input = root.getByPlaceholder(/添付について|kintone|レコード/);
    await input.fill('hi');
    await expect(root.getByLabel('送信')).toBeDisabled();
  });

  test('clearAttachedFiles で全チップが消える', async ({ page }) => {
    await gotoWithTestApi(page);
    await clearAttachments(page);
    await addAttachment(page, readyText('a', 'a.csv', 100));
    await addAttachment(page, readyDoc('b', 'b.pdf', 200));
    await expect(page.locator('[data-attachment-chip]')).toHaveCount(2);

    await clearAttachments(page);
    await expect(page.locator('[data-attachment-chip]')).toHaveCount(0);
  });
});
