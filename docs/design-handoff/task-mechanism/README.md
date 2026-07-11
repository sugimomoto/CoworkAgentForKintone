# Handoff: タスク（Plan / 進捗）UI — PlanPanel（#128）

Cowork Agent for kintone の Chat Panel に、**エージェントが 1 つのゴールに到達するまでの作業（サブタスク）を
計画 → 進捗 → 完了で "見える化" する** UI（Claude Code の TodoWrite / Cowork の TaskCreate–TaskUpdate 相当）の実装ハンドオフ。
このフォルダだけで着手できるよう、設計意図・採寸・トークン・参照実装をまとめています。

---

## Overview（プロダクトモデル = 概念B）

「常設スケジュールタスクの台帳」ではなく、**1 セッションがゴールに到達するまでの作業**を可視化するもの。

- エージェントが多段の依頼（複数ファイル / 複数ツール / 破壊的操作を含む）に着手するとき、`update_plan` ツールで
  **サブタスク一覧**を宣言し、進行に合わせて状態を更新する。
- 各サブタスクは `content`（命令形の短文）/ `status`（`pending` / `in_progress` / `completed`）/
  `activeForm`（実行中の現在進行形ラベル）を持つ。データ形状は `planTodos.ts` の `PlanTodo` を正とする。
- **軽い依頼では plan を出さない**（任意）。＝ plan が無い会話も普通にある → その場合 **PlanPanel は帯ごと非表示**。
- 承認 UI は設計対象外（破壊的操作は既存の承認カードのまま）。

設計するサーフェスは **PlanPanel（進捗チェックリスト）** 1 コンポーネント。Chat Panel の会話ビュー内で、
現在の plan を常に見える形で表示する。

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**（見た目と挙動を示すプロトタイプ）であり、
そのままプロダクションに貼るものではありません。タスクは **これらの設計を対象コードベースの既存環境
（React + Tailwind + 既存 `--cw-*` トークン）で再現すること**です。

- `planTodos.ts` は **そのまま流用できるフレームワーク非依存の TS**（型 + 派生ヘルパー）。
- `PlanPanel.tsx` は **React (TSX) 参照実装**。`planTodos.ts` に依存し、CSS 変数トークン（`--cw-*`）を
  Tailwind の arbitrary value で参照。トークン定義さえ合っていれば最小修正で組み込めます。
- `prototype/` は触って確認するスタンドアロン版（vanilla React + Babel）。
  `Task Mechanism - UX Exploration.html` を開くと、全状態・kintone 文脈・ライブ遷移・設計根拠を実際に確認できます。
  **実装は `prototype/` のインライン style ではなく、ルートの TS/TSX（`--cw-*` トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。
既存 Chat Panel / WorkflowFooter / ProgressIndicator と同一トーンになるよう設計しているので、
既存コンポーネント / トークンを使って再現してください。**新規意匠は無し**（既存語彙の再構成）。

---

## Layout / 配置

```
┌─ Chat Panel（幅 ~360〜420px, 縦長）───────────┐
│  Header（Agent 名 / ステータス）               │  flex-none
├───────────────────────────────────────────────┤
│                                               │
│  会話スクロール（stick-to-bottom）             │  flex-1 / overflow-y-auto
│    UserMessage / AgentMessage / …             │
│    〔応答完了 divider（emerald）〕             │
│                                               │
├───────────────────────────────────────────────┤
│  ▼ PlanPanel（進捗チェックリスト）★           │  flex-none ← スクロールの外
├───────────────────────────────────────────────┤
│  Composer（入力欄）                            │  flex-none
└───────────────────────────────────────────────┘
```

- **位置**: メッセージ一覧の下・Composer の上の "ピン留め" 帯（既存 `ProgressIndicator` と同じ層）。
- **スクロール追従との非干渉**: PlanPanel は会話スクロールコンテナの **外**（兄弟要素）に置く。
  `flex-none` で、会話は `flex-1 + overflow-y-auto`。plan の開閉・行数変化がスクロール位置を揺らさない。
- **plan 無し**: `todos.length === 0 → return null`。帯ごと出さない（区切り線も出さない）。
- **高さ**: 行リストは `max-height:216px`。超えたらリスト内スクロール（`.plan-rows`）。会話領域を食い過ぎない。

