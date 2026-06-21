# 設計: kintone アプリ構造設計スキル (`kintone-app-design`)

requirements.md の調査結果を受けた実装設計。

## 1. 成果物の全体像

| 種別 | パス | 変更 |
|------|------|------|
| 新スキル本体 | `packages/plugin/src/skills/kintone-app-design/SKILL.md` | 新規 |
| 生成 bundle | `packages/plugin/src/generated/skills-bundle.ts` | build で再生成 (3 entry に) |
| spec / prompt | `packages/plugin/src/core/bootstrap/builtInAgents.ts` | スキル名定数追加 / app-designer・customizer-sonnet の `customSkillFilter` を name ベース化 / `APP_DESIGNER_DOMAIN_PROMPT` 薄化 / promptVersion bump |
| skill 解決 | `resolveBuiltInAgents.ts` / `initializeSession.ts` | `customSkillFilter` に **skill 名**を渡すよう配線変更 |
| テスト | `builtInAgents.test.ts` / `resolveBuiltInAgents.test.ts` ほか | 期待値更新 |
| docs | `product-requirements.md` / `functional-design.md` | スキルの追記 |

## 2. 中核の機構変更: `customSkillFilter` を name ベースに

### 現状の問題
- `resolveBuiltInAgents.ts` は `spec.customSkillFilter(id)` に **skill_id** を渡す (L145)。
- 一方 UI (`AgentsListPane.tsx` / `buildDraft.ts`) は `customSkillFilter(b.name)` と **name** を渡す。
- 全 variant が `() => true` / `() => false` の「全か無か」だったため、この不整合は表面化していなかった。
- role 別スキル (app-designer だけ app-design、customizer-sonnet は JS/plugin だけ) を実現するには
  **name で識別**する必要がある。

### 変更
1. `BuiltInResolveOptions.customSkillIds: ReadonlyArray<string>` を
   `customSkills?: ReadonlyArray<{ name: string; skillId: string }>` に変更 (name を同伴)。
   - in-flight キャッシュキーは `skillId` を sort して使う (挙動不変)。
   - 作成ループ: `if (spec.customSkillFilter(s.name)) skills.push({ type: 'custom', skill_id: s.skillId })`。
2. `initializeSession.ts`: `resolveBundledSkillIds()` の戻り (`{ name, skillId }` を持つ) から
   `skillId != null` のものを `{ name, skillId }` ペアにして `resolveBuiltInAgents` に渡す。
   - フォールバック経路の `resolveDefaultAgent` には従来どおり `skillId` の配列を渡す (こちらは全 attach の
     degraded 経路なので変更しない)。
3. `builtInAgents.ts` に定数 `export const APP_DESIGN_SKILL_NAME = 'kintone-app-design'`。
   - app-designer: `customSkillFilter: (name) => name === APP_DESIGN_SKILL_NAME`
   - customizer-sonnet: `customSkillFilter: (name) => name !== APP_DESIGN_SKILL_NAME`
     (従来 `() => true` = 全 custom skill を attach。app-design だけ除外して JS/plugin + admin 追加分は維持)
   - business / customizer-opus: 変更なし (`() => false`)

> UI 経路 (`AgentsListPane` / `buildDraft`) は元から name を渡しているので**変更不要**。本変更で resolve 経路
> も name 基準に揃い、二重基準が解消する。

## 3. promptVersion bump で再 attach

- 既存 app-designer Agent は find filter (purpose + promptVersion + workerUrl + kintoneDomain + toolsVersion)
  で再利用される。スキルは**作成時のみ** attach されるため、既存 Agent に後から skill を足すには
  promptVersion を変える必要がある。
- `'v1-app-designer'` → `'v2-app-designer'` に bump。これで (a) 薄くした新プロンプト (b) app-design skill 付与
  の両方が、再 bootstrap 時の新規作成で反映される。
- **運用順序の制約** (既存スキル基盤と同じ): admin が先に「Skills 同期」を押して skill_id を発番してから
  プロンプト bump が効くと、新 Agent に skill が attach される。同期前に bootstrap が走ると skill 無しで
  作られる (= 既存 kintone-customize-js と同じ既知の挙動)。リリースノート / README に「配信時は Skills 同期を
  先に」を明記する。自己修復 (skillsVersion reconcile) は今回スコープ外。

## 4. `APP_DESIGNER_DOMAIN_PROMPT` の薄化

