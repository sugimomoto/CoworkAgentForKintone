# Handoff: 共通 base システムプロンプト編集 UI — Plugin Config「共通システムプロンプト」セクション（#141）

Cowork Agent for kintone の **Plugin Config 画面（admin 専用の設定画面）** に、
**全エージェント共通の「base システムプロンプト」を編集・リセットできるセクション** を追加するためのハンドオフ。
設計意図・採寸・トークン・参照実装をこのフォルダにまとめています。
**既存 ConfigScreen（`design_handoff_mcp_registration/ConfigScreen.tsx`）の 1 セクションとして自然に馴染ませる**ことを最優先に設計しました。

---

## Overview（プロダクトモデル）

各エージェント（業務 / カスタマイザー / アプリデザイナー / エージェントデザイナー / admin 作成の Custom）の
システムプロンプトは、**base（共通の作法）+ persona（エージェント固有）** の 2 層で構成されます。

- **base** = 全エージェントに効く基本作法（トーン/書式・誠実さ・ツールの使い方・メモリの扱い・メタ振る舞い）。**tenant 全体で 1 つ**。
- この UI は admin が **base を編集**し、必要なら **デフォルトに戻す** ためのもの。**persona はこの画面では扱わない**。
- base はコードに**既定値**（`defaultBase`）を持ち、Config で override（未設定なら既定を使用）。
- 変更は**次の新規会話から反映**される（既存の会話や再デプロイは不要）。

### スコープ外
persona 編集 / エージェント個別設定 / プロンプトのバージョン履歴・差分 / プレビュー実行。

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**であり、そのままプロダクションに貼るものではありません。
タスクは **これらの設計を対象コードベースの既存環境（React + Tailwind + 既存 `--cw-*` トークン + 既存 ConfigScreen）で再現すること**です。

- `basePrompt.ts` … **そのまま流用できるフレームワーク非依存の TS**（型 + 派生ヘルパー: `statusOf` / `isUsingDefault` / `charCount` / `isOverLimit` / `canSave` / `isDirty`）。
- `BasePromptSection.tsx` … **React (TSX) 参照実装**。ConfigScreen の 1 セクションとして差し込む形。既存の共通部品（`ConfirmDialog` / `Banner` / icons）を import する。`--cw-*` が揃っていれば最小修正で組み込める。
- `prototype/` … 触って確認するスタンドアロン版（vanilla React + Babel）。`Base Prompt Config - UX Exploration.html` を開くと、ホスト統合・全状態・仕様まとめを確認できる（アコーディオン開閉・入力・文字数カウント・リセット確認が動く）。
  **実装は `prototype/` のインライン style ではなく、ルートの TS/TSX（`--cw-*` トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。
**新規意匠は無し**（ConfigScreen のセクションカード + アコーディオン + `Banner` / `ConfirmDialog` の再構成）。

---

## ① 配置

ConfigScreen は **max-width 720px・admin 専用**の縦積みカード群（`接続セットアップ`（ウィザード / ステータス）と `MCP サーバー` の 2 ゾーン左レール）。

- 本セクションは **接続セットアップの末尾「高度な設定」** に 1 枚追加する（Step 群 / ステータス行の後・画面下「保存」の前）。**専用の左 nav 項目は増やさない**（多くの admin は触らないため）。
- **上級者向け設定なので既定は畳む（アコーディオン）**。畳んだ状態でも右端に**状態チップ**（既定を使用中 / カスタム）を出し、現状が一目で分かる。
- **保存はこのセクション単体では持たず、画面下の一括「保存」に集約**（ConfigScreen 既存挙動と統一。空欄保存 = 既定使用）。

```
高度な設定                                                    ← SectionLabel
┌──────────────────────────────────────────────────────────────┐
│ ▸ ✦ 共通システムプロンプト [上級者向け]        ● 既定を使用中  │  ← アコーディオン ヘッダ（畳んだ状態）
└──────────────────────────────────────────────────────────────┘

── 展開すると ──
┌──────────────────────────────────────────────────────────────┐
│ ▾ ✦ 共通システムプロンプト [上級者向け]        ● カスタム     │
│ ───────────────────────────────────────────────────────────── │
│ 全エージェントに共通で効く基本作法です。persona は含みません。 │  ← 補足
│ 変更は次の新規会話から反映されます。                          │
│ base システムプロンプト                        1,240 / 20,000 │  ← ラベル + カウンタ
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ # 基本の作法（当社カスタム）…（等幅・リサイズ可）        │ │  ← textarea
│ └──────────────────────────────────────────────────────────┘ │
│ [↻ デフォルトに戻す]              変更は画面下の「保存」で確定 │  ← フッタ導線
└──────────────────────────────────────────────────────────────┘
```

---

## ② セクションの構成

