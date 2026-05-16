# Issue #30: Custom Skills インフラ + kintone 固有 skill 実装 — タスクリスト

## Phase 1: 本 PR スコープ

### インフラ

- [x] Skills API リファレンス確認 (multipart, beta header)
- [x] リポジトリ規約 (`packages/plugin/src/skills/<name>/SKILL.md`) を決める
- [x] `packages/plugin/scripts/build.mjs` に `generateSkillsBundle()` 追加 → `src/generated/skills-bundle.ts` 生成
- [x] Worker `/skills/sync` エンドポイント実装 (`packages/kintone-mcp/src/skills-sync.ts`)
  - [x] X-Anthropic-Api-Key 検証
  - [x] 既存 custom skills を `display_title` 検索
  - [x] 既存なら `POST /v1/skills/{id}/versions`、新規なら `POST /v1/skills` (multipart 構築)
  - [x] `{ name → skill_id, version, action }` を返却
- [x] Worker `index.ts` にルート追加
- [x] Plugin 側 `skillsSyncClient.ts` 実装 (kintone.plugin.app.proxy 経由で Worker を叩く)
- [x] `pluginConfig.ts` に `skillsMapping` / `skillsVersion` キー追加
- [x] `resolveAgent.ts` に `customSkillIds` / `skillsVersion` パラメータ追加 → metadata + skills 配列に反映
- [x] `useSession.ts` で plugin config から skill 情報を読み resolveDefaultAgent に渡す
- [x] `ConfigScreen.tsx` に「Skills 同期」セクション + ハンドラ + proxy 登録追加

### Skill 本体

- [x] `kintone-customize-js/SKILL.md` 作成
  - イベントタイプ表 (PC + モバイル)
  - レコード値の参照と書換え
  - フィールド型別の値形式表
  - 表示制御 (setFieldStyle / setFieldShown)
  - 非同期処理パターン
  - PC/モバイル切替
  - よくある落とし穴
- [x] `kintone-plugin-development/SKILL.md` 作成
  - manifest.json 構造
  - PLUGIN_ID 即時実行関数イディオム
  - setProxyConfig vs setConfig (秘匿情報の扱い)
  - config.html (64KB 上限!)
  - cli-kintone plugin keygen / pack / upload
  - webpack/esbuild 統合
  - よくある落とし穴

### テスト

- [ ] Worker `skills-sync.test.ts` 追加
- [ ] Plugin `skillsSyncClient.test.ts` 追加
- [ ] Plugin `pluginConfig.test.ts` (skillsMapping JSON parsing 等)
- [ ] `resolveAgent.test.ts` に customSkillIds / skillsVersion ケース追加
- [ ] `ConfigScreen.test.tsx` の 5 経路 → 6 経路に更新 (skills/sync 追加)
- [ ] 全テスト pass (Plugin + Worker)

### コミット

- [ ] git commit + #30 リンク
- [ ] ステアリングドキュメント (本ファイル) を含める

## Phase 2: 後続 PR

- [ ] `kintone-query/SKILL.md` 作成
- [ ] `kintone-error-recovery/SKILL.md` 作成
- [ ] `kintone-app-design/SKILL.md` 作成
- [ ] `kintone-batch-patterns/SKILL.md` 作成

## Phase 3: 後続 PR

- [ ] system prompt 内のクエリ説明 / カスタマイズパターン記述を skill 側に移管 → system prompt 削減
- [ ] トークン使用量を計測 (目標: 現状から ~30% 削減)

## Phase 4: 別 milestone

- [ ] 自社固有 skill の admin upload UI (Plugin Config に「カスタム skill 追加」タブ)
- [ ] Memory store (#15) と skill の役割分担を運用ドキュメントに明記
