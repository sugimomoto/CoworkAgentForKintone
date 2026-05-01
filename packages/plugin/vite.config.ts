import { readFileSync } from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const manifest = JSON.parse(
  readFileSync(path.resolve(__dirname, 'plugin/manifest.json'), 'utf8'),
) as { version?: number | string };
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version?: string };
const PLUGIN_VERSION = String(manifest.version ?? 'dev');
const PLUGIN_SEMVER = pkg.version ?? '0.0.0';

// Vite 設定: kintone プラグイン用に 2 つの独立エントリ (desktop / config) を IIFE でバンドル
// 本番ビルドは pnpm plugin:build 経由ではなく、pnpm --filter ... run vite:build で実行する予定
// (Phase 1a 現時点では未統合。UI コンポーネントの実装が進んだ段階で desktop.ts / config.ts を追加する)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    __PLUGIN_VERSION__: JSON.stringify(PLUGIN_VERSION),
    __PLUGIN_SEMVER__: JSON.stringify(PLUGIN_SEMVER),
  },
  build: {
    outDir: 'dist-plugin',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
});
