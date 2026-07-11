# design.md — タスク機構（#128 / セッション内ゴール到達管理）

requirements.md の確定（A=Custom Tool `update_plan` / B=破壊的操作のみ / C=全エージェント / D=任意）を実装に落とす。

## 1. アーキテクチャ（既存 custom tool パターンの踏襲）

`create_artifact` / `propose_agent`（#48）と同じ経路に乗せる:

```
Agent が update_plan(todos) を呼ぶ
  → session event: agent.custom_tool_use (name='update_plan')
  → eventInterpreter が捕捉:
       ① chatStore の "現在の plan" を更新（effect）
       ② custom_tool_result = { success: true } を返す（LLM のクロージング発話に繋ぐ）
  → PlanPanel（新レンダラ）が現在 plan をチェックリスト表示（in-place 更新）
  → 破壊的ツールは従来どおり Tool Confirmation（update_plan 自体は非破壊・自動実行）
```

**永続/再開**: 新規ストアは作らない。plan は会話の event 履歴（`agent.custom_tool_use` の最新 `update_plan`）から**再構築**する（アーティファクトが event から再構築されるのと同じ）。＝リロード/セッション再開で復元。

## 1′. 設計根拠（調査: Managed Agents / Cowork / TodoWrite）

- **Managed Agents のネイティブツールは 8 個のみ**（`bash`/`read`/`write`/`edit`/`glob`/`grep`/`web_fetch`/`web_search`。live 確認 2026-07-11）。**Task/Todo/Skill/サブエージェントのネイティブツールは存在しない** → task 管理は **custom tool で自前実装が唯一の道**（この方式は正当）。
- **Anthropic 公式の task 外部化の正典は TodoWrite**（`{todos:[{content, status, activeForm}]}` の**全置換**）。Copilot/Claude Cowork は SDK ネイティブの `TaskCreate`/`TaskUpdate`（2ツール・依存関係付き）で同じことをしている。
- **Managed Agents 公式のツール設計指針は「関連操作は少数ツールに統合せよ」**（"Consolidate related operations into fewer tools"）→ Cowork の 2 ツールより **単一の TodoWrite 形（全置換）が我々の基盤に整合**。
- **`activeForm`（進行中の現在進行形ラベル）を必須化**する。Cowork の「内部処理名を出さず"Building your slides"の様な意図ベース表示」UX の核であり、私の初版 `update_plan` に欠けていた点。

## 2. `update_plan` Custom Tool 定義（`core/bootstrap/agentToolDefs.ts`）

**Anthropic 正典 TodoWrite の形を踏襲**。毎回「現在の全リスト」を送る全置換方式（＝Managed Agents の"少数ツール"指針＋TodoWrite に整合）。

```ts
export const UPDATE_PLAN_TOOL_NAME = 'update_plan';
export const UPDATE_PLAN_TOOL = {
  type: 'custom',
  name: 'update_plan',
  description:
    '多段の作業（複数ファイル / 複数ツール / 破壊的操作を含む依頼）に着手する前と進行中に、' +
    'サブタスクの計画と進捗を宣言・更新する（TodoWrite 相当）。呼ぶたびに現在の全リストで' +
    '置き換わる。作業の追跡は頭の中で行わず必ずこのツールで外部化する。' +
    '単純な 1 手で終わる依頼では使わない。',
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'サブタスク（命令形・簡潔）例:「案件データを取得する」' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            activeForm: {
              type: 'string',
              description: '実行中に表示する現在進行形ラベル。例:「案件データを取得中」。内部処理名でなく意図ベースで。',
            },
          },
          required: ['content', 'status', 'activeForm'],
        },
        description: '現在のサブタスク一覧（先頭から実行順）。in_progress は同時に 1 つが目安。',
      },
    },
    required: ['todos'],
  },
} as const;
```

- **フィールドは TodoWrite 正典に一致**: `content`（命令形）/ `status`（`pending`/`in_progress`/`completed`）/ `activeForm`（進行中ラベル）。
- `id` は持たせず**順序＋content**で管理（毎回全置換なので不要）。UI の key は index。
- 依存関係（Cowork の `blocks`/`blockedBy`）は初回スコープ外（将来拡張）。`failed/blocked` も持たず、本文で説明する。

## 3. 全エージェントへの付与（`buildAgentTools.ts` / `resolveAgent.ts`）

