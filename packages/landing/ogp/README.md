# OGP / SNS シェアカード生成

リリース告知用の OGP 画像（1200×630 PNG）を、固定ブランドデザインで毎回生成するツール。
SNS（X / Facebook / Slack / Discord 等）で LP の URL を共有したときに表示されるカード。

デザインは固定。リリースごとに差し替えるのは **version バッジ / 見出し / 機能カード 2〜3 枚** だけ。
正本は [reference/handoff.md](reference/handoff.md)（Claude Design ハンドオフ）と
[reference/ogp-update-1200x630.png](reference/ogp-update-1200x630.png)。

> Claude Code からはローカルスキル `release-ogp`（`.claude/skills/release-ogp/SKILL.md`、`.claude/` は
> gitignore のため各自ローカル）からも呼べる。本ディレクトリが実体（versioned・再現可能）。

## 使い方

```bash
# spec を書く（examples/ を雛形にコピー）
node packages/landing/ogp/render.mjs <spec.json>
#   → packages/landing/public/images/ogp.png (1200x630) と ogp@2x.png (2400x1260) を生成
#   --out <拡張子なしパス> で出力先変更 / --no-2x で 1x のみ
```

生成後は **PNG を目視確認**（崩れ・はみ出し・誤字）。`reference/ogp-update-1200x630.png` と見比べる。

## spec スキーマ

`examples/v0.2.0.json` 参照。要点:

- `version`: amber バッジ（リリース semver）
- `headline`: 生 HTML 可。`\n`→改行、`<span class="hl">…</span>`→teal 強調。50px・左454px 内に収める
- `sub`: 任意。`<b>…</b>`→ink 強調
- `repo`: 任意
- `features[]`: 2〜3 個。先頭が **lead**（teal 強調 + amber spark）。各 `{ icon, title, desc, new?, lead?, chips? }`
  - `icon`: `"bell" | "clock" | "grid"`、または生 SVG 文字列（26px / `stroke="currentColor"`）
  - `chips`: 任意。色付きドット付きピル（例: 通知の Slack/Teams/Discord）

## 仕組み・依存

- `render.mjs` がテンプレ HTML（CSS 固定 + spec から body 生成）を組み立て、**Playwright（Chromium）で
  スクショ**して PNG 化する。CSS が見た目の正本（むやみに変えない）。
- Playwright は `packages/plugin` の devDependency `@playwright/test` を `createRequire` で解決（追加依存なし）。
  未取得なら `pnpm --filter @cowork-agent/plugin run e2e:install`。
- フォント（Noto Sans JP / JetBrains Mono）は Google Fonts を読むため**ネット接続が必要**。
  オフライン時は Hiragino にフォールバックして見た目が変わる。

## OGP の配線（設定済み）

`packages/landing/src/layouts/BaseLayout.astro` / `HelpLayout.astro` が `/images/ogp.png` を指す
絶対 URL の `og:image` / `twitter:image`（+ width/height/type/alt）を出力する。画像パスは固定なので、
以降はこのツールで `ogp.png` を上書きするだけで全ページのシェアカードが最新リリースに切り替わる。
