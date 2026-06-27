# Issue #102 — 会話履歴ビューから戻れない

## 現象
`view === 'history'` のとき ChatPanel は `<HistoryView>` だけを描画し、
ConversationUtilityBar も Composer も else 側のため出ない。HistoryView 自身に
戻る/閉じるボタンが無く、会話を1件選ぶ以外にチャットへ戻れない。SettingsView は
onClose を持つのに履歴は非対称だった。

## 修正
SettingsView の onClose パターンに揃える。
- HistoryView に `onClose: () => void` を追加し、ヘッダー右に閉じる(×)ボタンを設置
  (data-testid="history-close"、aria-label="閉じる"、CloseIcon は SettingsView と同 svg)。
- ChatPanel は `onClose={() => setView('chat')}` を渡す。

## テスト
- HistoryView.test: 既存 render 呼び出しに onClose を追加、閉じるボタン→onClose のテストを追加。
- 全 1074 テスト通過 / 型・lint クリーン。

## 受け入れ条件
- [x] HistoryView に onClose + 戻るボタン
- [x] ChatPanel から setView('chat') を渡す
- [x] テスト追加
