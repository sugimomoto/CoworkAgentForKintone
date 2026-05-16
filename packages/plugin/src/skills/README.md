# Custom Skills

Cowork Agent for kintone が Anthropic Skills API にアップロードする **kintone 固有のドメイン skill** を置くディレクトリ。Issue #30 で導入。

## 規約

- 各 skill は `<skill-name>/SKILL.md` の 1 ファイル構成 (現状)
- ディレクトリ名 = skill name (YAML frontmatter `name` と一致)
- `SKILL.md` は YAML frontmatter で `name` と `description` を必須に持つ:

```markdown
---
name: kintone-customize-js
description: kintone の JavaScript カスタマイズ (kintone.events.on / kintone.app.record 等) を書くときの定石・パターン・落とし穴集。フィールドコード参照、イベントハンドラ、表示制御、Promise 非同期処理、PC/モバイル切替、kintone REST API 呼出パターンを扱うときに参照する。
---

# kintone Customize JS

(本文)
```

## 制約 (Anthropic Skills API 仕様)

- `name`: lowercase + 数字 + ハイフンのみ、最大 64 文字、予約語 `anthropic` / `claude` 不可
- `description`: 1-1024 文字、XML タグ不可
- skill bundle 合計サイズ < 30MB
- 同一 Anthropic workspace 内で `name` ベースで識別される (本実装は `display_title` でも検索)

## ビルド統合

`packages/plugin/scripts/build.mjs` が `packages/plugin/src/skills/*/SKILL.md` を読み取り、`packages/plugin/src/generated/skills-bundle.ts` に下記形式で焼き込む:

```ts
export const SKILL_BUNDLES = [
  {
    name: 'kintone-customize-js',
    displayTitle: 'kintone Customize JS',
    skillMd: '<full SKILL.md content>',
  },
  ...
];
```

Plugin (ConfigScreen) の「Skills 同期」ボタンが上記を Worker `/skills/sync` 経由で Anthropic にアップロードする。

## 同期フロー

```
ConfigScreen 同期ボタン
  ↓ Plugin → kintone proxy → Worker /skills/sync (JSON 形式)
Worker:
  1. GET /v1/skills?source=custom で既存検索
  2. display_title マッチで既存あり → POST /v1/skills/{id}/versions
     なし → POST /v1/skills (新規)
  3. {name → skill_id} mapping を JSON で返却
Plugin: mapping を plugin config に保存 → resolveAgent.ts が次回 Agent 作成時に attach
```

## 追加方法

新しい skill を増やすときは:

1. `packages/plugin/src/skills/<new-skill>/SKILL.md` を作成
2. 次のビルドで自動的に bundle に取り込まれる
3. admin が ConfigScreen 「Skills 同期」を押すと workspace に upload される
4. 次回 Agent 作成時に attach される (promptVersion or skillsVersion を bump)
