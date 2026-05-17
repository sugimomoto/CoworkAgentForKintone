import type { Config } from 'tailwindcss';

// Cowork Agent for kintone — Tailwind 設定
// デザイントークンは docs/functional-design.md §5.5 に準拠
// ベース色: Teal #0d9488
// CSS カスタムプロパティ経由で light/dark を data-theme 属性で切替

const config: Config = {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  // preflight (Tailwind の base reset) はグローバルに `*` を上書きしてしまい、
  // kintone 本体の `<a>` / `<h1>` / `<button>` 等のスタイルを破壊する (タイトル位置ズレ等)。
  // プラグインは kintone DOM 内に注入されるため preflight は OFF。
  // 必要な reset は `.cowork-agent-root` スコープで src/styles/global.css に手書きする。
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // CSS カスタムプロパティ参照 (light/dark はグローバル CSS で切替)
        bg: 'var(--cw-bg)',
        panel: 'var(--cw-panel)',
        border: 'var(--cw-border)',
        text: 'var(--cw-text)',
        muted: 'var(--cw-muted)',
        subtle: 'var(--cw-subtle)',
        card: 'var(--cw-card)',
        'card-border': 'var(--cw-card-border)',
        'card-hi': 'var(--cw-card-hi)',
        accent: 'var(--cw-accent)',
        'accent-soft': 'var(--cw-accent-soft)',
        user: 'var(--cw-user)',
        'user-border': 'var(--cw-user-border)',
        warn: 'var(--cw-warn)',
        'warn-soft': 'var(--cw-warn-soft)',
        ok: 'var(--cw-ok)',
        'ok-soft': 'var(--cw-ok-soft)',
      },
      fontFamily: {
        // design ハンドオフ (variant-rich.jsx / styles.css) に準拠
        sans: [
          '"Noto Sans JP"',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          '"Yu Gothic UI"',
          'Meiryo',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        bubble: '16px 16px 4px 16px', // user バブル (右下のみ尖る)
        'bubble-agent': '16px 16px 16px 4px', // agent バブル (左下のみ尖る)
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.04)',
        'card-lg': '0 4px 20px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
  // kintone 本体の CSS に影響しないよう、プラグイン rootにスコープするのを想定
  // 利用側で `.cowork-agent-root` 下で使う
};

export default config;
