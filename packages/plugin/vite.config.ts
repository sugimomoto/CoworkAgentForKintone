import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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
  build: {
    outDir: 'dist-plugin',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
});
