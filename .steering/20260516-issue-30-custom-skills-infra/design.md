# Issue #30: Custom Skills インフラ + kintone 固有 skill 実装 — 設計

## 全体アーキテクチャ

```
[ビルド時]
packages/plugin/src/skills/
  ├─ kintone-customize-js/SKILL.md
  └─ kintone-plugin-development/SKILL.md
       ↓ build.mjs が読み取り
src/generated/skills-bundle.ts   (SKILL_BUNDLES + SKILLS_VERSION)
       ↓ esbuild が IIFE バンドル
plugin/js/config.js / desktop.js


[実行時 — 同期 (admin が ConfigScreen の「Skills 同期」を押す)]
ConfigScreen
  ↓ syncSkills() (kintone.plugin.app.proxy)
Worker `/skills/sync` (X-Anthropic-Api-Key を kintone proxy 経由で受領)
  ↓ multipart 構築 + 既存 skill 検索
Anthropic /v1/skills (新規) OR /v1/skills/{id}/versions (既存更新)
  ↓ JSON で skill_id + version 返却
Worker 経由でレスポンス → Plugin
  ↓ kintone.plugin.app.setConfig
plugin config に { name → skill_id } mapping + SKILLS_VERSION を保存


[実行時 — Agent 作成 (新規セッション開始時)]
useSession.ts
  ↓ getPluginConfig() で skillsMapping + skillsVersion を取得
resolveDefaultAgent({ customSkillIds, skillsVersion, ... })
  ↓ Anthropic 製 4 skill + custom skill を skills 配列に統合
Agent metadata に skillsVersion を含めて create
  ↓ 同 metadata の既存 Agent がいれば再利用、なければ新規作成
```

## 設計判断

### なぜ Worker 中継 (`/skills/sync`) を挟むか

- kintone.plugin.app.proxy は body を string で渡す API。**multipart/form-data 構築は煩雑**
- Anthropic Skills API は `multipart/form-data` 必須 (`files[]` フィールドに `SKILL.md` を入れる)
- → Plugin は JSON で `{ skills: [{name, displayTitle, skillMd}] }` を送り、Worker 側で multipart 化
- これは Issue #29 (Files DL) / Issue で確立した「Worker = kintone 制約の吸収層」パターンと一貫

### なぜ `display_title` で既存検索するか

- Anthropic Skills API には `name` で skill を一意検索する手段がない (リストして自前でフィルタする必要)
- 一度 upload した skill の skill_id は workspace スコープで安定
- 同名 (= same display_title) なら **既存 skill の新バージョン作成** ルート (`POST /v1/skills/{id}/versions`) に乗せる
- 違う名前なら新規 skill 作成
- 結果として、何度同期ボタンを押しても skill_id は変わらず、内容変更時はバージョンが上がる

### Plugin Config への保存方針

```ts
// CONFIG_KEY_SKILLS_MAPPING = "skillsMapping" (JSON 文字列で保存)
{
  "kintone-customize-js":         { skillId: "skill_abc...", version: "1759178010641129" },
  "kintone-plugin-development":   { skillId: "skill_xyz...", version: "1759178010987456" }
}

// CONFIG_KEY_SKILLS_VERSION = "skillsVersion"
"sha256:5ee1192d02aaa5ac"
```

- mapping は workspace 依存 (= API Key 紐付け)。API Key を変えたら同期し直さないとならない
- skillsVersion は ローカル skill bundle の SHA-256 短縮ハッシュ。資源変化を検出する用途

### `resolveDefaultAgent` の挙動

- 既存: `metadata.promptVersion` ベースで Agent を識別
- 追加: `metadata.skillsVersion` も識別子として使う
  - 内容変化で別 Agent 扱い (= 旧 skill set を持った Agent はそのまま残るが、Plugin は新しいほうを使う)
- in-flight キャッシュキーにも skillsVersion + customSkillIds (sorted) を含める

### skill ファイル名と Anthropic 側の `name`

- SKILL.md frontmatter の `name` (例: `kintone-customize-js`) と Anthropic 側の `display_title` を **同じ値** で扱う (シンプル化のため)
- ディレクトリ名と frontmatter `name` の一致は build 時に検証

## ファイル変更箇所

| ファイル | 変更 |
|---|---|
| `packages/plugin/src/skills/README.md` | 新規。skill 規約ドキュメント |
| `packages/plugin/src/skills/kintone-customize-js/SKILL.md` | 新規 |
| `packages/plugin/src/skills/kintone-plugin-development/SKILL.md` | 新規 |
| `packages/plugin/scripts/build.mjs` | `generateSkillsBundle()` 追加 |
| `packages/plugin/src/generated/skills-bundle.ts` | 自動生成 |
| `packages/kintone-mcp/src/skills-sync.ts` | 新規。Worker `/skills/sync` ハンドラ |
| `packages/kintone-mcp/src/index.ts` | ルート追加 |
| `packages/plugin/src/core/skills/skillsSyncClient.ts` | 新規。Plugin → Worker /skills/sync クライアント |
| `packages/plugin/src/core/kintone/pluginConfig.ts` | skillsMapping / skillsVersion キー追加 |
| `packages/plugin/src/core/bootstrap/resolveAgent.ts` | `customSkillIds` / `skillsVersion` パラメータ受領、Agent 作成時に attach + metadata 反映 |
| `packages/plugin/src/desktop/hooks/useSession.ts` | PluginConfig から skill 情報を読み、resolveDefaultAgent に渡す |
| `packages/plugin/src/config/ConfigScreen.tsx` | 「Skills 同期」セクション + button + handler 追加。proxy 登録に `/skills/sync` POST 追加 |
| `packages/plugin/src/test/fixtures.ts` | promptVersion v18 → v19 (skillsVersion 機能追加で別 Agent 扱い) |

## エラー処理

- Worker `/skills/sync` の失敗時:
  - 401 (api key missing): Plugin が「API Key が proxy に登録されていません」表示
  - 502 (Anthropic 側エラー): エラーメッセージ + `partialResults` を保持 (一部だけ成功している場合の情報)
- Plugin 側で `SkillSyncError` を catch して UI 表示
- 同期失敗時は plugin config を **書換えない** (古い mapping を保つ → resolveDefaultAgent は引き続き旧 skill_id を使う)

## 段階的リリース

本 PR で対応:
- Step 2: インフラ (Worker / Plugin client / build / ConfigScreen)
- Step 3 (一部): `kintone-customize-js` / `kintone-plugin-development` の 2 skill

後続 PR で:
- Step 3 (残り): `kintone-query` / `kintone-error-recovery`
- Step 4: `kintone-app-design` / `kintone-batch-patterns`
- Step 5: system prompt スリム化
- Step 6: 自社固有 skill の admin upload UI
