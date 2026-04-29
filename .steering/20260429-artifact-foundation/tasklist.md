# Artifact 生成基盤 (Step 1: Foundation) — タスクリスト

> 状態: ☐ 未着手 / 🔄 着手中 / ✅ 完了
>
> 関連: [requirements.md](./requirements.md) / [design.md](./design.md) / Issue #14

## 0. 事前検証 (済)

- [x] esm.sh + sandboxed iframe で React + Recharts が kintone 上で動くことを実機検証 ([verify-esm-sandbox.html](./verify-esm-sandbox.html))
- [x] `?deps=` でバージョン固定が必要 / `?external=` は import map 無しで NG を確認

---

## 1. データモデル / chatStore 拡張

- [ ] **1-1** [packages/plugin/src/core/artifacts/types.ts](../../packages/plugin/src/core/artifacts/types.ts) を新設し、`Artifact` / `ArtifactKind` を定義
- [ ] **1-2** [packages/plugin/src/store/chatStore.ts](../../packages/plugin/src/store/chatStore.ts) に以下を追加:
  - `artifacts: Map<string, Artifact>`
  - `activeArtifactId: string | null`
  - `upsertArtifact(input) → Artifact` (新規 / 同 id 更新 / version インクリメント)
  - `removeArtifact(id)`
  - `clearArtifacts()`
  - `setActiveArtifact(id | null)`
- [ ] **1-3** `reset` / `startNewConversation` に `clearArtifacts` + `setActiveArtifact(null)` を併発させる
- [ ] **1-4** [packages/plugin/src/store/chatStore.test.ts](../../packages/plugin/src/store/chatStore.test.ts) に上記の unit test を追加 (新規追加 / 更新 / version 増加 / clear / startNewConversation 連動)
- [ ] **1-5** `pnpm -C packages/plugin test` で既存テストを割らないこと確認

## 2. Managed Agents 型 / イベント送信

- [ ] **2-1** [packages/plugin/src/core/managed-agents/types.ts](../../packages/plugin/src/core/managed-agents/types.ts) の `SessionEvent` union に `agent.custom_tool_use` / `agent.custom_tool_result` を追加
- [ ] **2-2** [packages/plugin/src/core/managed-agents/events.ts](../../packages/plugin/src/core/managed-agents/events.ts) に `postCustomToolResult(sessionId, toolUseId, result)` を追加 (content は JSON 文字列、is_error 反映)
- [ ] **2-3** [packages/plugin/src/core/managed-agents/events.test.ts](../../packages/plugin/src/core/managed-agents/events.test.ts) に成功 / 失敗の body 形式テストを追加

## 3. eventInterpreter の配列戻り化 + custom_tool_use 対応

- [ ] **3-1** `interpretEvent` の戻り値を `InterpretedEvent[]` に変更 (空配列で「何もしない」を表現)
- [ ] **3-2** `InterpretedEvent` union に `{ kind: 'upsert-artifact'; toolUseId: string; input: unknown }` を追加
- [ ] **3-3** `agent.custom_tool_use` (name === 'create_artifact') を解釈し、`upsert-artifact` + `add (ArtifactRefMessage)` の 2 要素を返す
- [ ] **3-4** input バリデーション: 必須フィールド (id / kind / title / content) 不足時はエラー結果として処理 (空配列 + ログ、もしくは error message を ArtifactRef 化)
- [ ] **3-5** [eventInterpreter.test.ts](../../packages/plugin/src/core/managed-agents/eventInterpreter.test.ts) を全件 配列前提に書き換え + custom_tool_use ケースを追加
- [ ] **3-6** `useEventPoller` 側の戻り値の扱いをループ化 (`for (const r of interpretEvent(e))`)

## 4. useEventPoller への custom_tool 配線

