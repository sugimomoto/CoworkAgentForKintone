# requirements.md — エージェントデザイナー (built-in 3rd variant) (Issue #48)

## 1. 目的

admin / 業務ユーザーが「自社にどんなエージェントが必要か」を文章で言語化する負担を排除する。kintone アプリ構造を起点に **選択肢型対話** で要件を抽出し、最終的に **`AgentDetailModal` を全項目入力済みで開く** ところまでをワンフローでつなぐ built-in Agent を追加する。

#45 で「設定済みエージェントを並べる」体験が完成 → 本 Issue で **「並べる前のエージェント自体を作る」体験** を入れる。

## 2. スコープ

### 2.1 含む

- **`BUILTIN_AGENT_SPECS['customizer-opus']` を repurpose** し、エージェントデザイナーに置換 (purpose key は維持)
- Anthropic Managed Agents の **Custom Tool `propose_agent`** を新規定義 (Plugin が tool 呼出を受けて副作用)
- `AgentDetailModal` に新 mode **`create-from-proposal`** を追加 (initialDraft を全項目に流し込み + 雛形プルダウン非表示)
- `chatStore` に **`pendingAgentProposal: { draft, rationale, model } | null`** を追加し、ChatPanel が watch して modal を開閉
- Custom Tool 呼出と同時に **アーティファクト `kind: 'agent-draft'` を生成、右ペインにカード表示**
- **モーダルは自動展開しない** — ユーザーがカードを確認 → 必要なら追加の修正依頼を Designer に出す → 自分のタイミングでカードの「作成画面を開く」ボタンを押す、という自然なフロー
- system prompt にドメイン推察ヒューリスティクスと選択肢型対話のルールを埋め込む
- kintone MCP は **参照系のみ** (get-apps / get-app / get-form-fields / get-records) を attach、書込系は外す
- kintone-get-records は **limit ≦ 5** を system prompt で強制 (= ガード)

### 2.2 含まない

- スケジュール / 自動トリガー設計 (現プロダクトに該当機能なし)
- 提案された Agent の **自動登録** (admin が保存ボタンを押す既存フローで十分)
- カスタム skill (skills sync) 設計支援 (= customizer-sonnet の領分)
- Custom Tool 入力の **サーバー側厳密バリデーション** (Phase 1 はクライアントで silent fallback)
- アーティファクトの編集機能 (= スナップショットとして保持するのみ)

## 3. ユーザーストーリー

### 3.1 admin (情シス / カスタマイザー)

- AS A admin
- I WANT kintone アプリの中身を見せれば**選択肢を選ぶだけで** Agent 設計が完了する
- SO THAT 文章での要件記述に詰まらず、新規エージェントを 3 分で投入できる

### 3.2 業務ユーザー (admin 権限あり / セルフサービス)

- AS A 業務担当者
- I WANT 「営業向けアシスタントを作りたい」とボタンを押せば、あとは番号で答えるだけで形になる
- SO THAT 専門用語や JSON 知識がなくても自部門用のエージェントが手に入る

### 3.3 admin (再現性・履歴)

- AS A admin
- I WANT 後日同じ提案を見直して、別の設定で再度作成画面を開ける
- SO THAT 「あのとき何を提案されたか」を会話履歴から引き出せる

## 4. 受け入れ条件

### 4.1 BUILTIN_AGENT_SPECS の repurpose

- [ ] AC-1: `BUILTIN_AGENT_SPECS['customizer-opus']` の name / description / iconKind / iconColor / systemPrompt / quickActions / mcpToolFilter / customSkillFilter / anthropicSkillIds がすべてエージェントデザイナー用に書き換わっている
- [ ] AC-2: purpose key は **`customizer-opus` のまま** (= 既存テナントの Anthropic Agent ID を維持)
- [ ] AC-3: `promptVersion` が bump され (例: `v23-agent-designer`)、再 bootstrap 時に既存 Agent の内容が差し替わる
- [ ] AC-4: Customizer Sonnet (`customizer-sonnet`) は **既存のまま** (JS カスタマイズ役を維持)
- [ ] AC-5: 業務エージェント (`business`) は既存のまま

### 4.2 起動時 UX (PresetAgentLanding)

- [ ] AC-6: PresetAgentLanding に「エージェントデザイナー」が並ぶ
- [ ] AC-7: クイックアクション 5 個が `BUILTIN_AGENT_SPECS['customizer-opus'].quickActions` に定義され表示される
- [ ] AC-8: 既存の他 2 エージェントの並びは変わらない

### 4.3 Custom Tool `propose_agent`

