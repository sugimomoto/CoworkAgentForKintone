# Handoff: OGP / SNS Share Card — Cowork Agent for kintone

## Overview
This is the social-share (Open Graph) card image for the OSS kintone plugin **Cowork Agent for kintone**. It renders when the product's landing-page URL is shared on X, Facebook, Slack, Discord, etc.

There are **two intents** in this bundle:
1. **Update / release announcement card** (the current, primary deliverable) — a reusable template that highlights 2–3 new features per release, with a version badge. Source: `OGP Card - Update.html`.
2. **Evergreen product-intro card** (the original) — a general "what is this product" card. Source: `OGP Card.html`.

The release card is meant to be **re-skinned every release**: swap the version badge, the headline, and the 2–3 feature cards. Everything else stays fixed.

## About the Design Files
The files in this bundle are **design references created in HTML** — a single static 1200×630 frame each, showing the intended look. They are **not** production components and are not meant to be shipped as-is.

The implementation task is to **render these as actual PNG images** in the target codebase. An OGP card is ultimately a static raster image referenced from `<meta property="og:image">`. Two viable approaches:
- **Build-time render**: keep an HTML/React template like these and render it to PNG with a headless browser (Playwright/Puppeteer) or a renderer such as Satori / `@vercel/og` / `next/og`. This is ideal because the release card is a template — regenerate the PNG each release from data.
- **Hand-export**: if there's no render pipeline, treat the HTML purely as a spec and export the PNG manually (the bundle already includes exported PNGs — see Assets).

Use the target project's existing framework and fonts. If using `@vercel/og`/Satori, note Satori supports a CSS subset (flexbox only, no CSS Grid, limited pseudo-elements) — see the "Satori / @vercel/og porting notes" section.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and copy. Recreate pixel-accurately. The exact exported PNGs are included, so the HTML + the PNGs together are the source of truth.

## Output spec
- **Canvas**: 1200 × 630 px (OGP standard). Also provide 2× (2400 × 1260).
- **Format**: PNG, **opaque** background (no transparency).
- **Safe area**: keep all critical content within ~90 px of each edge (feeds crop/round corners).
- **Legibility**: large, high-contrast type. No tiny body text, no dense screenshots.

---

## Screen: Update / Release Card (`OGP Card - Update.html`)

### Layout
- Root frame: **1200 × 630**, background `#faf8f3`.
- Two soft radial glows (decorative, behind content):
  - teal: `radial-gradient(44% 54% at 92% 4%, rgba(13,148,136,0.09), transparent 70%)`
  - amber: `radial-gradient(40% 44% at 2% 98%, rgba(255,191,0,0.07), transparent 70%)`
  - faint dotted-grid texture, masked to fade toward the right/center (decorative, very subtle — optional).
- **Safe container**: `padding: 80px 90px`, CSS Grid, two columns: **`454px` (left) + `1fr` (right)**, `gap: 50px`, vertically centered.

### Left column (brand + release headline)
Vertical flex stack, centered vertically.

1. **Brand lockup** (mandatory — always show the full wordmark)
   - Row: a `44×44` rounded-square mark (`border-radius: 11px`, bg `#0d9488`) containing white **"CA"** (weight 800, 18px, `box-shadow: 0 4px 14px rgba(13,148,136,0.28)`), then the wordmark text, `gap: 13px`.
   - Wordmark, **one line**, `font-size: 23px`, weight 700, `letter-spacing: -0.02em`, `white-space: nowrap`:
     `Cowork ` + **`Agent`** (color `#0d9488`) + ` ` + `for kintone` (color `#a89d85`, weight 600).
   - `margin-bottom: 30px`.

2. **Release row** (`margin-bottom: 20px`, inline-flex, `gap: 9px`)
   - **"WHAT'S NEW" pill**: uppercase, 12.5px / weight 700 / `letter-spacing: 0.04em`, color `#0a766c`, bg `rgba(13,148,136,0.10)`, `padding: 6px 13px`, `border-radius: 999px`, with a leading 7px teal dot.
   - **Version badge** (swap each release): JetBrains Mono, 13px, weight 700, color `#3a2f24`, bg `#ffbf00` (amber), `padding: 5px 11px`, `border-radius: 8px`, `box-shadow: 0 3px 10px rgba(255,191,0,0.35)`. Current value: **`v1.4`**.

3. **Headline** (swap each release): `font-size: 50px`, weight 700, `letter-spacing: -0.035em`, `line-height: 1.16`, `text-wrap: balance`, `margin-bottom: 22px`. Current copy (two lines):
   `もっと` + **`自動`** (color `#0d9488`) + `で、` ⏎ `もっと"隣"に。`