- [ ] **4-1** `upsert-artifact` 効果を受けて `chatStore.upsertArtifact(input)` を呼ぶ
- [ ] **4-2** その直後に `postCustomToolResult(sessionId, toolUseId, { ok: true, artifactId })` を発火 (await はせず fire-and-forget。失敗時はログのみ)
- [ ] **4-3** **Replay 二重送信回避**: poll 1 ラウンドの events を事前スキャンして `respondedToolUseIds = Set<string>` を作り、対応する `agent.custom_tool_result` が既にあれば POST しない
- [ ] **4-4** [useEventPoller.test.ts](../../packages/plugin/src/desktop/hooks/useEventPoller.test.ts) に:
  - custom_tool_use を受けたら upsertArtifact が呼ばれる
  - 同じ events 内に対応する custom_tool_result があれば POST しない
  - 無ければ POST する
  のケースを追加

## 5. Default Agent への custom_tool 登録

- [ ] **5-1** [packages/plugin/src/core/bootstrap/resolveAgent.ts](../../packages/plugin/src/core/bootstrap/resolveAgent.ts) に `CREATE_ARTIFACT_TOOL` 定数を追加
- [ ] **5-2** `buildAgentTools` の戻り値配列に `CREATE_ARTIFACT_TOOL` を **MCP 有無に関わらず常に**追加
- [ ] **5-3** `DEFAULT_AGENT_SYSTEM_PROMPT` に「【成果物 (Artifact)】」ブロックを追加 (kind 選び方 / id 採番 / react kind の制約)
- [ ] **5-4** `DEFAULT_AGENT_PROMPT_VERSION` を `'v6'` → `'v7'` へ
- [ ] **5-5** [packages/plugin/src/test/fixtures.ts](../../packages/plugin/src/test/fixtures.ts) などで `promptVersion: 'v6'` をハードコードしている箇所を `'v7'` に更新
- [ ] **5-6** [resolveAgent.test.ts](../../packages/plugin/src/core/bootstrap/resolveAgent.test.ts) に「tools に create_artifact が含まれる」「promptVersion が v7」のアサーションを追加

## 6. 会話ストリーム内タイル (ArtifactRefMessage)

- [ ] **6-1** [packages/plugin/src/desktop/components/MessageList.tsx](../../packages/plugin/src/desktop/components/MessageList.tsx) の `ChatMessage` union に `ArtifactRefMessage` を追加
- [ ] **6-2** MessageList の switch / マッピングに `'artifact-ref'` ケースを追加
- [ ] **6-3** [packages/plugin/src/desktop/components/MessageItem/ArtifactRefMessage.tsx](../../packages/plugin/src/desktop/components/MessageItem/ArtifactRefMessage.tsx) を新設 (📄 タイル + 「開く」ボタン)
- [ ] **6-4** クリック時 `setActiveArtifact(artifactId)` を発火
- [ ] **6-5** ArtifactRefMessage の単体テスト (描画 / クリック → setActive 呼出)

## 7. ArtifactPane / Renderers

- [ ] **7-1** [packages/plugin/src/desktop/components/ArtifactPane/index.tsx](../../packages/plugin/src/desktop/components/ArtifactPane/index.tsx) (Header / Body / Footer の組み立て)
- [ ] **7-2** `ArtifactHeader.tsx` (title / kind バッジ / セレクタ <select> / × ボタン)
- [ ] **7-3** `ArtifactFooter.tsx` (📋 コピー / ⬇ ダウンロード)
- [ ] **7-4** `renderers/MarkdownArtifact.tsx` (markdown-to-jsx 流用)
- [ ] **7-5** `renderers/CodeArtifact.tsx` (`<pre><code>` + 言語ラベル)
- [ ] **7-6** `renderers/JsonArtifact.tsx` (整形 + parse 失敗時 raw)
- [ ] **7-7** `renderers/PlaceholderArtifact.tsx` (未対応 kind 用)
- [ ] **7-8** [packages/plugin/src/core/artifacts/download.ts](../../packages/plugin/src/core/artifacts/download.ts) (拡張子マップ + Blob ダウンロード) + unit test
- [ ] **7-9** ArtifactPane の test (active artifact 切替 / コピー / ダウンロードのコールバック)

## 8. React Artifact (iframe sandbox)

