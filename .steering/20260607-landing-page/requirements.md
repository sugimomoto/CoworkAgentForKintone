# requirements.md — Cowork Agent for kintone LP (GitHub Pages)

## 1. 目的

Cowork Agent for kintone の **コンセプト・活用方法・製品ヘルプ・導入手順** を解説する公開 Web ページを GitHub Pages 上に公開し、**OSS 導入 (GitHub スター / プラグインインストール) を促進する**。

業務ユーザーが「これは自分の kintone 業務をどう変えるか」を直感的に理解できることを最優先とし、その流れで管理者が「導入は簡単そうだ」と感じられる動線を作る。

## 2. スコープ

### 2.1 含む

- **メイン LP** (`/`) — 1 ページスクロール完結型ランディングページ
  - Hero / コンセプト / 業務ユーザー向け活用例 / 情シス向け差別化機能 (wedge) / 管理者向け導入の簡易性 / 差別化ポイント / FAQ / Footer CTA
- **管理者向けヘルプページ** (`/help/admin/`) — 別ページ
  - インストール手順、Anthropic API Key 設定、Cloudflare Worker デプロイ、kintone OAuth クライアント登録、Agent / Skill キュレーション、運用 FAQ
- **業務ユーザー向けヘルプページ** (`/help/user/`) — 別ページ
  - チャットの始め方、クイックアクション、レコード操作の依頼例、HITL 承認の流れ、エラー時の対処、FAQ
- **GitHub Pages 公開用ワークフロー** (`.github/workflows/pages.yml`) — `main` ブランチへの push でビルド → GitHub Pages へデプロイ
- **OGP / favicon** — SNS シェア時の画像 + サイト favicon
- **SEO 基本対応** — title / description / OGP / sitemap / robots.txt / 構造化データ (Organization / Article)
- **アクセシビリティ** — WCAG 2.1 AA レベル相当を目指す (キーボード操作 / コントラスト / セマンティック HTML)

### 2.2 含まない (今回はやらない)

- **多言語対応** — V1 は日本語のみ (英語化は将来検討、本書の対象外)
- **ブログ / アップデート記事** — リリースノートは GitHub Releases に任せる
- **動的コンテンツ** — お問い合わせフォーム / アカウント / ログイン / 検索などは不要
- **CMS 連携** — Markdown / MDX で完結させる
- **本格的なドキュメントサイト構築** — Docusaurus / VitePress 級のフル機能は不要。help は 2 ページのみ
- **ロゴ・ブランドカラーの自前設計** — Claude Design (claude.ai/design) に依頼するため、本タスクのスコープ外
- **動画コンテンツ制作** — まずは静止画 + GIF で十分

## 3. ユーザーストーリー

### 3.1 業務ユーザー (kintone を日常で使う、AI プラグイン未経験)

- AS A 業務ユーザー
- I WANT LP を見て **「これを入れると自分の kintone 業務がどう楽になるか」が 30 秒以内にわかる**
- SO THAT 「面白そう、社内の情シスに相談してみよう」と思える

### 3.2 業務ユーザー (導入後に使い方を学びたい)

- AS A 業務ユーザー
- I WANT **業務ユーザー向けヘルプページ** でクイックアクションの押し方やチャットの作法を確認できる
- SO THAT プラグインが入っていればすぐに使い始められる

### 3.3 kintone 管理者・情シス (導入を検討する立場)

- AS A 管理者
- I WANT LP で **「何ステップで導入できるか」「セキュリティはどうなっているか」が明確**
- SO THAT 社内提案や PoC 着手の意思決定がすぐにできる

### 3.4 kintone 管理者 (実際に手を動かしてインストールする)

- AS A 管理者
- I WANT **管理者向けヘルプページ** に Cloudflare Worker / OAuth / Plugin Config の手順が網羅されている
- SO THAT エラーで詰まらず、自走でセットアップを完了できる

### 3.5 情シス・カスタマイザー (差別化機能に惹かれる人)

