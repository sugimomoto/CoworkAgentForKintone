# タスクリスト: kintone-app-design スキル

## T1. スキル本体
- [x] `packages/plugin/src/skills/kintone-app-design/SKILL.md` を作成 (frontmatter + 本文 5 章)
- [x] `pnpm build` で `src/generated/skills-bundle.ts` を再生成 (3 entry / frontmatter バリデーション通過)

## T2. name ベース customSkillFilter 配線
- [x] `resolveBuiltInAgents.ts`: option を `customSkills?: {name, skillId}[]` に変更、ループを name 判定に
- [x] `initializeSession.ts`: `resolveBundledSkillIds()` から `{name, skillId}` ペアを構築して渡す
      (skillId!=null のみ)。フォールバック resolveDefaultAgent には従来の id 配列を渡す

## T3. spec / prompt
- [x] `builtInAgents.ts`: `export const APP_DESIGN_SKILL_NAME = 'kintone-app-design'`
- [x] app-designer `customSkillFilter: (name)=>name===APP_DESIGN_SKILL_NAME` / promptVersion `v2-app-designer`
- [x] customizer-sonnet `customSkillFilter: (name)=>name!==APP_DESIGN_SKILL_NAME`
- [x] `APP_DESIGNER_DOMAIN_PROMPT` を薄化 (必須最小 + skill 参照誘導、詳細はスキルへ移管)

## T4. テスト
- [x] `builtInAgents.test`: フィルタ name 判定 / promptVersion v2
- [x] `resolveBuiltInAgents.test`: customSkills 渡しで app-designer に app-design skill_id が attach /
      customizer-sonnet には入らない / option 名追従
- [x] `AgentsListPane` / `buildDraft` 既存テスト green 確認

## T5. docs・検証・PR
- [x] `pnpm -r test` / typecheck / lint green、`pnpm build` green
- [x] docs: product-requirements F-23 にスキル追記 / functional-design §0.11 にスキル言及 /
      src/skills/README は既存「追加方法」で充足 (必要なら同期順序の注記)
- [x] PR

## 実装順
T1 → T2 → T3 → T4 → T5