調査で「現プロンプトの知識本体 (予約コード / options 形状 / 全置換 / preview-deploy / filterCond) は
ツール description と重複」と判明。常駐プロンプトには**判断に必須の最小限**だけ残し、詳細はスキルへ。

### 残す (コア)
- 【役割】【進め方 1〜5】【安全則】【役割の境界】 … エージェントの行動規範。重複しても薄く保つ
- 【最重要・常時意識】の 3 行に圧縮:
  - 更新系は全置換 → 必ず get-* で現状取得 → 残す分も含め全体を PUT
  - 変更は preview に積まれ kintone-deploy-app まで本番反映されない
  - **計算フィールド・フィールド設計の落とし穴は `kintone-app-design` スキルを参照する** (← 誘導)

### スキルへ移す (詳細)
- 予約コード一覧 / options の index 文字列 / filterCond のフィールド型別演算子
- 計算フィールドの関数・戻り型・CONVERT! 判断・日付レシピ (= 新規の核心)

## 5. SKILL.md の構成 (単一ファイル)

既存 2 skill に倣い 1 ファイル構成 (references/ 分割はしない。計算式リファレンスも 1 章に収まり bundle 小)。

```
---
name: kintone-app-design
description: <REST/管理ツールで kintone アプリを設計・構築するとき (フィールド/計算/レイアウト/
  ビュー/プロセス管理/権限/deploy)、特に計算フィールドのエラー (CONVERT! 等) や型・表示形式で迷うときに参照>
---

# kintone アプリ設計スキル

## 1. メンタルモデル (preview→deploy / 全置換 / 追加とレイアウトは別)
## 2. 計算フィールド完全リファレンス  ← 核心
   - 関数インベントリと戻り型 (数値系 SUM/ROUND系/YEN, 論理 IF/AND/OR/NOT/CONTAINS, 文字列 DATE_FORMAT, &)
   - CONVERT! 判断ルール: 「式が文字列を返す → 数値/日付表示形式に出せず CONVERT!」
   - 日付レシピ: N日後 = `date + days*24*60*60` を **format=DATE** で (DATE_FORMAT 不要)
   - 日付は内部 UNIX秒・Etc/GMT 固定 / タイムゾーンずれ / #DIV/0!
   - 表示形式 enum (NUMBER/NUMBER_DIGIT/DATETIME/DATE/TIME/HOUR_MINUTE/DAY_HOUR_MINUTE)
## 3. 構築レシピ (create-app→add-form-fields→update-form-layout→views→process→acl→deploy)
   - 全置換ツールの get→merge→put、deploy 後の get-app-deploy-status 待機、revert
## 4. 早見表 (設計時に一望)
   - 予約フィールドコード / options 形状 / filterCond 型別演算子 / フィールド種別の要点
## 5. エラー早見 (CONVERT! / #DIV/0! / 予約コード 400)
```

内容は requirements.md「公式情報の調査結果」+ 公式ヘルプ (autocalc_format / example_operators /
date_format_timezone) を一次ソースとする。

## 6. テスト方針

- `builtInAgents.test.ts`:
  - `APP_DESIGN_SKILL_NAME` の app-designer フィルタ: `('kintone-app-design')→true`, 他名→false
  - customizer-sonnet フィルタ: `('kintone-app-design')→false`, 任意の別名→true
  - app-designer promptVersion = `'v2-app-designer'`
- `resolveBuiltInAgents.test.ts`:
  - `customSkills` 渡しで app-designer の作成 body に app-design の skill_id が custom skill として入る
  - customizer-sonnet の body には app-design skill_id が**入らない**
  - 既存テストの option 名 (`customSkillIds`→`customSkills`) 追従
- skill bundle: `pnpm build` 再生成で skills-bundle.ts が 3 entry になることを確認 (テストではなくビルドで担保)。
  build.mjs の frontmatter バリデーション (name 正規表現 / description ≤1024) を通すこと。
- `AgentsListPane` / `buildDraft` は name ベースのまま → 既存テスト green を確認。

## 7. 影響範囲・非互換

- `BuiltInResolveOptions` の option 名変更は内部 API (呼び出しは initializeSession のみ)。外部非互換なし。
- 既存 app-designer Agent は promptVersion bump で 1 度だけ再作成される (metadata の編集済 quickActions/ACL は
  #75 のとおり metadata 優先で引き継がれる)。
- 配信運用: Skills 同期 → (プロンプト bump 済コード配信) の順を docs に明記。