4. **Sub** (`font-size: 16px`, color `#6b5f4a`, `line-height: 1.6`, `max-width: 400px`, `margin-bottom: 26px`). Current copy:
   **`通知・定期実行・プリセット`**`に対応。` ⏎ `頼んだ作業を、待たずに回せるようになりました。` (bold spans use ink `#231200`, weight 600).

5. **Foot row** (inline-flex, `gap: 11px`, nowrap):
   - **License chip**: JetBrains Mono, 12px, weight 700, color `#0a766c`, bg `rgba(13,148,136,0.10)`, `padding: 4px 10px`, `border-radius: 6px` → `OSS / MIT`.
   - **Repo**: JetBrains Mono, 12px, color `#a89d85` → `github.com/cowork-agent` (replace with real repo URL).

### Right column (feature cards — the template payload)
Vertical flex stack, `gap: 14px`. **2–3 cards** per release (remove a card for 2; layout still centers).

Each `.feat` card:
- Flex row, `align-items: center`, `gap: 16px`, bg `#ffffff`, `border: 1px solid rgba(35,18,0,0.10)`, `border-radius: 16px`, `padding: 17px 19px`, `box-shadow: 0 10px 30px rgba(35,18,0,0.07), 0 2px 6px rgba(35,18,0,0.04)`.
- **Icon tile** `.ico`: `54×54`, `border-radius: 13px`, bg `rgba(13,148,136,0.10)`, icon color `#0a766c`. Icons are simple **CSS-only geometry** (no SVG): a bell, a clock, a 2×2 grid. See HTML for the exact shape recipes — re-draw with the target's icon set if preferred (lucide: `bell`, `clock`, `layout-grid`).
- **Text** `.tx`: title `.tt` 20px / weight 700 / `letter-spacing: -0.01em`; description `.dd` 13.5px / color `#6b5f4a` / `line-height: 1.5`.

**Lead card** (first one) gets emphasis: add class `lead` →
- `border-color: rgba(13,148,136,0.22)`, stronger teal shadow `0 16px 38px rgba(13,148,136,0.12), 0 2px 6px rgba(35,18,0,0.05)`.
- Its icon tile fills solid teal `#0d9488` with white icon.
- Title carries a **NEW badge**: 10px / weight 800 / `letter-spacing: 0.06em`, color `#3a2f24`, bg `#ffbf00`, `padding: 2px 8px`, `border-radius: 999px`.
- A single **amber spark** dot (16px circle, bg `#ffbf00`, `box-shadow: 0 0 0 5px rgba(255,191,0,0.18), 0 4px 12px rgba(255,191,0,0.45)`) pinned to its top-right corner (`right: -8px; top: -8px`). One spark only — single point of energy.

Current 3 cards:
1. **通知** (lead, NEW) — `レコードの変化を Slack・Teams・Discord へ自動で。` + 3 platform chips (`.plats span`: 10.5px, bg `#f4f0e7`, `border: 1px solid rgba(35,18,0,0.10)`, `border-radius: 999px`, each with an 8px rounded color square — Slack `#4a154b`, Teams `#5b5fc7`, Discord `#5865f2`). Icon: bell.
2. **定期実行** — `集計やレポート作成を、スケジュールで自動化。` Icon: clock.
3. **プリセットエージェント** — `業務別のエージェントを、ワンクリックで呼び出し。` Icon: 2×2 grid.

---

## Screen: Evergreen Product-Intro Card (`OGP Card.html`)
Same brand system, different composition (kept as an alternative):
- **Left**: OSS/MIT eyebrow pill, large wordmark `Cowork Agent for kintone`, big tagline **`kintone の隣に、AI コワーカーを。`** (57px, `AI コワーカー` in teal), a mono support line `自然言語で 検索・集計・更新` + `OSS / MIT` chip, and 4 feature pills (`自然言語で操作 / 定期実行 / Slack・Teams・Discord 通知 / カスタマイズJS生成`).
- **Right**: an abstracted product motif — a window with a kintone-style record list (`案件管理`, 4 rows: number / name (greeked bars) / 担当 avatar / 金額 / status pill) and a **teal chat side-panel hugging its right edge** (avatar "CA", a user bubble, a `get_records` tool card, an agent reply, an input bar). One amber spark on the seam between list and panel.
- See the HTML for exact values; it reuses the same token set below.

---

## Design Tokens
Pulled from the product UI / landing page (`styles.css` / `lp/styles.css`). **Match these exactly.**