- [ ] **8-1** `renderers/ReactArtifact.tsx` 新設
- [ ] **8-2** `ReactArtifactFrame` を内部実装: `<iframe sandbox="allow-scripts" srcdoc={...}>`
  - srcdoc テンプレートは const + `__USER_CODE__` を `JSON.stringify` で注入
  - esm.sh のバージョンは検証済み: `react@18.3.1` / `react-dom@18.3.1` / `recharts@2.12.7` / `@babel/standalone@7.25.6`
  - Babel transform プリセット: `['env', { modules: 'cjs' }]`, `'react'`
- [ ] **8-3** 親側 `useEffect` で `addEventListener('message')` → `source === 'artifact'` かつ `event.origin === 'null'` をフィルタ
- [ ] **8-4** message type:
  - `'boot'` / `'rendered'` → onError(null)
  - `'error'` → onError(payload)
- [ ] **8-5** iframe 再生成キー: `key={`${artifact.id}@${artifact.version}`}` でバージョン更新時に完全リロード
- [ ] **8-6** ReactArtifact の test (jsdom 環境で iframe DOM が生成され srcdoc が code を含む / postMessage error がエラー表示に反映)

## 9. ChatPanel レイアウト変更

- [ ] **9-1** [packages/plugin/src/desktop/ChatPanel.tsx](../../packages/plugin/src/desktop/ChatPanel.tsx) を 2 カラム化 (`chat-shell` / `chat-shell__chat` / `chat-shell__artifact`)
- [ ] **9-2** `useMatchMedia('(min-width: 1024px)')` (新規 hook or `window.matchMedia` 直接) でブレークポイント切替
- [ ] **9-3** 狭い時はオーバーレイ表示 (`position: absolute; inset: 0; z-index: 10`)
- [ ] **9-4** [packages/plugin/src/styles/global.css](../../packages/plugin/src/styles/global.css) に必要なスタイル追加
- [ ] **9-5** ChatPanel.test.tsx で「activeArtifactId 設定時にペインが表示」「null 時に非表示」を検証

## 10. システムプロンプト / 仕上げ

- [ ] **10-1** プロンプトの「【成果物 (Artifact)】」ブロックの最終文言レビュー (id 採番方針 / 利用シナリオの誘発が効くこと)
- [ ] **10-2** Plugin manifest version を bump ([packages/plugin/plugin/manifest.json](../../packages/plugin/plugin/manifest.json))

## 11. 実機シナリオテスト

- [ ] **11-1** kintone 上で `pnpm plugin:deploy` 後、以下を手動検証:
  - [ ] 「Markdown で簡単なレポート作って」→ ArtifactPane に Markdown が描画される
  - [ ] 「JavaScript で 1〜10 の合計を求めるコード書いて」→ code kind で `<pre>` 表示
  - [ ] 「JSON で 3 件のサンプルデータ作って」→ json kind で整形表示
  - [ ] 「先月の売上を React で棒グラフにして (ダミーデータでよい)」→ Recharts が iframe 内で描画
  - [ ] 同じ id で 2 回呼ばれる依頼 (例: 「さっきの React チャート、色を緑にして」) で artifact が更新される
  - [ ] ToolCardMessage に 📄 タイルが残り、クリックで再度開ける
  - [ ] ペインを閉じて再度開ける / 複数 artifact をセレクタで切替できる
  - [ ] コピー / ダウンロードが各 kind で動く
  - [ ] ページリロード後も artifact が復元される
  - [ ] 構文エラーを含む React コードを Agent に書かせて、エラー表示が出る (アプリは落ちない)
  - [ ] パネル幅 < 1024px (DevTools で狭める) でオーバーレイ表示になる
- [ ] **11-2** 既存シナリオ (レコード取得 / 追加 / 削除承認 / OAuth 失効 / 新規セッション) が壊れていないことを軽く確認

## 12. テスト / ビルド全体パス

- [ ] **12-1** `pnpm -C packages/plugin test` 全件 pass
- [ ] **12-2** `pnpm -C packages/plugin build` 成功 + bundle size 増分が +10KB (gzipped) 以内であること確認
- [ ] **12-3** `pnpm -C packages/kintone-mcp test` 既存全件 pass (本フェーズで触らないが念のため)

## 完了条件

- requirements.md の受入条件すべて ✅
- 11-1 のシナリオすべて ✅
- 既存テスト割らない ✅

---

## 13. 拡張対応 (本フェーズ内で追加実施)