- AS A 情シス
- I WANT LP の wedge セクションで **カスタマイズ JS を会話で作って → preview → apply → rollback** の流れが視覚的に理解できる
- SO THAT 既存の kintone カスタマイズ業務との違いを直感的に把握でき、試してみる動機になる

## 4. 受け入れ条件

### 4.1 メイン LP (`/`)

- [ ] AC-1: Hero に **製品名 / 1 行キャッチコピー / サブコピー / 製品ビジュアル (GIF or 静止画) / CTA × 2** (GitHub / インストール手順) が含まれる
- [ ] AC-2: 「コンセプト」セクションで **サイドパネル常駐 / 非同期実行 / HITL 承認** の 3 つの特徴が説明される
- [ ] AC-3: 「業務ユーザー向け活用例」セクションに **役割別の業務シナリオ** (営業 / カスタマーサポート / 人事 を最低として、経理 / 総務情シスは補足扱い可) が、それぞれ **3〜4 個の具体的な依頼例** + チャット応答モックの形で掲載される。タブ / アコーディオン / セレクター等で切り替え可能なインタラクションを推奨。詳細な依頼例リストは [design-brief-addendum-usecases.md](design-brief-addendum-usecases.md) を参照
- [ ] AC-3-2: 「Office ドキュメント生成」セクション (業務ユーザー活用例の直後) が独立して存在し、**Excel / Word / PowerPoint / PDF** の 4 形式すべてについて、(1) チャット依頼の吹き出しモック、(2) 成果物ファイル名 + サムネイル、(3) ダウンロード CTA の 3 要素が示される。詳細は [design-brief-addendum-document-skills.md](design-brief-addendum-document-skills.md) を参照
- [ ] AC-4: 「情シス向け wedge」セクションでカスタマイズ JS の **生成 → preview → apply → rollback** ループが視覚的に示される
- [ ] AC-5: 「管理者向け導入の簡易性」セクションで **5 ステップ以内のセットアップ** が図解され、`/help/admin/` への遷移ボタンがある
- [ ] AC-6: 「なぜ Cowork Agent か」セクションで Claude Managed Agents / 非同期 / OSS / Vault による secret 管理が説明される
- [ ] AC-7: FAQ セクションに **料金 / 対応 kintone プラン / セキュリティ / OSS ライセンス** の 4 項目以上が含まれる
- [ ] AC-8: Footer に GitHub リポジトリ / 問い合わせ・バグ報告 (GitHub Issues) / インストール手順 / 業務ヘルプ / 管理者ヘルプ への動線がある (ユーザーからのフィードバック窓口として。コントリビューション募集は対象外)
- [ ] AC-9: **モバイル (375px 幅) でも縦スクロールで完結し、横スクロールが発生しない**
- [ ] AC-10: ページロード後 **3 秒以内に First Contentful Paint** が完了する (実測ターゲット、Lighthouse Performance ≥ 90)

### 4.2 管理者向けヘルプ (`/help/admin/`)

- [ ] AC-11: インストール手順が **目次 + ステップ番号付き** で書かれている
- [ ] AC-12: Plugin Config 画面の **4 ステップウィザード** (Cloudflare デプロイ → Anthropic API Key → kintone OAuth クライアント追加 → client_id/secret 入力) が画像付きで網羅される
- [ ] AC-13: トラブルシューティング (OAuth エラー / Worker デプロイ失敗 / API Key 無効 等) のセクションがある
- [ ] AC-14: セキュリティの解説 (Worker ステートレス / Vault Credential / setProxyConfig による secret 隠蔽) が含まれる
- [ ] AC-15: メイン LP に戻る導線が Header にある

### 4.3 業務ユーザー向けヘルプ (`/help/user/`)

- [ ] AC-16: チャットパネルの開き方 / Header の見方 / Composer の使い方が画像付きで説明される
- [ ] AC-17: **クイックアクション** の押し方と、押した後の編集→送信フローが説明される
- [ ] AC-18: **HITL 承認** (破壊的操作の確認カード) の操作方法が説明される
- [ ] AC-19: よくある依頼例 (検索 / 集計 / 一括更新 / アプリ横断転記) が会話例として 3 つ以上掲載される
- [ ] AC-20: エラー時の対処 (再連携バナー / 新規セッション開始) が説明される