- [ ] AC-9: Anthropic Managed Agents の Custom Tool として `propose_agent` が定義されている (Plugin の tool builder で attach)
- [ ] AC-10: 入力 schema は以下を持つ:
  - `name: string` (必須)
  - `description: string` (必須)
  - `iconKind: enum 9種` (必須、enum 外なら 'ai' fallback)
  - `iconColor: enum 8種` (必須、enum 外なら 'teal' fallback)
  - `model: 'opus' | 'sonnet'` (必須)
  - `systemPrompt: string` (必須)
  - `quickActions: string[]` (4〜5 個推奨)
  - `enabledTools: string[]` (kintone MCP ツール名)
  - `anthropicSkillIds: string[]` (xlsx/docx/pdf/pptx 部分集合)
  - `rationale: string` (この設計に至った理由、3〜5 文)
- [ ] AC-11: LLM が `propose_agent` を呼ぶと、Plugin が tool 結果として success レスポンスを返す
- [ ] AC-12: Plugin 側で `kind: 'agent-draft'` アーティファクトのみ生成 + 右ペインを active 化する。**`pendingAgentProposal` は自動でセットしない** (= モーダル自動展開しない)

### 4.4 AgentDetailModal の create-from-proposal モード

- [ ] AC-13: `AgentDetailModalProps.mode` に `{ kind: 'create-from-proposal'; draft: AgentEditDraft; rationale: string }` を追加
- [ ] AC-14: このモードで開くと、name / description / iconKind / iconColor / model / systemPrompt / quickActions / enabledTools / anthropicSkillIds 全項目が draft の値で初期化されている
- [ ] AC-15: 雛形プルダウンは非表示
- [ ] AC-16: ヘッダーに「エージェントデザイナーによる提案」バッジ (またはバナー) が表示される
- [ ] AC-17: ヘッダー領域に rationale (理由) のテキストが小さく表示される (折りたたみ可)
- [ ] AC-18: 「自分で雛形から作り直す」リンクで通常の `create` モードに切替可能 (draft 破棄)
- [ ] AC-19: 保存すると新規 Custom Agent として登録される (`createCustomAgentFrom` 経由)

### 4.5 ChatPanel + chatStore 連携

- [ ] AC-20: `chatStore` に `pendingAgentProposal: AgentEditDraft & { rationale: string } | null` が追加され、`setPendingAgentProposal` で更新できる
- [ ] AC-21: ChatPanel が `pendingAgentProposal !== null` を watch し、`<AgentDetailModal mode={{ kind: 'create-from-proposal', draft, rationale, model }} ... />` を render (setPendingAgentProposal はアーティファクトカードのボタンからのみ呼ばれる)
- [ ] AC-22: モーダルの onClose / onSave いずれでも `setPendingAgentProposal(null)` で消える
- [ ] AC-23: 既存の Header / Settings 経由でのモーダル起動も従来通り動く

### 4.6 アーティファクト `kind: 'agent-draft'`

- [ ] AC-24: Custom Tool 呼出と同時に `create_artifact({ kind: 'agent-draft', content: JSON.stringify({ draft, rationale }) })` も生成される (= system prompt で指示)
- [ ] AC-25: 右ペインに専用 renderer (`AgentDraftArtifactRenderer`) で表示される
  - エージェント名 + アイコン + モデルバッジ
  - 説明
  - クイックアクション一覧 (見るだけ)
  - rationale (折りたたみ)
  - 「この内容で作成画面を開く →」ボタン
- [ ] AC-26: ボタン押下で `setPendingAgentProposal(parsed.draft)` が呼ばれ、再度モーダルが開く
- [ ] AC-27: アーティファクトは MessageList に通常通り残り、後日履歴から開き直せる

### 4.7 kintone データアクセス制約

- [ ] AC-28: エージェントデザイナーの attach ツールは get 系のみ (kintone-get-apps / kintone-get-app / kintone-get-form-fields / kintone-get-records)
- [ ] AC-29: 書込系 (add / update / delete) は attach されない (`mcpToolFilter` で除外)
- [ ] AC-30: system prompt で kintone-get-records 呼出時 `limit ≦ 5` の指示が明記されている

### 4.8 対話品質

- [ ] AC-31: system prompt にドメイン推察ヒューリスティクス (§5) が埋め込まれている
- [ ] AC-32: system prompt で「**オープン質問禁止 / 番号付き選択肢 (3〜5 個 + その他) で進める**」ルールが強制されている
- [ ] AC-33: system prompt で「7 ターン以内に `propose_agent` を呼ぶ」ガイダンスがある

### 4.9 既存導線の維持

- [ ] AC-34: PresetAgentLanding / Header AgentPicker / Settings View など #45 の機能は影響を受けない
- [ ] AC-35: 既存テスト (835 件) が pass する (新スキーマに合わせた最小限の更新は許可)

