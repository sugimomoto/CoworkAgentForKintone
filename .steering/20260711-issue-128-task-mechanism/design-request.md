# Claude Design 依頼ブリーフ — タスク（Plan/進捗）UI（#128）

Cowork Agent for kintone の Chat Panel に、**エージェントが1つのゴールに到達するまでの作業（サブタスク）を計画・進捗表示する UI** を設計依頼する。成果物は既存ハンドオフ（`docs/design-handoff/mcp-registration/` 等）と同じ流儀の **hifi 仕様 + 参照 TSX + prototype** を `docs/design-handoff/task-mechanism/` として作ること。

このブリーフは「何を設計してほしいか」の input。**既存の意匠・パターンを最大限流用**してほしい（新規発明は最小に）。

---

## 0. 大前提（プロダクトモデル = 概念B）

本機能は「常設スケジュールタスクの台帳」ではなく、**1 セッションがゴールに到達するまでの作業を、計画→進捗→完了で"見える化"する**もの（Claude Code の TodoWrite / Cowork の TaskCreate-TaskUpdate 相当）。

- エージェントが多段の依頼（複数ファイル/複数ツール/破壊的操作を含む）に着手するとき、`update_plan` ツールで **サブタスク一覧**を宣言し、進行に合わせて状態を更新する。
- 各サブタスクは **`content`（命令形の短文）/ `status`（pending / in_progress / completed）/ `activeForm`（実行中の現在進行形ラベル。例「案件データを取得中」）** を持つ。
- **軽い依頼では plan を出さない**（任意）。＝ plan が無い会話も普通にある。
- 承認 UI は設計対象外（破壊的操作は既存の承認カードのまま）。

## 1. 設計してほしいサーフェス — 「PlanPanel（進捗チェックリスト）」

Chat Panel の会話ビュー内で、**現在の plan を常に見える形**で表示する 1 コンポーネント。

### レイアウト / 配置
- Chat Panel は**縦長・幅 ~360〜420px**（kintone レコード画面の右サイドパネル）。
- 位置は **メッセージ一覧の下・Composer（入力欄）の上**の"ピン留め"帯（既存 `ProgressIndicator` と同じ層）。会話をスクロールしても plan は見え続ける。
  - ※ 会話は最下部追従（stick-to-bottom）実装済み。PlanPanel はスクロールコンテナの**外**に置く前提で、追従と干渉しない高さ設計にしてほしい。
- plan が無いときは**非表示**（帯ごと出さない）。

### 各行（サブタスク）
- 状態アイコン + ラベル:
  - `pending`: 未着手（□ / 薄い円）
  - `in_progress`: 実行中（スピナー or パルス）。**この行は `activeForm`（「〜中」）を表示**
  - `completed`: 完了（✓）。`content` を表示（取り消し線や淡色で"済"感）
- **in_progress は常に 1 つ**が基本（強調表示）。
- ラベルは Cowork 流の「**内部処理名を出さず、意図ベースの自然文**」（activeForm がそれ）。

### ヘッダ / まとめ
- 進捗インジケータ（例「3 / 6 完了」やミニ進捗バー）。
- 全 `completed` になったら「完了」感のある終端状態（ただし既存の緑「✓ 応答完了」divider と**重複・競合しない**見せ方にしてほしい）。

### 状態バリエーション（各モックが欲しい）
1. **plan 無し** → 非表示。
2. **開始直後**（全 pending、先頭が in_progress）。
3. **進行中**（一部 completed / 1 つ in_progress / 残り pending）← 主状態。
4. **全 completed**（完了表示）。
5. **長い plan**（8〜10 件）→ 折りたたみ or スクロール（縦を食い過ぎない工夫）。

### インタラクション
- **折りたたみ/展開**（幅が狭いので、ヘッダだけ残して畳めると良い）。
- plan は**その場で更新**（行の追加・状態変化がガタつかないトランジション）。
- 行クリックの挙動は不要（表示専用）。

## 2. 流用してほしい既存パターン / 意匠

- **CA ブランド**: teal アクセント（`--cw-accent`）。既存トークン（`docs/design-handoff/*` / 既存コンポーネントの CSS 変数）を使用。
- **`ProgressIndicator`**（Composer 上の実行中表示）: 同じ層・同じ余白感で自然に同居させる。
- **`WorkflowFooter`（Customizer wedge の 5 状態 step bar）**: 「進捗を段階表示する」既存パターンの最有力参照。PlanPanel をその意匠の延長として設計してよい（step bar と TODO リストの中間）。
- **「✓ 応答完了」divider（emerald）**: 完了表現のトーン参照。PlanPanel の完了状態と役割が被らないよう整理してほしい。
- **`ToolCardMessage` / メッセージカード**: 角丸・境界・淡いシャドウのトーンを合わせる。

## 3. 制約 / 注意

- 幅が狭く、会話の邪魔をしない**軽量で控えめ**な帯であること（主役はあくまで会話）。
- ダーク/ライトは既存に準拠（現状ライト主体）。
- アイコンは既存の inline SVG 流儀（外部アイコンフォント不可）。
- 文言は日本語。`activeForm` は「〜中」の現在進行形。
- モバイル対応は今回スコープ外（デスクトップ幅のみ）。

## 4. 成果物

`docs/design-handoff/task-mechanism/` に、既存ハンドオフと同じ構成で:
- **hifi 仕様**（レイアウト・状態・トークン・余白の採寸）
- **参照 TSX**（`PlanPanel.tsx` のリファレンス実装。props 例: `{ todos: {content, status, activeForm}[] }`）
- **prototype**（状態バリエーションを切り替えられる素の jsx/html）

採寸の最終確定は Claude Design に委ねるが、**既存 Chat Panel の意匠・余白・トークンに馴染ませる**ことを最優先にしてほしい。

---

## 参考: データ形状（実装側の確定仕様）

```ts
type PlanTodo = {
  content: string;                                   // 命令形・短文（completed 表示用）
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;                                // 実行中ラベル（in_progress 表示用）
};
// PlanPanel は現在の todos[] を表示するだけ（更新は agent の update_plan ツール経由）
```
