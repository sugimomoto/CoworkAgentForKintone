import { defineConfig, devices } from '@playwright/test';

// 環境変数はリポジトリルート .env から取得 (実行時に node --env-file=../../.env で渡す)
const KINTONE_BASE_URL = process.env['KINTONE_BASE_URL'];

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: process.env['CI'] ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: KINTONE_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },

  // ログイン処理を 1 回だけ走らせて storageState を共有
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/kintone.json',
      },
      dependencies: ['setup'],
    },
  ],
});