## 5. ドメイン推察ヒューリスティクス (system prompt に埋め込む)

| アプリ構造の signal | 提案候補エージェント |
|---|---|
| ステータス + 担当者 + 期限 | 進捗追跡 / アラート / 期限超過検出 |
| 数値 + カテゴリ | 集計 / KPI ダッシュボード |
| 計算フィールド多 | データ整形 / 検算 |
| FILE フィールド | 添付物処理 (議事録 / 契約書要約) |
| LOOKUP 多 | 横断検索 / マスタ整合チェック |
| ユーザー / 組織 | 担当割振 / 通知文生成 |
| カテゴリ / タグ | 分類 / 振分 |
| プロセス管理あり | ワークフロー支援 / 承認補助 |
| サブテーブル | 明細処理 (見積 / 発注) |
| (アプリ名から) 営業 / 経理 / 人事 | 業種特化案を追加で出す |

## 6. クイックアクションの初期文言 (本エージェント自身)

1. 「kintone アプリを見ながらエージェントを設計してほしい」
2. 「営業向けのアシスタントを作りたい」
3. 「経理 / 請求業務を支援するエージェントを作りたい」
4. 「議事録 → タスク登録を自動化するエージェントを作りたい」
5. 「今開いているアプリ専用のエージェントを設計してほしい」

## 7. 制約事項

- C-1: Anthropic Managed Agents の **Custom Tool API** を使う (= MCP server ではなく、Agent definition に直接 tool を持たせる方式)
- C-2: kintone-get-records の制約は **system prompt のみで強制**。コード側のサーバー強制は Phase 1 では入れない (LLM 信用)
- C-3: アーティファクト `kind: 'agent-draft'` は **保存時にスナップショット**。アーティファクト自体の編集機能は持たない
- C-4: 既存 customizer-opus の **Anthropic Agent ID は維持** する (テナント側で再 bootstrap だけで自動切替される)
- C-5: モバイル対応はスコープ外
- C-6: i18n 未対応 (日本語固定)

## 8. オープン論点 (design.md で決める)

- ✅ **Q-1 確定 = A (top-level)**: `chatStore` の既存パターン (flat) に揃え、`pendingAgentProposal` を top-level フィールドとして追加する
- Q-2: `kind: 'agent-draft'` アーティファクトの renderer をどこに置くか (`packages/plugin/src/desktop/components/artifacts/` 新設?)
- Q-3: Custom Tool 呼出後の **tool result メッセージ** を会話に残すべきか (LLM の自然な応答にするか、tool 成功通知だけにするか)
- Q-4: 「自分で雛形から作り直す」リンクの遷移時、現在の draft を破棄するか保持するか
- ✅ **Q-5 確定 = B (別フィールド)**: `pendingAgentProposal: { draft: AgentEditDraft; rationale: string } | null` とし、`AgentEditDraft` 自体は永続化スキーマとして純粋に保つ

## 9. 関連

- Issue: #48 (本要件)
- 前: #45 (PresetAgentLanding) / Agent 詳細編集ベースライン (.steering/20260601-agent-detail-edit/)
- 後: #46 (マーケットプレイス配布) — draft schema を共通化する
- 影響ファイル予定:
  - `packages/plugin/src/core/bootstrap/builtInAgents.ts` (customizer-opus 中身差替)
  - `packages/plugin/src/core/bootstrap/resolveAgent.ts` (Custom Tool 定義の attach)
  - `packages/plugin/src/core/managed-agents/agentDetailApi.ts` (initialDraft 経路、`create-from-proposal` 対応)
  - `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` (新 mode + バッジ + rationale 表示)
  - `packages/plugin/src/desktop/ChatPanel.tsx` (modal watch + render)
  - `packages/plugin/src/desktop/hooks/useCustomToolResponder.ts` (`propose_agent` tool 受信処理)
  - `packages/plugin/src/store/chatStore.ts` (pendingAgentProposal 追加)
  - 新規: `packages/plugin/src/desktop/components/artifacts/AgentDraftArtifactRenderer.tsx`
  - `packages/plugin/src/core/artifacts/types.ts` (`agent-draft` kind 追加)
- テスト影響:
  - 新規: `BUILTIN_AGENT_SPECS.test.ts` で customizer-opus が designer になっている assertion
  - 新規: `AgentDraftArtifactRenderer.test.tsx`
  - 既存: `AgentDetailModal.test.tsx` に `create-from-proposal` mode のケース追加
  - 既存: `ChatPanel.test.tsx` に `pendingAgentProposal` watch のケース追加
  - 既存: `useCustomToolResponder.test.ts` に `propose_agent` ケース追加
