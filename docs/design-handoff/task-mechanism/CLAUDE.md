# CLAUDE.md — 実装エージェント向け作業指示（#128 PlanPanel）

あなた（Claude Code）はこのバンドルを使って、Cowork Agent for kintone の Chat Panel に
**PlanPanel（進捗チェックリスト）** を実装します。まず `README.md` を読んでください。ここは要点と進め方だけ。

## ゴール
会話ビューの「メッセージ一覧の下・Composer の上」に、現在の plan（サブタスク一覧）を
計画 → 進捗 → 完了で見せる **ピン留め帯** を追加する。表示専用。更新は agent の `update_plan` ツール経由。

## 正とするもの（source of truth）
- `planTodos.ts` … 型（`PlanTodo`）+ 派生ヘルパー。**フレームワーク非依存。ほぼそのまま流用可**。
- `PlanPanel.tsx` … React + Tailwind の参照実装。`--cw-*` トークンを arbitrary value で参照。
- `README.md` … 採寸・トークン・状態・棲み分けの確定仕様。
- `prototype/` … 見た目と挙動の確認用（インライン style は**正ではない**）。ブラウザで
  `prototype/Task Mechanism - UX Exploration.html` を開くと全状態・ライブ遷移を触れる。

## 進め方
1. 対象コードベースの Chat Panel レイアウトを特定し、会話スクロール（`flex-1 overflow-y-auto`）と
   Composer の**間に兄弟要素として** `<PlanPanel todos={currentPlan} />` を差し込む（＝スクロールの外／ピン留め）。
2. `--cw-*` トークンが既存 Chat Panel と揃っているか確認（`README.md > Design Tokens`）。
   揃っていれば配色調整は不要。既存アイコンセットがあれば ✓ / chevron / spinner を差し替える。
3. `currentPlan` を `update_plan` の保持する `PlanTodo[]` に接続。空配列 / 未定義で自動的に非表示になること。
4. 既存の emerald「応答完了」divider は**そのまま**。PlanPanel の完了（teal・帯内）と色・レイヤで棲み分け済み。

## 受け入れ基準（この 5 状態が README 通りに出ること）
- [ ] plan 無し → 帯ごと非表示（区切り線も出さない）
- [ ] 開始直後（全 pending / 先頭 in_progress）
- [ ] 進行中（一部 completed / 1 つ in_progress / 残り pending）← 主状態
- [ ] 全 completed（teal 終端・既定で畳む・応答完了 divider と非競合）
- [ ] 長い plan（8〜10 件・完了行を「N 件完了 ▾」に畳む）
- [ ] ヘッダクリックで開閉。畳むとタイトルが現在の `activeForm` に切り替わる。行クリックは無反応（表示専用）
- [ ] 会話をスクロールしても帯は見え続け、開閉・行数変化でスクロール位置が揺れない

## やらないこと（スコープ外）
承認 UI / plan の永続台帳・スケジュール実行 / モバイル幅 / 行の編集・並べ替え。