### ヘッダ（アコーディオン）
- **chevron + ✦ アイコン + 「共通システムプロンプト」+「上級者向け」バッジ**。右端に**状態チップ**。
- 畳んだ状態は見出し下にサブ一行（「全エージェント共通の作法（base）。既定を上書きできます。」）。
- カード全体は `bg-card` / `border-card-border` / `radius:12px`。ヘッダ押下で開閉、開時は上に区切り線。

### 状態チップ
- **既定を使用中**: グレー（`rgba(35,18,0,0.05)` 地 / `--cw-muted` 文字 / `--cw-subtle` ドット）。
- **カスタム**: teal（`--cw-accent-soft` 地 / `--cw-accent` 文字 + ドット）。
- 判定は **`value`（override）の空判定のみ**（`isUsingDefault`）。

### 補足文
`11.5px / --cw-muted`。「全エージェントに共通で効く基本作法です。各エージェント固有の指示（persona）は含みません。**変更は次の新規会話から反映されます。**」

### エディタ
- **textarea**: 等幅（`JetBrains Mono` 12.5px / 1.7）・**リサイズ可（vertical）**・`min-height:200px`・`bg:--cw-bg` / `radius:8px`。
- **プレースホルダ**（空 = 既定使用時）:「未設定のため既定の作法を使用します。ここに入力すると、既定を上書きするカスタム base になります。」
- **文字数カウンタ**: ラベル右に `1,240 / 20,000`（mono・tabular）。上限超過で warn 色 + 太字。

### フッタ導線
- **既定を使用中（空）のとき**: 「**既定を読み込んで編集**」（teal リンク / `ImportIcon`）。押すと `defaultBase` をエディタに差し込み、override の起点にできる。「デフォルトに戻す」は**出さない**（既に既定使用中のため）。右側に注記「空欄のまま保存すると既定の作法が使われます」。
- **カスタム（override 入力あり）のとき**: 「**デフォルトに戻す**」（warn・枠つきボタン / `RefreshIcon`）→ `ConfirmDialog`。右側に注記「変更は画面下の『保存』で確定します」。

### 文字数超過
- `charCount(value) > maxLength` で **warn `Banner`** を出す（「文字数が上限（20,000 字）を超えています。保存するには N 字減らしてください。」）。textarea 枠も warn 色。`canSave` は false（画面下「保存」を非活性にする想定）。

### リセット確認
- 「デフォルトに戻す」→ 既存 **`ConfirmDialog`（warn トーン）**。文面「共通プロンプトを既定に戻します／カスタム（override）を破棄し、コードの既定 base に戻します。**全エージェント**の共通作法に影響します（persona には影響しません）。変更は次の新規会話から反映されます。」確定で `onResetToDefault`（= override を空に）。

---

## 状態バリエーション（プロトの各モック）

| # | 状態 | 説明 | プロト artboard |
|---|---|---|---|
| 1 | **既定使用中・畳んだ状態**（主） | アコーディオン閉 + 「既定を使用中」チップ | `s1-collapsed` |
| 2 | **既定使用中・展開** | 空 textarea + placeholder + 「読み込んで編集」導線 | `s2-empty-open` |
| 3 | **編集中（override 入力）** | テキスト入り + カウンタ + 「カスタム」チップ | `s3-editing` |
| 4 | **override 保存済み** | 落ち着いた状態 + 「デフォルトに戻す」有効 | `s4-saved` |
| 5 | **リセット確認** | ConfirmDialog（warn） | `s5-confirm` |
| 6 | **文字数超過** | warn バナー + textarea 枠 warn + 保存不可 | `s6-over` |
| — | 既定を読み込んだ直後（任意） | `defaultBase` をエディタに差し込んだ状態 | `s7-loaded` |

配置は `inhost`（既定・畳んだ状態）/ `inhost-open`（カスタム・展開）でホスト統合を確認。

---

## Design Tokens

CSS 変数（`--cw-*`、light 既定）。既存 ConfigScreen / Settings（`richColors` light）と同一語彙。

| トークン | light | 用途 |
|---|---|---|
| `--cw-bg` | `#faf8f3` | detail 背景・textarea 地 |
| `--cw-card` | `#ffffff` | セクションカード・ダイアログ地 |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | カード枠・textarea 枠 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | 「上級者向け」バッジ地・保存フッタ地 |
| `--cw-border` | `rgba(35,18,0,0.10)` | 区切り線・ボタン枠 |
| `--cw-text` | `#231200` | 見出し・本文・エディタ文字 |
| `--cw-muted` | `#6b5f4a` | 補足・注記 |
| `--cw-subtle` | `#a89d85` | placeholder・カウンタ・「既定を使用中」ドット |
| `--cw-accent` | `#0d9488` | teal。✦ アイコン・「カスタム」チップ・「読み込んで編集」導線・focus 枠 |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | 「カスタム」チップ地 |
| `--cw-warn` / `--cw-warn-soft` | `#b45309` / `#fef3c7` | 超過バナー・「デフォルトに戻す」・リセット確認（枠 `#f0c98a`） |
| 緑ドット / okText | `#22c55e` / `#047857` | 接続情報の「設定済み」（ホスト側） |