### Colors
| Role | Hex / value |
|---|---|
| bg (warm cream) | `#faf8f3` |
| bg-alt | `#f4f0e7` |
| bg-deep | `#efe9dc` |
| card white | `#ffffff` |
| ink (text strong) | `#231200` |
| muted (text mid) | `#6b5f4a` |
| subtle (text light) | `#a89d85` |
| border | `rgba(35,18,0,0.10)` |
| border-strong | `rgba(35,18,0,0.16)` |
| accent (teal) | `#0d9488` |
| accent-deep | `#0a766c` |
| accent-soft (fill) | `rgba(13,148,136,0.10)` |
| accent-line | `rgba(13,148,136,0.22)` |
| success | `#15803d` |
| warn | `#b45309` |
| kintone header (motif) | `#3a2f24` |
| kintone amber (motif) | `#ffbf00` |
| Slack / Teams / Discord chips | `#4a154b` / `#5b5fc7` / `#5865f2` |

### Typography
- **Headings & body**: `Noto Sans JP` (weights 400–700), fallback `'Hiragino Sans', sans-serif`.
- **Labels / numbers / code / version / repo**: `JetBrains Mono` (weights 400–700).
- Key sizes (update card): wordmark 23px·700, headline 50px·700, feature title 20px·700, feature desc 13.5px, sub 16px, version 13px (mono).
- Headlines use tight tracking (`letter-spacing: -0.035em`) and `text-wrap: balance`.

### Radius
`6px` (small chips) · `8px` (version badge) · `11px` (brand mark) · `13px` (icon tile) · `16px` (feature cards) · `999px` (pills).

### Shadows
- card: `0 10px 30px rgba(35,18,0,0.07), 0 2px 6px rgba(35,18,0,0.04)`
- lead card: `0 16px 38px rgba(13,148,136,0.12), 0 2px 6px rgba(35,18,0,0.05)`
- amber spark: `0 0 0 5px rgba(255,191,0,0.18), 0 4px 12px rgba(255,191,0,0.45)`
- version badge: `0 3px 10px rgba(255,191,0,0.35)`

### Spacing
Safe inset 90px (top/btm 80px). Grid gap 50px. Card stack gap 14px. Card padding 17×19px.

---

## Interactions & Behavior
None — this is a **static image**. No hover/animation/responsive behavior. The only "state" is the per-release template content.

## Template / "state" (per release)
When generating each release's card, these are the variable inputs:
- `version` → version badge text (e.g. `v1.4`).
- `headline` → 1–2 line headline (keep ≤ ~16 JP chars/line at 50px to stay on the left column).
- `subline` → one supporting sentence.
- `features[]` → array of **2 or 3** objects: `{ icon, title, description, isNew?, chips?[] }`. First entry renders as the `lead` card with the amber spark.
Keep the brand lockup, license chip, colors, and layout fixed.

## Satori / @vercel/og porting notes (if using that pipeline)
- Satori is **flexbox-only** — the two-column safe area and card stack already use fl/flex-friendly structure; replace the outer CSS Grid with `display:flex` + explicit widths (`454px` / `flex:1`).
- Satori ignores `::before`/`::after` and `background` radial gradients → render the ambient glows as absolutely-positioned `<div>`s with `radial-gradient` backgrounds, and rebuild the CSS-pseudo-element icons (clock hands, bell) as small nested `<div>`s or swap to inline SVG icons.
- Load `Noto Sans JP` and `JetBrains Mono` as font buffers; JP glyphs require the full subset.
- Set the response as opaque PNG, 1200×630 (and a 2× variant if needed).

## Assets
Exported PNGs are included in this folder under `assets/`:
- `ogp-update-1200x630.png` — release card, 1× (lossless master).
- `ogp-update-2400x1260.png` — release card, 2× (upscaled from the 1× master).
- `ogp-1200x630.png` / `ogp-2400x1260.png` — evergreen product-intro card, 1× / 2×.

All icons are CSS geometry (no image assets). No external imagery is used. **Do not use the official kintone logo** — the product name as text only.

> Note on the 2× files: they were produced by 2× upscaling the 1× render (the preview tooling caps capture resolution). For a truly crisp 2×, regenerate from the HTML/template at 2400×1260 in your render pipeline.

## Files
- `OGP Card - Update.html` — **primary** release-announcement card (the one to implement).
- `OGP Card.html` — evergreen product-intro card (alternative).
- `assets/*.png` — exported images listed above.
- Brand reference (in the main project, for token cross-check): `styles.css`, `lp/styles.css`.
