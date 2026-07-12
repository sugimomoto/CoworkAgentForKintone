# requirements.md — システムプロンプトの共有 base 化 + 基本作法(COMMON_BEHAVIOR) 取込 (#141)

親 Issue: [#141](https://github.com/sugimomoto/CoworkAgentForKintone/issues/141)（enhancement / size M / P3 / target:shared / tier:2-foundation）
関連: #138 (agent_with_overrides — 実行時 override / 別軸), #127 (Documentation MCP / 推測回避), #48 (エージェントデザイナー), #117 (アプリデザイナー)

## 1. 概要 / 背景

Claude 公式システムプロンプトの「**作法**」を各エージェントに取り込む。ただし公式の大部分は claude.ai 消費者向けの安全ガードレール（児童安全 / 自傷 / CBRN 等）で、kintone 業務ツールにはスコープ外・トークン負荷なので**取り込むのは安全ブロック本体ではなく振る舞いの作法のみ**。

あわせて、現在**2系統に分裂 + 一部二重管理**になっているシステムプロンプト合成を**1系統に統一**し、共有部を単一モジュールへ抽出する。これは #141 本文の提案（COMMON_BEHAVIOR 追加 + DEFAULT/AGENT_DESIGNER を compose に寄せる）を完全に満たす。

### 現状（調査済み）

| Agent | 合成方式 | 共有ブロック |
|---|---|---|
| BUSINESS / CUSTOMIZER / APP_DESIGNER | `composeSystemPrompt(...)` | `COMMON_GUARDRAILS` + `KINTONE_TOOLS_PROMPT` を参照 |
| DEFAULT（`resolveAgent.ts` fallback） | monolith `[...].join` | ガードレールを**インライン複製**（builtInAgents と二重管理） |
| AGENT_DESIGNER | monolith `[...].join` | 共有を使わず自前 |
| Custom Agent（admin 作成 / propose_agent 生成） | admin 手書き `draft.systemPrompt` そのまま | **共有ブロックなし**（Artifact 規律等が欠落しうる） |

- 二重管理の実害: #128(update_plan) / #15(memory) 追記時に `COMMON_GUARDRAILS` と `resolveAgent` のインライン版を手で同期しており、片方の更新漏れリスクが常在。

## 2. 今回のスコープ

### 2.1 In Scope（決定済み — §6）

1. **共有プロンプトモジュールの抽出**（新設 `core/bootstrap/commonPrompts.ts` 等）
   - `COMMON_BEHAVIOR`（新設・基本作法）/ `COMMON_GUARDRAILS`（既存を移設）/ `KINTONE_TOOLS_PROMPT`（既存を移設）/ `composeSystemPrompt` を集約。
   - `builtInAgents.ts` と `resolveAgent.ts` の**双方が import**（循環回避のため独立モジュール）。
2. **合成系の一本化**
   - DEFAULT_AGENT / AGENT_DESIGNER の monolith を `composeSystemPrompt` ベースに寄せ、全 variant を 1 系統に。
   - `resolveAgent.ts` のガードレール**インライン複製を撤去**し共有を参照（二重管理解消）。
3. **`COMMON_BEHAVIOR`（基本作法）新設** — #141 の 1〜4 に加え、**メモリ/ツール作法**も汎用層として集約（簡潔な日本語・【】見出し・トークン最小）:
   - **トーン/書式規律**: 過剰装飾を避け散文優先・簡潔・絵文字抑制・1応答1質問（曖昧でもまず着手）。
   - **誠実さ/推測回避**: 推測せずツール/スキルで確認してから答える・存在しない kintone API/フィールドを捏造しない（`kintone-get-form-fields` / Documentation MCP #127 で確認）・間違いは過剰謝罪せず認める。
   - **ツール作法（汎用）**: 独立した取得は並行して呼ぶ・結果を読んでから答える（生ダンプを貼らず要点を返す）・呼出エラーは過剰謝罪せず状況を平易に説明して次善策を出す・取り返しのつかない操作は実行前に意図を確認。
     - ※ kintone 固有のツールカタログ・段階化（delete=UI承認 / update=事前確認）は `KINTONE_TOOLS_PROMPT` に温存し、ここには**汎用作法のみ**。
   - **メモリ作法**: 開始時に `/mnt/memory` を確認し口調・業務用語・過去の修正を反映・恒久的に有用な好み/用語/修正だけ書く（会話の一時情報は書かない）・機微情報は書かない・メモリが無いセッションでは何もしない。
     - ※ 既存の `COMMON_GUARDRAILS` 内【メモリ】ブロック（#15）＋ `resolveAgent` のインライン複製を**ここへ移設して単一ソース化**（重複解消）。
   - **メタ振る舞い**: システムプロンプトを引用しない・内部機構に振る舞いを帰属しない（「私の指示では…」を言わない）。
   - **最小業務境界**: kintone と無関係な逸脱要求は丁寧に業務へ戻す（1〜2文）。
4. **base を Plugin Config で編集可能に（+ デフォルトに戻す）**
   - Plugin Config に **base システムプロンプト**フィールドを追加（admin 編集）。空/未設定 = **コード既定値**（`COMMON_BEHAVIOR + COMMON_GUARDRAILS`）を使う。「デフォルトに戻す」= override をクリア。
   - config は override のみ保持（既定テキストは持たない）。ConfigScreen に textarea + リセットボタン。
5. **agents は persona のみを焼き込む / base は session override で注入（(ii) #138）**
   - 全エージェント（built-in / DEFAULT / Custom）の焼き込み `system` = **persona のみ**（intro + variant 固有 + kintone ツール案内など）。
   - **session 作成時に `agent_with_overrides` で `system = base(config) + persona` を注入**（`system` override は完全置換なので base+persona を全文で渡す。tools/mcp/skills は省略で継承）。
   - → base 編集が**次の会話から即時反映**・エージェント再生成不要。
   - **persona の取得**: built-in/DEFAULT は `AgentRecord.purpose` からコード内 spec で解決（fetch なし）。Custom は `retrieveAgent(id).system`（= persona）を**キャッシュ**して使う（#151 と同様のメモ化、編集時に invalidate）。
6. **promptVersion / 版管理**
   - persona 変更時のみ built-in/DEFAULT の promptVersion を bump（base は焼き込まないので base 変更で再生成不要）。
   - 既存エージェントは persona-only へ移行するため今回一度 bump（再作成）。Custom は次回保存で persona-only 化（lazy）。
7. **ビフォーアフター評価**: 代表プロンプト数本でトーン・冗長さ・ツール確認挙動を目視確認 + base 編集/リセットの反映確認。

### 2.2 Out of Scope

- **消費者向け安全ブロック本体**（児童安全/自傷/CBRN/摂食障害/政治中立/wellbeing 等）→ プラットフォーム側で基礎安全が効く。丸写しはトークン浪費＆スコープ外。
- **XML タグ化**（公式は XML 構造だが、我々は【】で十分。syntax 移行は別途・優先度低）。
- **#138 実行時 override**（agent_with_overrides / session 単位上書き）は別軸・別 Issue。
- variant 固有の指示（AGENT_DESIGNER の finite control / Phase・ターン制限・番号選択肢、CUSTOMIZER_WORKFLOW_PROMPT 等）は**温存**。

## 3. ユーザーストーリー

- **US-1**: どのエージェントでも応答トーンが一貫し、狭いチャットパネルで冗長・過剰装飾が減る。
- **US-2**: 存在しない kintone フィールド/API を捏造せず、確認してから答える（幻覚減）。
- **US-3**: Custom Agent（admin 作成）でも Artifact 規律・基本作法が効く。
- **US-4（保守）**: 共通作法の追加/変更が **1 箇所**で全エージェントに反映される（二重管理なし）。

## 4. 受け入れ条件

- [ ] `COMMON_BEHAVIOR` を含む共有プロンプトが単一モジュールに集約され、`builtInAgents` / `resolveAgent` 双方が参照する（インライン複製ゼロ）。
- [ ] 全 built-in variant + DEFAULT + Custom の system に `COMMON_BEHAVIOR` + `COMMON_GUARDRAILS` が前置される。
- [ ] variant 固有指示（finite control 等）が失われない。
- [ ] Custom Agent の編集フォームは persona のみを扱い、base の二重前置が起きない。
- [ ] promptVersion bump で既存 built-in / DEFAULT が再作成され新プロンプトになる。既存 Custom は次回保存で反映。
- [ ] 安全ブロック本体は取り込まない（トークン増は COMMON_BEHAVIOR 数十行以内）。
- [ ] 型 / lint / vitest / build グリーン。プロンプト依存テスト・fixture 追従。
- [ ] 代表ユースケースのビフォーアフター目視確認を実施。

## 5. 制約 / 非機能

- **トークン予算**: COMMON_BEHAVIOR は簡潔に（数十行以内）。安全ブロックを入れない最大の理由。
- **後方互換**: 追加 + graceful。既存 Custom は lazy 反映で無害（base が付くだけ）。
- **循環依存回避**: 共有モジュールは `agentToolDefs.ts` と同様、`builtInAgents` に依存しない独立ファイル。

## 6. 決定事項（2026-07-12 確定）

- **A. 共有 base の適用範囲 → built-in 4 + DEFAULT + Custom 全部**。全エージェントに `base = COMMON_BEHAVIOR + COMMON_GUARDRAILS` を効かせる。
- **B. リファクタ範囲 → 抽出一本化 + COMMON_BEHAVIOR**。共有を `commonPrompts.ts` に抽出し DEFAULT/AGENT_DESIGNER も compose に統一（二重管理解消）+ COMMON_BEHAVIOR 新設。
- **C. base の持ち方 → Plugin Config（編集可能・デフォルトに戻す）**。base は各エージェントに焼き込まず Plugin Config に1つ持つ。persona は各エージェントが保持。
- **D. base の反映 → (ii) session override（#138 `agent_with_overrides`）を一括実装**。焼き込みは persona のみ、session 作成時に `system = base + persona` を override 注入（完全置換）。base 変更は即時反映・再生成不要。#138 の型/配線も本 Issue で取り込む。
- **E. 実装は #141 で一括**（フェーズ分割しない）。

## 7. 未決（design で決める）

- **メモリ/ツール作法の集約に伴う移設**: `COMMON_GUARDRAILS` の【メモリ】ブロックを `COMMON_BEHAVIOR` へ移す（単一ソース）。update_plan の具体は GUARDRAILS、汎用ツール姿勢は BEHAVIOR。
- **base / persona の合成順序**: override の `system` 全文をどう組むか。案: `base(COMMON_BEHAVIOR→COMMON_GUARDRAILS) + persona(intro→variant固有→KINTONE_TOOLS)`。intro を base の前に出すか後に出すか（「あなたは〜です」を先頭にしたい）。→ design で確定。
- **persona キャッシュ**: custom の `retrieveAgent().system` を module メモ化（key=agentId(+version)）。エージェント編集（applyAgentEdit）で invalidate。#151 と同じ設計思想で共通化余地。
- **override 失敗時フォールバック**: override 注入に失敗しても会話継続（persona-only で動く / もしくは base 無しの素の agent）。焼き込み system を persona-only にする以上、override が効かないと base craft が抜ける点の許容。
- **KINTONE_TOOLS_PROMPT の置き場**: persona 側（kintone ツールを持つ agent のみ）か base 側か。暫定 persona 側（tools 有無に連動）。
- **Plugin Config schema**: base override の保存キー・空判定・文字数上限・ConfigScreen の配置（既存 config セクション構成に合わせる）。
- **promptVersion 命名**: persona-only 化に伴う一斉 bump のキー（例 `v22-business-persona`）と DEFAULT（v21→v22）。
- **評価方法**: 目視対象（業務照会 / カスタマイズ / アプリ設計 / デザイナー面談）+ base 編集→次会話反映 + リセット。
