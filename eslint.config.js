// ESLint flat config (v9+)
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-plugin/**',
      '**/build/**',
      '**/.venv/**',
      '**/coverage/**',
      // --- 生成物・ビルド出力 (いずれも .gitignore 対象。lint しても意味がない) ---
      '**/generated/**', // worker-bundle.ts / skills-bundle.ts (minify 済み生成コード)
      'packages/plugin/plugin/js/**', // esbuild 出力 (IIFE bundle)
      'packages/plugin/plugin/css/**', // Tailwind 出力
      // --- ツール出力・ローカル成果物 ---
      '**/playwright-report/**', // Playwright HTML レポート (bundle 同梱)
      '**/.wrangler/**', // wrangler 一時出力
      '**/.astro/**', // Astro 型生成
      '.claude/**', // Claude Code のローカル worktree / 設定 (リポジトリのコピーを含む)
      // --- ドキュメント (デザインツール書き出し等。アプリのソースではない) ---
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 実行環境のグローバルを宣言する。
    // monorepo 内に kintone カスタマイズ (browser) / Cloudflare Worker / Node スクリプトが
    // 混在するため、browser + node を一括で許可する (window/document/process/console 等の
    // no-undef 誤検出を防ぐ)。実際の誤用は typecheck が捕捉する。
    // kintone はカスタマイズ実行時にグローバル注入される API オブジェクト。
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, kintone: 'readonly', cybozu: 'readonly' },
    },
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        // `_` プレフィックスは「意図的に未使用」(分割代入でのキー除外、未使用引数など) を表す
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // React Hooks の検査。コード側に既存の eslint-disable コメントがあるのに plugin 未登録で
    // 「rule not found」になっていたため、古典的な 2 ルールのみ有効化する
    // (v7 recommended-latest の React Compiler 系ルールは対象コードが未検証なので採用しない)。
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Astro 自動生成の参照ディレクティブを許可する。
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Playwright のフィクスチャ分割代入 `async ({}) => {}` は空パターンになるため許可する。
    files: ['packages/plugin/e2e/**'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
];
