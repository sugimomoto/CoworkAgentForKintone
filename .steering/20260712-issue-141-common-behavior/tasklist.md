# tasklist.md — 共有 base + COMMON_BEHAVIOR + Config 編集 + session override (#141)

design.md のマイルストーンに沿う。各 M で tsc/vitest 緑を維持。

## M1. commonPrompts 抽出 + COMMON_BEHAVIOR + 二重管理解消
- [ ] `core/bootstrap/commonPrompts.ts` 新設: `COMMON_BEHAVIOR`(新) / `COMMON_GUARDRAILS`(移設・メモリ除去) / `KINTONE_TOOLS_PROMPT`(移設) / `composeSystemPrompt`(移設) / `DEFAULT_BASE_SYSTEM_PROMPT`
- [ ] `builtInAgents.ts`: 上記を import 参照化 + persona 定数化 + SYSTEM_PROMPT = compose(BASE, persona)
- [ ] `resolveAgent.ts`: インライン guardrails/memory/plan 撤去 → 共有参照。DEFAULT を persona 化 + compose(BASE, persona)
- [ ] promptVersion 一斉 bump
- [ ] 既存テスト/fixture 追従（version・systemPrompt 断言）
- [ ] commonPrompts.test

## M2. agent_with_overrides + session override + built-in persona 化
- [ ] `resources.ts`: `CreateSessionParams.agent` に override 形態追加（型のみ）
- [ ] `resolveSession.ts`: `SessionContext.systemOverride` → agent_with_overrides で送信
- [ ] built-in/DEFAULT を **persona-only 焼き込み**に変更
- [ ] `resolvePersona(agentRecord)`: built-in/DEFAULT は purpose→code、custom は後続
- [ ] `useSession.ensureSession`: `systemOverride = base + persona` を構築して渡す（失敗は握りつぶし継続）
- [ ] resolveSession/persona テスト

## M3. custom persona 化 + persona 解決/キャッシュ
- [ ] `agentDetailApi.ts`: custom を persona-only 焼き込み（persona の保存/参照を確定）
- [ ] custom persona 解決 = retrieveAgent().system をメモ化 + applyAgentEdit で invalidate
- [ ] テスト

## M4. Plugin Config base 編集 + リセット
- [ ] Plugin Config 型/保存に `baseSystemPromptOverride?` 追加
- [ ] `effectiveBase()`: override 非空→それ、空→DEFAULT_BASE_SYSTEM_PROMPT
- [ ] ConfigScreen に `BasePromptSection` 差し込み（basePrompt.ts ヘルパー移植 + アコーディオン + リセット確認）
- [ ] ensureSession が effectiveBase() を使う
- [ ] BasePromptSection テスト

## 横断
- [ ] tsc/lint/vitest/build 緑 + ビフォーアフター評価
- [ ] docs/functional-design §0.15
- [ ] PR