### 4.4 デプロイ・運用

- [ ] AC-21: `main` ブランチへの push で **GitHub Pages へ自動デプロイ** される (`.github/workflows/pages.yml`)
- [ ] AC-22: ローカルで `pnpm landing:dev` (またはパッケージ独自の dev script) で開発サーバが起動できる
- [ ] AC-23: `pnpm landing:build` で `dist/` に静的ファイルが出力される
- [ ] AC-24: ビルド成果物は `.gitignore` で除外される

### 4.5 SEO / アクセシビリティ

- [ ] AC-25: 各ページに固有の `<title>` / `<meta description>` / OGP タグ (og:title / og:description / og:image) が設定される
- [ ] AC-26: `sitemap.xml` / `robots.txt` が自動生成される
- [ ] AC-27: Lighthouse SEO スコア ≥ 95、Accessibility スコア ≥ 90
- [ ] AC-28: 全画像に意味のある `alt` 属性が付く
- [ ] AC-29: キーボードのみで全 CTA / リンクへ到達できる

## 5. 制約事項

### 5.1 技術選定

- **Astro** を採用する (静的サイト生成、MDX サポート、軽量、SEO 強い、GitHub Pages デプロイの実績豊富)
- **Tailwind CSS** で統一 (既存 Plugin と同じトークン体系を流用しやすい)
- 配置は **`packages/landing/`** として既存 pnpm workspace に追加
- 追加の外部 SaaS 連携 (Vercel / Netlify / Cloudflare Pages 等) は使わず GitHub Pages のみ

### 5.2 トーン & デザイン方針

- **フレンドリー** — 専門用語を多用せず、業務ユーザーが読んで「むずかしそう」と感じない口調
- 同時に技術的正確性は犠牲にしない (管理者・情シスが読むセクションは正確な用語を使う)
- **絵文字は控えめ** に使う (LP の見出しに 1〜2 個程度、ヘルプ本文では使わない)
- ロゴ・ブランドカラー・キービジュアル・セクションごとのイラストは **Claude Design (claude.ai/design) で別途設計** する (本書では決定しない)

### 5.3 配信

- **GitHub Pages** で公開
- カスタムドメイン (例: `cowork-agent.kintone-help.dev` のような) は将来検討。V1 は `<org>.github.io/<repo>/` の素のドメインで OK
- HTTPS は GitHub Pages 標準のものを利用

### 5.4 著作権・ライセンス

- 製品本体と同じ **MIT License** をフッターに表記
- スクリーンショット・GIF に映る kintone 画面は **本リポジトリの開発環境 (架空のサンプルデータ)** のみを使い、第三者のデータが映り込まないこと

## 6. 参考資料

- 既存のプロダクト全体仕様: [docs/product-requirements.md](../../docs/product-requirements.md), [docs/functional-design.md](../../docs/functional-design.md)
- 用語: [docs/glossary.md](../../docs/glossary.md)
- 既存の Claude Design ハンドオフ実績: [docs/design-handoff/customizer-wedge/](../../docs/design-handoff/customizer-wedge/)
- 既存の Plugin ブランドカラー (参考): teal `#0d9488` (Claude Design への提案として渡すかは設計フェーズで判断)

## 7. 関連 Issue / Steering

- 親 Issue: (新規作成予定) — LP 公開タスクとして起票
- 関連: 既存の全ステアリング (LP のコンテンツソースとして全機能の理解が必要)

## 8. 成功の定義

- [ ] LP が GitHub Pages 上で公開され、URL が README に記載されている
- [ ] 業務ユーザーが LP を読んで「使ってみたい」と思え、管理者向けヘルプへの導線が機能している
- [ ] 管理者がヘルプページだけを見て、外部記事を漁らずにセットアップを完走できる
- [ ] Lighthouse スコア: Performance ≥ 90 / SEO ≥ 95 / Accessibility ≥ 90
- [ ] 公開後 1 ヶ月以内に GitHub スター・インストール経路からのアクセス数の baseline を計測できる状態にする