---

## 各行（サブタスク）の状態

| status | アイコン（18px スロット内） | ラベル | 行のトーン |
|---|---|---|---|
| `pending` | 13px 中空円（`1.5px --cw-border`・塗り無し） | `content` | `--cw-subtle`（未着手＝淡い） |
| `in_progress` | 15px spinner（`border-2` / `border-t --cw-accent` を回転） | **`activeForm`** + 末尾「…」 | `--cw-text` / 太字 / 地 `--cw-accent-soft` / 右に「実行中」pill |
| `completed` | 16px `--cw-accent-soft` 円 + `--cw-accent` の ✓ | `content` | `--cw-muted`（済感。取り消し線は使わず淡色で処理） |

- **`in_progress` は常に 1 つが基本**（強調表示）。`planSummary().activeIndex` が最初の 1 件を指す。
- ラベルは Cowork 流の「**内部処理名を出さず、意図ベースの自然文**」。`activeForm` は「〜中」の現在進行形。
- 行クリックの挙動は **無し**（表示専用）。

---

## ヘッダ / まとめ

- 左: chevron（開閉）+ 状態アイコン（実行中 = spinner / 全完了 = teal ✓ 塗り円）。
- 中: タイトル。実行中 =「作業を実行中」/ **畳んだ時は現在の `activeForm` に差し替え**（畳んでも何を実行中か残す）/ 全完了 =「作業が完了しました」。
- 右: 進捗カウント `3 / 6`（mono・tabular-nums）+ **44px ミニ進捗バー**（`--cw-accent` fill・`width` を 300ms トランジション）。

### 全 completed の終端状態（応答完了 divider との棲み分け）

**要件**: 既存の emerald「✓ 応答完了」divider と役割・見た目が被らないこと。

- PlanPanel の完了は **teal（`--cw-accent`）** で、**帯内にコンパクト**（＝この plan が済んだ）。既定で **畳む**（ヘッダ 1 行のみ）。
- emerald「応答完了」divider は **会話スクロール内の中央 divider**（＝この応答が済んだ）。**別レイヤ・別色**なので同居しても競合しない。
- プロトの状態 4（`s4-done`）に両方を同時に出して非競合を確認できる。

---

## 状態バリエーション（プロトの各モック）

| # | 状態 | 説明 | プロト artboard |
|---|---|---|---|
| 1 | **plan 無し** | 帯ごと非表示 | `s1-none` |
| 2 | **開始直後** | 全 pending / 先頭が in_progress（`0 / 6`） | `s2-start` |
| 3 | **進行中（主状態）** | 一部 completed / 1 つ in_progress / 残り pending（`3 / 6`） | `s3-mid` |
| 4 | **全 completed** | 完了終端（既定で畳む）+ emerald divider 同居 | `s4-done` / `s4-done-open` |
| 5 | **長い plan** | 8〜10 件。完了行をたたみ込み（`5 / 10`） | `s5-long` |

---

## インタラクション

- **折りたたみ / 展開**: ヘッダクリックで `collapsed` トグル。既定は「全完了なら畳む / それ以外は開く」（`defaultCollapsed` で上書き可）。
- **完了行のたたみ込み**（長い plan の縦圧縮）: `total > 6 && completed ≥ 2` のとき、完了行を「**N 件完了 ▾**」の 1 行に畳み、
  in_progress + pending のみ展開表示。クリックで全完了行を展開（「完了分をたたむ」で戻す）。
- **その場更新**: 行の追加・状態変化は `transition-colors`（背景・文字色 ~200ms）でガタつかせない。
  進捗バーは `width` を 300ms でトゥイーン。spinner は `animate-spin`（0.9s linear）。プロトの `live` artboard で遷移を確認できる。
- **プレファレンス**: 動きは控えめ（既存 Chat Panel に合わせ抑制）。派手な演出はしない。

---

## Design Tokens

CSS 変数（`--cw-*`、light 既定 + dark 対応）。既存 Chat Panel（richColors light）と同一語彙。

