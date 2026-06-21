# Release Kit — リリース公開物の生成

1 つの **統合スペック**（`examples/<version>.json`）から、リリースの公開物を生成するツール群:

1. **OGP / SNS シェアカード画像**（`ogp.mjs`）→ canonical `public/images/ogp.png`（og:image。毎回上書き）
   ＋ 版別アーカイブ `public/images/og/<version>.png`（履歴保存。毎回追加、過去分は消さない）
2. **リリースノート用エントリ**（`notes.mjs`）→ `src/data/releases.ts` に貼る Release オブジェクト
3. **SNS 投稿文**（`sns.mjs`）→ X / 長文（note・Qiita 等）のドラフト

デザイン正本は [reference/handoff.md](reference/handoff.md)（Claude Design ハンドオフ）と
[reference/ogp-update-1200x630.png](reference/ogp-update-1200x630.png)。

> Claude Code からはローカルスキル `release-kit`（`.claude/skills/release-kit/SKILL.md`、`.claude/` は
> gitignore のため各自ローカル）でも呼べる。本ディレクトリが実体（versioned・再現可能）。

## 使い方（リリースのたび）

```bash
# 1. examples/ を雛形に <version>.json を書く（1 ファイルで OGP / notes / SNS 全部を賄う）
SPEC=packages/landing/release-kit/examples/v0.2.0.json

# 2. OGP 画像（1200x630 + 2x）を生成 → ogp.png を上書き ＋ og/<version>.png に複製保存
#    （--no-archive でアーカイブ抑止。過去版だけ作り直すなら --out images/og/<ver> --no-archive）
node packages/landing/release-kit/ogp.mjs $SPEC

# 3. リリースノートのエントリを生成 → 出力を src/data/releases.ts の releases 先頭に貼る
node packages/landing/release-kit/notes.mjs $SPEC

# 4. SNS 投稿文のドラフトを生成（X は文字数目安付き）
node packages/landing/release-kit/sns.mjs $SPEC
```

生成後は **OGP を目視確認**（崩れ・はみ出し・誤字）。SNS / notes はドラフトとして文面を整える。

## 統合スペック（`examples/v0.2.0.json` 参照）

```jsonc
{
  "version": "v0.2.0",            // amber バッジ / 投稿の見出し
  "date": "2026-06-20",           // notes 用
  "tag": "plugin-v0.2.0",         // GitHub Release タグ（notes / SNS のリンク）
  "url": "https://.../releases/", // SNS のリンク先（LP のリリースノート）
  "repo": "github.com/owner/repo",

  "ogp":   { "headline": "…<span class=\"hl\">強調</span>…\n二行目", "sub": "<b>強調</b>…" },
  "notes": { "title": "リリースのテーマ", "summary": "概要 1 段落" },
  "sns":   { "tagline": "kintone の隣に、AI コワーカーを。", "hashtags": ["kintone","AI","OSS"] },

  "features": [   // 2〜3 個。先頭が OGP の lead（teal 強調 + amber spark）
    {
      "icon": "bell",            // bell | clock | grid | shield | wrench | doc | 生SVG
      "new": true,               // NEW バッジ（OGP / notes）
      "title": "通知（Slack / Teams / Discord）",  // notes / SNS 既定の見出し（長め）
      "desc":  "…説明（notes 用・長め）…",
      "ogpTitle": "通知",         // OGP 用の短い見出し（省略時 title）
      "ogpDesc":  "…OGP 用の短い説明…",            // 省略時 desc
      "snsText":  "Slack / Teams / Discord への通知", // SNS 箇条書き（省略時 title）
      "chips": [ {"label":"Slack","color":"#4a154b"} ]  // OGP のプラットフォームピル（任意）
    }
  ]
}
```

各機能は **title/desc を共通の正本**にし、媒体ごとに短くしたいときだけ `ogpTitle`/`ogpDesc`/`snsText` で上書きする。
これで「OGP・リリースノート・SNS」の 3 つが 1 スペックから一貫して出る。

## 仕組み・依存

- `ogp.mjs` はテンプレ HTML（CSS 固定）を組み立て **Playwright(Chromium) でスクショ** → PNG 化。
  Playwright は `packages/plugin` の `@playwright/test` を `createRequire` で解決（追加依存なし。
  未取得なら `pnpm --filter @cowork-agent/plugin run e2e:install`）。フォント（Noto Sans JP / JetBrains Mono）は
  Google Fonts を読むため**ネット接続が必要**。
- `notes.mjs` / `sns.mjs` は spec を読んでテキストを標準出力するだけ（依存なし）。
- アイコンは OGP（CSS 図形＋一部 SVG）と notes ページ（インライン SVG）で同じ名前 `bell/clock/grid/shield/wrench/doc` を使う。

## OGP の配線（設定済み）

`src/layouts/BaseLayout.astro` / `HelpLayout.astro` が `/images/ogp.png` を指す絶対 URL の
`og:image` / `twitter:image`（+ width/height/type/alt）を出力する。画像パスは固定なので、`ogp.mjs` で
上書きするだけで全ページのシェアカードが最新リリースに切り替わる。
