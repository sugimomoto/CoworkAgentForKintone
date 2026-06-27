# tasklist.md — Issue #121

## 実装
- [x] 真因特定: `startNewConversation` の `attachedFiles: []` クリアが selectAgent 経由で send 直前に走る
- [x] 修正: `chatStore.startNewConversation` から `attachedFiles: []` を削除（会話リセットと添付クリアの分離）
- [x] テスト更新: chatStore.test.ts「startNewConversation で attachedFiles 保持」へ反転
- [x] 回帰テスト追加: useSession.test.ts「selectAgent で添付保持・会話リセット」
- [x] 型チェック / lint / 全 1072 テスト通過

## 受け入れ条件
- [x] AC1 クイックアクション即送信に ready 添付が乗る
- [x] AC2 エージェント切替/会話開始で添付が失われない
- [x] AC3 即送信で一貫（方針確定）
- [x] AC4 landing で添付状態が見える/操作できる（Composer 既出で充足）
- [x] AC5 通常送信フローにデグレなし（handleSubmit の送信時クリアは維持）

## 備考
- (b)「添付 UI が無い」は現状あたらず（Composer は PresetAgentLanding の下に常時表示）。追加 UI 実装は不要と判断。
- 実機確認推奨: landing で📎添付 → 別エージェントのクイックアクション押下 → 送信メッセージに添付が乗ること。