| トークン | light | 用途 |
|---|---|---|
| `--cw-bg` | `#faf8f3` | パネル背景 |
| `--cw-panel` | `rgba(255,255,255,0.88)` | 帯背景（`backdrop-blur`） |
| `--cw-card` | `#ffffff` | 実行中 pill 地 |
| `--cw-border` | `rgba(35,18,0,0.10)` | 上境界・pending 円・進捗バー track |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | （近傍カードと合わせる） |
| `--cw-text` | `#231200` | 実行中ラベル・タイトル |
| `--cw-muted` | `#6b5f4a` | 完了ラベル・カウント |
| `--cw-subtle` | `#a89d85` | 未着手ラベル・chevron |
| `--cw-accent` | `#0d9488` | teal。spinner / ✓ / 進捗バー / 実行中 pill / accent 帯 |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | in_progress 行の地 / 完了 ✓ 円の地 |
| `--cw-on-accent` | `#ffffff` | accent 塗り円上の ✓ |
| emerald | `#047857` | **応答完了 divider 専用**（PlanPanel では使わない＝棲み分け） |

- **角丸**: 行 8px、実行中 pill / カウント 999px、進捗バー 2px、状態円 50%。
- **採寸**: 行 `padding:5px 8px`・`gap:9px`・`font:12.5px`。アイコンスロット 18px。ヘッダ `padding:9px 12px`。進捗バー 44×4px。行リスト `max-height:216px`。
- **タイポ**: 本文 `Noto Sans JP`。カウント・実行中 pill は `JetBrains Mono`。
- **影**: 帯そのものに影は無し（`border-top` + `backdrop-blur` のみ）。

---

## データ形状（実装側の確定仕様）

```ts
type PlanTodo = {
  content: string;                                   // 命令形・短文（completed / pending 表示用）
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;                                // 実行中ラベル（in_progress 表示用）
};
// PlanPanel は現在の todos[] を表示するだけ（更新は agent の update_plan ツール経由）
```

派生値は `planTodos.ts` の `planSummary()` / `todoLabel()` / `shouldGroupCompleted()` を参照（フレームワーク非依存）。

---

## 組み込み手順（要約）

1. Chat Panel のレイアウトで、会話スクロール（`flex-1 overflow-y-auto`）と Composer の **間** に
   `<PlanPanel todos={currentPlan} />` を **兄弟要素**として差し込む（スクロールの外＝ピン留め）。
2. `currentPlan` は agent の `update_plan` が保持する `PlanTodo[]`。空配列 / 未定義なら PlanPanel は自動で非表示。
3. トークン（`--cw-*`）が既存 Chat Panel と揃っていれば配色調整は不要。既存アイコンセットがあれば ✓ / chevron / spinner を差し替え可。
4. 完了時の emerald「応答完了」divider は既存のまま。PlanPanel の完了（teal・帯内）とは色・レイヤで棲み分け済み。

---

## Files

| ファイル | 役割 |
|---|---|
| `planTodos.ts` | **型 + ヘルパー（本体）**。`PlanTodo` / `PlanStatus` / `planSummary` / `todoLabel` / `shouldGroupCompleted`。フレームワーク非依存 |
| `PlanPanel.tsx` | **参照実装**。表示専用の進捗チェックリスト帯（5 状態・折りたたみ・完了たたみ込み）。`--cw-*` トークン参照 |
| `prototype/Task Mechanism - UX Exploration.html` | スタンドアロン検討版（全状態・kintone 文脈・ライブ遷移・仕様まとめ） |
| `prototype/plan-panel.jsx` | プロト本体（`PlanPanel` / `ChatShell` / `DoneDivider` / `PlanPanelLive`） |
| `prototype/plan-data.jsx` | プロトの土台（`richColors` / `PlanIcons` / 各状態のサンプル `todos[]`） |
| `prototype/{design-canvas.jsx, styles.css}` | プロト実行用の土台（design canvas / フォント・keyframes） |

---

## スコープ外（本設計では扱わない）

- 承認 UI（破壊的操作は既存の承認カードのまま）。
- plan の永続台帳・スケジュール実行（概念B ＝ 1 セッションの可視化に限定）。
- モバイル幅対応（今回はデスクトップ幅のみ）。
- 行クリックによる詳細展開・並べ替え等の編集操作（PlanPanel は表示専用）。
