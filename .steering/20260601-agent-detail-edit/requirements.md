# #40 Agent 詳細編集 UI — 要求定義

GitHub Issue: [#40](https://github.com/sugimomoto/CoworkAgentForKintone/issues/40)
作業期間: 2026-06-01 〜
前提タスク: #39 (Built-in Agent 3 variant) ✅ / #30 (Custom Skills インフラ) ✅

## 1. 背景・目的

V2 P3.1 で導入した Chat Panel Settings View (Agent タブ) は現状、admin に対して **公開トグル (`visibility: public | private`) しか提供していない**。built-in Agent (業務 / Customizer Opus / Customizer Sonnet) の挙動を変えるには、コードを直接書き換えてプラグインを再ビルドする必要があり、admin が試行錯誤しづらい。

本タスクではこれを解消し、**admin がチャットパネル内で Agent 1 件の詳細を編集 + 新規 Custom Agent を追加できる UI** を実装する。Anthropic Managed Agents API の `POST /v1/agents/{id}` (metadata + system + tools) と `POST /v1/agents` (新規作成) を直接活用し、Plugin Config を介さず即時反映する。

## 2. 対象ユーザーと想定シナリオ

| ユーザー | シナリオ |
|---|---|
| **admin (kintone 管理者)** | チャットパネル設定画面で「業務 Agent」の system prompt から不要な節を消す → 保存 → 次回会話で反映 |
| **admin** | 「業務 Agent」を複製して「営業特化 Agent」を作成 → 一部 MCP tool を OFF にしカスタム skill を attach → 保存 → end-user が Header picker で選択可能になる |
| **admin** | built-in Agent をうっかり破壊的に編集 → 「初期値に戻す」ボタンで `builtInAgents.ts` の出荷時 spec に復元 |
| **end-user** | 何も変わらない (詳細編集は admin 専用、end-user は引き続き Header picker で Agent を切り替えるだけ) |

## 3. 機能要件

### 3.1 編集可能フィールド (フルセット)

`AgentRecord` および Anthropic Managed Agents API で更新可能な以下を編集対象とする:

| カテゴリ | フィールド | 編集 UI |
|---|---|---|
| 基本情報 | `name` (UI 表示名) | text input |
| | `description` (1 行説明) | text input |
| | `iconKind` | IconPicker (9 種から選択、既存) |
| | `iconColor` | ColorPicker (10 色から選択、既存) |
| | `visibility` | `public` / `private` toggle (既存挙動を流用) |
| | `isDefault` | radio (1 Agent のみ true 制約) |
| 動作 | `system` prompt | 複数行 textarea (monospace、行番号付き任意) |
| | `tools` (MCP tool 一覧) | tool 一覧チェックボックス (`KINTONE_TOOL_NAMES` の全件、ON / OFF) |
| | `skills` (attach 済 skill) | skill 一覧チェックボックス (bundled + custom 全件) |
| 不変 | `model` (`opus` / `sonnet`) | **編集不可** — 出荷時の variant 設計に固定。変更したい場合は新規 Custom Agent 作成 |
| | `purpose` | **編集不可** — UI が purpose で挙動分岐する箇所がある (Customizer Wedge 等) |
| | `variantGroup` | **編集不可** — built-in variant の同一グループ管理用 |

### 3.2 新規 Custom Agent 追加

- **入口**: Agent タブ「+ Custom Agent を追加」ボタン (Custom Agent セクション header)
- **雛形選択**: モーダル冒頭で「**雛形を選択**」(プルダウン)
  - 既存の built-in Agent 3 種 + 既存 Custom Agent から 1 件選ぶ
  - 雛形の全フィールドが初期値として form に入る
  - `name` には ` のコピー` を suffix
  - `id` は新規 `agent_xxxxx` を Anthropic から払い出す
  - `source` は `'custom'` 固定
  - `isDefault` は false 固定 (デフォルトは builtin のみ)
- 保存ボタン押下で `POST /v1/agents` → 成功時に chatStore.builtInAgents に append + モーダルを閉じる
- failure 時はエラーメッセージをモーダル下部に表示 (モーダルは閉じない)

### 3.3 既存 Agent 編集

- **入口**: Agent タブ各行の「編集 →」ボタン (現状 disabled → enabled に変更)
- モーダルが開いて全フィールドの現在値が form に表示される
- 「初期値に戻す」ボタン (built-in Agent 専用)
  - クリックすると `builtInAgents.ts` の出荷時 spec を form に**再ロード** (まだ保存していない状態)
  - admin が確認のうえ「保存」を押すと反映
- 「保存」ボタンで `POST /v1/agents/{id}` (Anthropic Managed Agents API は full replace 系) を実行
  - **metadata は既存 metadata を spread + 編集分を merge** (`agentVisibility.ts` 既存パターン踏襲)
  - `tools` / `system` / `name` / `description` / `skills` は単純 replace
- 成功時に chatStore.builtInAgents の該当 record を更新 + モーダルを閉じる

### 3.4 削除 (Custom Agent のみ)

- built-in Agent は削除不可 (ボタン無し)
- Custom Agent は編集モーダル下部に「削除」ボタン
- 確認ダイアログ → `POST /v1/agents/{id}/archive` (アーカイブ = 論理削除、Anthropic Managed Agents の標準)
- 成功時に chatStore.builtInAgents からも除去

## 4. 非機能要件

| 項目 | 要件 |
|---|---|
| **権限** | admin (= Plugin Config 画面に入れるユーザー) のみ。end-user は引き続き編集 UI に触れない (Chat Panel Settings View 自体が admin 専用) |
| **応答性** | 保存ボタン押下 → 完了まで 5 秒以内 (Anthropic API + chatStore 反映) |
| **エラー耐性** | Anthropic API が 4xx/5xx を返した場合、フォーム値は失われずモーダルにエラーメッセージが表示される |
| **同時編集** | 楽観的ロックは無し (admin は 1 人想定)。複数 admin 環境で同時編集が起きた場合は last-write-wins |
| **テスト** | vitest unit (form / save / reset / delete / 雛形コピー) + 既存の SettingsViewBound.test.tsx を拡張 |

## 5. スコープ外

- end-user 向けの Agent 一覧 UI 変更 (Header picker は現状維持)
- `model` / `purpose` / `variantGroup` の編集 (V3 以降で扱う)
- Plugin Config 画面 (Skills 同期等) の変更
- Anthropic Skills のアップロード (`#30` で完了済み、別 UI)
- MCP Server 登録 / 編集 (`#42` で別途扱う)
- Agent の version 管理 / 履歴 (V3 以降)
- skill / tool の検索フィルタ (件数が少ないので全件表示で十分)

## 6. 受け入れ条件

- [ ] Agent タブ「編集 →」ボタンが有効化されている
- [ ] 業務 Agent の system prompt を編集 → 保存 → 新規 Session で反映される (`retrieveAgent(id)` で確認可)
- [ ] 業務 Agent を編集後「初期値に戻す」→ form が出荷時 spec の値に戻る
- [ ] 業務 Agent を雛形に Custom Agent 作成 → builtInAgents 配列に追加され、Header picker に表示される
- [ ] Custom Agent を削除 → archive 状態になり、Header picker から消える
- [ ] system prompt を空にすると保存ボタンが disabled (バリデーション)
- [ ] tool 一覧が KINTONE_TOOL_NAMES 全件 + 既選択状態が正しい
- [ ] skill 一覧が bundled + custom 全件 + 既選択状態が正しい
- [ ] vitest 全 pass
- [ ] 実機 (kintone) で admin が業務 Agent を編集 → 自分で会話して挙動変化を確認できる

## 7. 関連

- `.steering/20260516-issue-30-custom-skills-infra/` (#30 完了済、skill 添付 API 流用)
- `packages/plugin/src/core/bootstrap/builtInAgents.ts` (出荷時 spec 定義の source of truth)
- `packages/plugin/src/core/bootstrap/resolveAgent.ts` (build-in Agent の bootstrap)
- `packages/plugin/src/core/managed-agents/agentVisibility.ts` (POST /v1/agents/{id} の既存パターン)