### 13.1 追加 kind: mermaid / svg / html / csv

- [x] **13-1** `SandboxFrame` を共通コンポーネント化 (React/HTML/SVG/Mermaid で再利用)
- [x] **13-2** `HtmlArtifact` (iframe sandbox + srcdoc)
- [x] **13-3** `SvgArtifact` (iframe sandbox + srcdoc)
- [x] **13-4** `MermaidArtifact` (iframe sandbox + esm.sh `mermaid@10.9.1`)
- [x] **13-5** `CsvArtifact` (自前パーサ + テーブル UI、500 行上限)
- [x] **13-6** `core/artifacts/sanitizeContent.ts` (LLM の典型ノイズ: コードフェンス / XML 宣言 / DOCTYPE 除去)
- [x] **13-7** `<svg>...</svg>` 抽出ロジック (前置き文を含む応答に対応)
- [x] **13-8** プロンプトに kind 別の制約を追記、promptVersion v8 → v10

### 13.2 UI 改善

- [x] **13-9** Artifact ペイン幅を panel 幅 max 800 → **1600** へ、artifact 側を flex-1 化
- [x] **13-10** 「✓ 応答完了」divider をメッセージ末尾に表示
- [x] **13-11** 30 秒以上応答が無いときに「応答が遅い」バナー + 中断ボタン
- [x] **13-12** Artifact pane に「{ } 本文を表示」トグル (LLM が想定外の content を返したとき確認用)
- [x] **13-13** `data-artifact-state` 属性を `SandboxFrame` に出して E2E 検証可能に

### 13.3 リファクタ

- [x] **13-14** Custom Tool 応答を `useEventPoller` から **`useCustomToolResponder`** に分離
- [x] **13-15** `pendingCustomToolUseIds` を component ref → **chatStore** に昇格
- [x] **13-16** `useAgentPhase()` 導出セレクタを追加 (`isAgentRunning` の散在を解消)
- [x] **13-17** `core/debug.ts` で `[CoworkAgent:*]` ログヘルパを統一、`?coworkDebug=1` で有効化

### 13.4 仕様起因のバグ修正

- [x] **13-18** Custom Tool `type: 'custom_tool'` → `'custom'` (Anthropic API 仕様)
- [x] **13-19** `user.custom_tool_result` field 名を `tool_use_id` → `custom_tool_use_id`
- [x] **13-20** `user.custom_tool_result` の `content` を string → content block 配列
- [x] **13-21** `agent.custom_tool_use` に独立した `tool_use_id` フィールドが無い → `event.id` を使用
- [x] **13-22** `isTerminalEvent` を `end_turn` / `retries_exhausted` / **`max_tokens` / `error`** へ拡張
- [x] **13-23** session retrieve の `status === 'idle'` 安全網 (terminal event 取りこぼし対策)
- [x] **13-24** Recharts の `?bundle-deps` で transitive dep (lodash) ロード失敗を解消

### 13.5 テスト / E2E

- [x] **13-25** `useCustomToolResponder.test.ts`
- [x] **13-26** `useAgentPhase.test.ts`
- [x] **13-27** `sanitizeContent.test.ts`
- [x] **13-28** `csv.test.ts`
- [x] **13-29** `download.test.ts`
- [x] **13-30** E2E `artifact-foundation.spec.ts` を 4 → 11 ケース、新 kind 5 種を網羅
- [x] **13-31** 全 unit 434 + E2E 15 で緑

### 13.6 状態 (2026-04-29 時点)

- 単体テスト: **434 passed** (41 file)
- E2E: **15 passed** (約 27 秒、LLM 課金ゼロ)
- ビルド: OK / promptVersion: **v10**
- 実機検証: kintone v92 で全 kind 動作確認済

### 13.7 仕様変更: Step 2「編集 → 再依頼フロー」は対応不要

オリジナル設計案の `textarea 直編集 → Agent に "これに変更して" 再依頼` 案 (案 A) は
**実装しない**。会話で「色を緑に」等と書けば Agent が同 id で `create_artifact` を再呼出
して version up する流れ (案 B) で実用十分。詳細は Issue #14 のコメントを参照。
