# Issue #121 — クイックアクション送信で添付ファイルが無視される

## 方針（Issue コメントで確定済み）
- クイックアクションは **常に即送信**。添付があればそれも乗せる。プリフィルは不採用。

## コード調査の結論
受け入れ条件を現コードに照らした結果、**残る真因は (a) の時系列バグのみ**だった。

### (a) 時系列バグ = 唯一の真因
- `handlePresetPromptSelect`（[ChatPanel.tsx:185-191](packages/plugin/src/desktop/ChatPanel.tsx#L185-L191)）が
  `selectAgent()` → `handleSubmit()` の順で呼ぶ。
- `selectAgent`（[useSession.ts:200-214](packages/plugin/src/desktop/hooks/useSession.ts#L200-L214)）は
  別エージェントへの切替時に `startNewConversation()` を呼ぶ。
- `startNewConversation`（[chatStore.ts:89-102](packages/plugin/src/store/chatStore.ts#L89-L102)）が
  `attachedFiles: []` でクリア → 直後の `handleSubmit` がスナップショットを取る時点で既に空。

### (b)「添付 UI が無い」は現状あたらない
- Composer は空状態ターナリの**兄弟**として描画され（[ChatPanel.tsx:383-401](packages/plugin/src/desktop/ChatPanel.tsx#L383-L401)）、
  `showConnectButton=false`（= bound 済）なら **PresetAgentLanding の下に表示される**。
- よって 📎 添付ボタン・添付リスト・削除は landing でも既に利用可能 → AC4 は充足済み。

## 修正
`startNewConversation` から `attachedFiles: []` を削除（会話リセットと添付クリアを分離）。
- 添付は **送信時**（[ChatPanel.tsx:111](packages/plugin/src/desktop/ChatPanel.tsx#L111) `clearAttachedFiles`）と
  **ユーザーの明示削除**（removeAttachedFile）、**ハードリセット**（chatStore の全 reset）でのみ消える。
- これでエージェント切替・新規会話をまたいでも添付が保持される（AC2）、
  クイックアクション送信に添付が乗る（AC1）。
- 通常送信フローは handleSubmit 側のクリアで従来どおり（AC5・デグレなし）。

## 影響範囲
- `startNewConversation` 呼出元: selectAgent（エージェント切替）/ handleNewConversationClick（新規会話ボタン）。
  どちらも「添付は明示削除まで保持」という Issue 決定に合致。
- ハードリセット（reset）は従来どおり添付クリア（維持）。

## テスト
- chatStore.test.ts:531「startNewConversation で attachedFiles もクリアされる」を
  「**保持される**」へ更新（意図反転を明示）。
- reset の添付クリアテストは維持。
- 可能なら ChatPanel のクイックアクション→添付保持の回帰テストを追加検討。

## 受け入れ条件の充足
- [x] AC1 即送信に ready 添付が乗る（クリア削除で達成）
- [x] AC2 切替/会話開始で添付が失われない
- [x] AC3 即送信で一貫（方針確定どおり）
- [x] AC4 landing で添付状態が見える/操作できる（Composer 既出で充足）
- [x] AC5 通常送信にデグレなし（送信時クリアは維持）
