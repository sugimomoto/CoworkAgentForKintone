# @cowork-agent/landing

Cowork Agent for kintone のランディングページ。GitHub Pages 上で配信される **3 ページ構成の静的サイト** (Astro)。

| ページ | パス | 状態 |
|---|---|---|
| メイン LP | `/` | 実装済み (Claude Design ハンドオフ準拠) |
| 管理者ヘルプ | `/help/admin/` | プレースホルダ (執筆待ち) |
| 業務ユーザーヘルプ | `/help/user/` | プレースホルダ (執筆待ち) |

## 開発

```bash
# ローカル開発サーバ
pnpm landing:dev      # → http://localhost:4321/CoworkAgentForKintone/

# 本番ビルド (dist/ に出力)
pnpm landing:build

# 本番ビルドをローカルで確認
pnpm landing:preview
```

## デプロイ

`main` ブランチへの push で [.github/workflows/pages.yml](../../.github/workflows/pages.yml) が起動し、自動的に GitHub Pages へデプロイされます。
GitHub リポジトリ Settings → Pages で **Source: GitHub Actions** に設定しておく必要があります。

公開 URL: `https://sugimomoto.github.io/CoworkAgentForKintone/`

## ディレクトリ構成

```
packages/landing/
├── astro.config.mjs       # site / base URL 設定 (GitHub Pages 向け)
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro       # 共通 head (フォント / OGP / canonical)
│   ├── components/
│   │   ├── Icon.astro              # ハンドオフの I.* SVG 群
│   │   ├── Wordmark.astro          # ロゴ + ワードマーク (LogoMarkA)
│   │   ├── chat/                   # ChatPanel / Greet / UserMsg / ToolCall / ResultCard / PlanCard 等
│   │   └── sections/               # Nav / Hero / Concept / RoleScenes / OfficeDocs / UseCases / Wedge / Setup / Differentiation / FAQ / CTA / Footer
│   ├── pages/
│   │   ├── index.astro             # メイン LP
│   │   └── help/
│   │       ├── admin/index.astro
│   │       └── user/index.astro
│   ├── scripts/
│   │   └── lp.ts                   # nav 影 / reveal / role tabs / wedge 状態機械 / setup スクロール連動
│   └── styles/
│       ├── styles.css              # ハンドオフから verbatim (ベーストークン / nav / hero / chat UI / kintone mock)
│       └── sections.css            # ハンドオフから verbatim (各セクション固有スタイル)
└── dist/                            # ビルド成果物 (gitignore)
```

## デザインソース

[docs/design-handoff/landing-page/](../../docs/design-handoff/landing-page/) に Claude Design のハンドオフバンドル原本を保管しています。
このディレクトリの `chats/` には完成までの議論経緯 (10 セッション分) が入っているので、UI 仕様で迷ったら一次ソースとして参照してください。

## 実装上のメモ

- **CSS はハンドオフから verbatim 流用**しています (`src/styles/styles.css` / `sections.css`)。CSS カスタムプロパティ (`--accent` / `--bg` / `--ink` 等) で全体トークンが定義されており、本体プラグインの teal `#0d9488` + warm cream `#faf8f3` 配色と整合しています。
- **チャット UI の演出アニメーション** (タイピング / 段階的メッセージ表示) は実装していません。各ユースケースは「**演出が完了した最終状態のスナップショット**」を静的 HTML で見せています。将来的に [src/scripts/lp.ts](src/scripts/lp.ts) に追加することは可能。
- **Wedge セクションの 4 状態ループ** (source → preview → apply → rollback) と **Setup セクションのスクロール連動** は vanilla TS で実装。React ランタイムは積んでいません。
- **画像アセットは本実装には含めていません**。ハンドオフの `lp/img/*.png` (artifact-apply / panel-hitl など) は現時点で `<img>` として使用していません。必要になったら `src/assets/` に取り込み、Hero やユースケースの mock を写真に差し替えてください。
- **検索エンジン向けメタ**: 各ページに `title` / `description` / `og:*` / `twitter:*` を設定済み。`canonical` URL は `Astro.site + base + page` から計算。