`CREATE_ARTIFACT_TOOL` と同じ場所に `UPDATE_PLAN_TOOL` を追加する。これで built-in / custom すべてに公開される（C=全エージェント）。

- `core/managed-agents/buildAgentTools.ts`: tools 配列に `UPDATE_PLAN_TOOL` を追加。
- `core/bootstrap/resolveAgent.ts`: 同上（Agent 作成時 tools に含める）。
- **promptVersion / toolsVersion を bump** し、reconcile で既存 Agent にも付与（#40 の skill 後付けと同じ流儀）。

## 4. システムプロンプト誘導（D=任意）

`builtInAgents.ts` / `resolveAgent.ts` の共通プロンプトに追記（`create_artifact` 誘導と同じ箇所）:

```
【計画（update_plan）＝作業の外部化】
- 依頼が多段（複数ファイル / 複数ツール / 破壊的操作を含む）なら、着手前に update_plan で
  サブタスク一覧を宣言し、進行に合わせて status を更新する（in_progress は常に 1 つ、
  終わったら completed に）。各項目に activeForm（進行中ラベル・意図ベース）を必ず付ける。
- 作業の追跡を頭の中だけで行わない（State Externalization）。ただし単純な 1 手で終わる
  依頼では使わない（冗長になる）。
- 破壊的操作は従来どおり実行時に承認カードが出る。計画自体に承認は要らない。
```

> 出典: Cowork の deep-reasoning「State Externalization（mental tracking 禁止・TaskCreate/TaskUpdate で外部化）」を、D=任意（軽い依頼では出さない）に緩めて取り込む。将来 #141（Claude 公式作法の COMMON_BEHAVIOR 取込）と統合しうる。

## 4′. HITL

- **plan / step の承認は無し**（B の決定）。`update_plan` は**非破壊・自動実行**の custom tool として扱い、承認カードを出さない（`DESTRUCTIVE_TOOL_NAMES` に含めない）。
- 実際の破壊的操作（`kintone-delete-records` 等）は**既存 Tool Confirmation のまま**。設計変更なし。

## 5. eventInterpreter での処理（`core/managed-agents/eventInterpreter.ts`）

`agent.custom_tool_use` の分岐に `update_plan` を追加:

```ts
if (e.name === UPDATE_PLAN_TOOL_NAME) {
  const plan = parseUpdatePlanInput(e.input); // {todos:[{title,status}]} を検証
  if (!plan) {
    return [{ kind:'add', message:{ id:e.id, kind:'agent', text:'⚠️ 計画の取込に失敗（入力不正）' } }];
  }
  return [
    { kind: 'set-plan', plan },              // ← 新 effect: chatStore の現在 plan を置換
    // custom_tool_result は success で返す（既存の custom tool と同様の返却経路）
  ];
}
```

- 新 effect `{ kind:'set-plan', plan }` を interpreter の返却型に追加し、適用側（store 反映）で `chatStore.setPlan(plan)`。
- `custom_tool_result = { success:true }` の返却は既存 custom tool の仕組みに合わせる。

## 6. chatStore の plan slice

- 新規 slice（`store/slices/planSlice.ts`）: `plan: { todos: PlanTodo[] } | null`、`setPlan(plan)`、`clearPlan()`。
- **セッション切替（selectSession）でクリア**し、event 再生で再構築（＝会話ごとに独立）。※ #129（添付持ち越し）と同じ「session 切替で state をリセット」原則を踏襲。
- 型は `core/chat/types.ts` に `PlanTodo = { content:string; status:'pending'|'in_progress'|'completed'; activeForm:string }`（TodoWrite 正典に一致）。

## 7. UI レンダリング（PlanPanel）

- 新コンポーネント `desktop/components/PlanPanel.tsx`: チェックリスト表示。
  - 各行: 状態アイコン（□ pending / ▷ in_progress / ✓ completed）＋ ラベル。
  - **in_progress の行は `activeForm`（「〜中」）を表示、それ以外は `content`** を表示 → Cowork 流の意図ベース進捗表示。
  - ヘッダに進捗（`completed / 全体`）。in_progress を強調。
- **配置**: `MessageList` の下（`ProgressIndicator` 近傍）に**ピン留めの進捗パネル**として、plan があるときだけ表示（＝最新状態を常時見せる・in-place 更新）。
  - 代替案: メッセージストリーム内に 1 枚のカードとして差し込み、更新で書き換え。→ ピン留めの方が「今どこ」を見失わない。**ピン留め推奨**。
