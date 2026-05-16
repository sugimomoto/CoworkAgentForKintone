# Issue #30: Custom Skills インフラ + kintone 固有 skill 実装 — 要求

## 背景

- Issue #18 (Skills 統合) で Step 1 (Anthropic 製 skills の attach) は完了済 (#18 closed)
- 残りの Step 2〜6 を本作業で扱う
- Issue #9 (umbrella) の戦略再設定で、ターゲットを **情シス・カスタマイザー** に絞った wedge 戦略へ。これに伴い kintone 固有 custom skill (特に `kintone-customize-js` / `kintone-plugin-development`) の優先度が最重要に

## ゴール

1. **Custom Skills インフラ** — リポジトリ内 SKILL.md → Anthropic workspace へ Plugin 設定画面の操作で同期できる仕組み
2. **kintone 固有 skill の同梱配布** — `kintone-customize-js` / `kintone-plugin-development` の 2 つを最低限提供
3. **Default Agent への自動 attach** — 同期済 custom skill を `resolveDefaultAgent` が attach する経路を実装
4. **skillsVersion による Agent 同一性管理** — skill 内容変更時に別 Agent 扱いにする (promptVersion と同じ思想)

## ユーザーストーリー

- **情シス担当**「ユーザー問合せをアプリ追加画面で必須チェックする JS を書いて」と頼むと、Agent が **kintone-customize-js skill を自動ロード**し、kintone.events.on + event.error + return event の定石に沿った正しいコードを返してくれる
- **Plugin 開発者**「自社用 Plugin の雛形を作って」と頼むと、Agent が **kintone-plugin-development skill** を読み、`manifest.json` / `PLUGIN_ID` 即時実行関数イディオム / `setProxyConfig` パターンを正しく適用したコードを返してくれる
- **admin**「設定画面の `Skills を同期` ボタンを 1 回押すだけ」で上記が有効化される。エラーや version が見える

## 受入条件

- [ ] `packages/plugin/src/skills/<name>/SKILL.md` 形式で skill bundle を配置できる
- [ ] ビルド時 (`pnpm plugin:build`) に `src/generated/skills-bundle.ts` が生成される
- [ ] ConfigScreen に「Skills 同期」ボタンが追加され、押下で Worker `/skills/sync` 経由で Anthropic にアップロードされる
- [ ] アップロード後、`skill_id` mapping が plugin config に保存される
- [ ] `resolveDefaultAgent` が plugin config から skill_id を読み、Anthropic 製 4 skill + custom skill を attach した Agent を作成する
- [ ] skill 内容が変わると `SKILLS_VERSION` (sha256 短縮ハッシュ) が変わり、`metadata.skillsVersion` 経由で別 Agent として扱われる
- [ ] `kintone-customize-js` / `kintone-plugin-development` の 2 skill が同梱されている
- [ ] テスト全パス

## スコープ外 (将来 Issue)

- 残り 4 つの skill (`kintone-query` / `kintone-error-recovery` / `kintone-app-design` / `kintone-batch-patterns`) — 段階的に追加
- system prompt のスリム化 (skill に移したパターンを system prompt から削除してトークン削減) — 効果検証込みで別 PR
- ユーザー自社固有 skill の admin upload UI (Step 6) — 別 milestone

## 関連

- Issue #30 (本作業)
- Issue #9 (umbrella, 情シス wedge 戦略)
- Issue #18 (Step 1 完了済)
- Issue #20 (カスタマイズ JS プレビュー / 適用) — 本 skill が品質を底上げする
- Issue #17 (GitHub 連携) — `kintone-plugin-development` skill が cli-kintone / .ppk 周りを補完
