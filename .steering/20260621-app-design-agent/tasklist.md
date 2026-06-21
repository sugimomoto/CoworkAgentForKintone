# タスクリスト: アプリ設計エージェント (built-in 4th variant) — #117

確定: purpose=`app-designer` / Opus / 全 kintone ツール (`()=>true`) / skills=pdf,docx,xlsx,pptx /
admin gate なし / propose_app なし。

## T1. 型
- [x] `agentTypes.ts`: `AgentPurpose` に `'app-designer'` 追加

## T2. spec + system prompt
- [x] `builtInAgents.ts`: `APP_DESIGNER_SYSTEM_PROMPT` / `APP_DESIGNER_QUICK_ACTIONS` 定義
- [x] `BUILTIN_AGENT_SPECS['app-designer']` 追加 (name/model=opus/skills 4種/mcpToolFilter=()=>true/icon/isDefault:false)
- [x] `BUILTIN_PURPOSES` 配列に `'app-designer'` 追加

## T3. 解決パス
- [x] `resolveBuiltInAgents.ts`: `BuiltInAgentSet` に `appDesigner` / `Promise.all` に 4 つ目 / return に追加
- [x] `initializeSession.ts`: `toAgentRecords` に追加 / ローカル `agentToRecord` の purpose union 更新
- [x] `agentRecord.ts`: `isBuiltInPurpose` に `'app-designer'`

## T4. テスト
- [x] `builtInAgents.test`: app-designer spec (opus / ()=>true で管理系を通す / skills 4種)
- [x] `resolveBuiltInAgents` / `initializeSession` テストの 3→4 variant 更新

## T5. 検証・docs・PR
- [x] `pnpm -r test` / typecheck / lint green
- [x] docs: 機能一覧に F-23 追記 / functional-design に §0.11 (built-in 4th variant) を追加
- [ ] PR (closes #117)

## 実装順
T1 → T2 → T3 → T4 → T5。