- stick-to-bottom（#133）と干渉しないよう、パネルは scroll コンテナの外（既存 ProgressIndicator と同じ層）に置く。

## 8. 影響範囲

| ファイル | 変更 |
|---|---|
| `core/bootstrap/agentToolDefs.ts` | `UPDATE_PLAN_TOOL` 定義 + parse |
| `core/managed-agents/buildAgentTools.ts` / `core/bootstrap/resolveAgent.ts` | 全エージェント tools に追加 + version bump |
| `core/bootstrap/builtInAgents.ts` / `resolveAgent.ts` | システムプロンプト誘導追記 |
| `core/managed-agents/eventInterpreter.ts` | `update_plan` 分岐 + `set-plan` effect |
| `store/slices/planSlice.ts`（新）/ `store/types.ts` | plan slice |
| `core/chat/types.ts` | `PlanTodo` 型 |
| `desktop/components/PlanPanel.tsx`（新）/ `MessageList.tsx` or `ChatPanel.tsx` | 進捗パネル描画 |
| （selectSession 経路） | session 切替で plan クリア |

## 8′. 後方互換性（エージェント）

**基本方針: 完全に加算的（additive）＋ graceful degradation。** `update_plan` を持たないエージェントは単に呼ばないだけで、PlanPanel が出ないだけ。既存挙動は一切壊れない。eventInterpreter も `update_plan` イベントにしか反応しない（未対応エージェントでは no-op）。

| 対象 | 反映方法 | 互換性 |
|---|---|---|
| **built-in エージェント** | `buildAgentTools` に追加 + **toolsVersion bump** → `reconcileBuiltInAgent` が `updateAgent` で tools を上書き（#40 の skill 後付けと同型・**非破壊**・再作成不要） | 既存 built-in も次回 bootstrap で `update_plan` が付く |
| **custom エージェント（新規）** | 作成時 `buildAgentTools` に含まれる | 付く |
| **custom エージェント（既存）** | 自動では付かない。**次回の編集保存 or reconcile で付与**。付くまでは PlanPanel が出ないだけで正常動作 | **壊れない**（graceful degradation） |
| **実行中セッション / 過去会話** | エージェントは version 参照。既存セッションは旧構成のまま、新規セッションから新ツール。過去会話の再生も `update_plan` イベントが無いだけ | 影響なし |
| **Anthropic API** | custom tool は標準機能。beta ヘッダ変更なし（`managed-agents-2026-04-01`） | リスクなし |

**決定（2026-07-11）: 既存 custom エージェントは "次回保存まで待つ（遅延）"。** 自動 reconcile は行わない。
- built-in は toolsVersion bump → reconcile で自動付与。
- custom（新規）は作成時に付与。
- **custom（既存）は付与しない**。ユーザーがそのエージェントを編集保存したときに（`applyAgentEdit` の tools 再構築で）自然に付く。それまでは PlanPanel が出ないだけ（graceful degradation）。
- ＝ ユーザー所有の custom を自動で書き換えない方針を優先。将来ニーズが出たら追加のみの reconcile を検討。

**ロールバック安全性**: 将来 `update_plan` を外しても、エージェントが呼ばなくなるだけ。データ移行不要。

## 9. テスト

- `agentToolDefs`: `parseUpdatePlanInput` の正常/不正（status enum 外、todos 非配列）。
- `eventInterpreter`: `update_plan` custom_tool_use → `set-plan` effect を返す / 不正入力で警告メッセージ。
- `planSlice`: setPlan/clearPlan、session 切替でクリア。
- `PlanPanel`: todos の状態別描画、進捗カウント、plan=null で非表示。
- デグレ: 既存 custom tool（create_artifact / propose_agent）と MessageList の既存テストがグリーン。

## 10. 未決（実装時に確定）

- パネルの正確な配置（MessageList 内 vs ChatPanel 直下）と stick-to-bottom との高さ調整。
- `failed/blocked`・依存関係（Cowork の blocks/blockedBy）を足すか（今回は 3 状態=pending/in_progress/completed のみ）。
- 既存 custom エージェントへの `update_plan` 付与を自動 reconcile にするか（§8′ の後方互換 決定事項）。
- 進捗パネルの折りたたみ（長い plan のとき）。
- 完了時の見せ方（全 done で「完了」表示 + 既存の応答完了 divider との重複回避）。
- version bump に伴う既存 Agent への `update_plan` 反映（reconcile）の具体。