### 採寸
- **セクションカード**: `radius:12px`、ヘッダ `padding:14px 16px`、本文 `padding:14px 16px 16px`、上に区切り線。
- **ヘッダ**: chevron 12px（開で `rotate(90deg)`）+ ✦ 15px + タイトル 14px/600 +「上級者向け」バッジ `9.5px / padding:1px 6px / radius:4px`。
- **状態チップ**: `10.5px / padding:4px 10px / radius:999px`、ドット 6px。
- **補足**: 11.5px / 1.6。
- **エディタ**: `min-height:200px`、`radius:8px`、`padding:10px 12px`、mono 12.5px/1.7、`resize:vertical`。
- **カウンタ**: mono 10.5px / tabular。
- **フッタ**: 「読み込んで編集」= teal リンク 11.5px/600、「デフォルトに戻す」= 枠ボタン `padding:6px 11px / radius:7px`、注記 10.5px。
- **ConfirmDialog**: 幅 380px、`radius:14px`、影 `0 20px 60px rgba(0,0,0,0.28)`、確定ボタン = warn。
- **タイポ**: 本文 `Noto Sans JP`。エディタ・カウンタ・接続値は `JetBrains Mono`。

---

## データ形状（実装側の確定仕様）

```ts
type BasePromptSectionProps = {
  /** 現在の override（未設定 = 空文字。空なら既定を使用）。 */
  value: string;
  onChange: (v: string) => void;
  /** コードの既定 base（「既定を読み込む」やプレースホルダ表示に使う）。 */
  defaultBase: string;
  /** override をクリアして既定へ戻す（確認後）。 */
  onResetToDefault: () => void;
  /** 文字数上限（目安）。既定 20,000。 */
  maxLength?: number;
  /** アコーディオンの初期開閉。既定は閉じ。 */
  defaultOpen?: boolean;
};
// 保存は ConfigScreen 全体の「保存」に集約（このセクション単体の保存ボタンは持たない）。
// 「既定使用中 / カスタム」は value の空判定で表示（basePrompt.ts の statusOf / isUsingDefault）。
```

派生値は `basePrompt.ts` の `statusOf()` / `isUsingDefault()` / `charCount()` / `isOverLimit()` / `remaining()` / `canSave()` / `isDirty()` を参照（フレームワーク非依存）。

---

## 組み込み手順（要約）

1. ConfigScreen の **接続セットアップ**（`ConfigStatusView` / ウィザード）の末尾、画面下「保存」の直前に「高度な設定」ラベル + `<BasePromptSection … />` を差し込む。
2. `value` は Config から読んだ base override（未設定 = 空文字）、`defaultBase` はコードの既定 base を渡す。`onChange` で下書きを ConfigScreen 全体の保存対象 state に載せる。
3. 保存は既存の一括「保存」で確定（`value` が空なら override をクリア = 既定使用）。`canSave(draft)` が false（上限超過）のときは保存ボタンを非活性に。
4. 「デフォルトに戻す」は `ConfirmDialog` を挟んで `onResetToDefault`（override を空に）。
5. `ConfirmDialog` / `Banner` / icons は既存の実体に差し替え。`--cw-*` が揃っていれば配色調整は不要。

---

## Files

| ファイル | 役割 |
|---|---|
| `basePrompt.ts` | **型 + ヘルパー（本体）**。`statusOf` / `isUsingDefault` / `charCount` / `isOverLimit` / `remaining` / `canSave` / `isDirty` / `DEFAULT_MAX_LENGTH`。フレームワーク非依存 |
| `BasePromptSection.tsx` | **参照実装**。ConfigScreen の 1 セクション（アコーディオン・6 状態・エディタ・状態チップ・リセット確認）。`--cw-*` + 既存 `ConfirmDialog` / `Banner` / icons 参照 |
| `prototype/Base Prompt Config - UX Exploration.html` | スタンドアロン検討版（ホスト統合・全状態・仕様まとめ） |
| `prototype/base-prompt-section.jsx` | プロト本体（`BasePromptSection` / `ConfigShell` / `ConfigBody` / `StatusRowLite`） |
| `prototype/base-prompt-data.jsx` | プロトの土台（トークン `D` / アイコン / `StatusChip` / `Banner` / `ConfirmDialog` / 既定 base + カスタム例） |
| `prototype/{design-canvas.jsx, styles.css}` | プロト実行用の土台（design canvas / フォント・keyframes） |
