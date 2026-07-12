# Handoff: メモリ閲覧/編集 UI — SettingsView「メモリ」セクション（#15 Step 2）

Cowork Agent for kintone の **設定画面（SettingsView）** に、**ユーザーが自分の「メモリ（会話をまたいで
蓄積される記憶）」をブラウズ・編集できるセクション** を追加するためのハンドオフ。設計意図・採寸・トークン・
参照実装をこのフォルダにまとめています。**既存 SettingsView の 1 セクションとして自然に馴染ませる**ことを最優先に設計しました。

> **別案との関係**: 同じ機能を「Header の 🧠 で開く独立右ペイン」として設計した版が
> `docs/design-handoff/memory-pane/` にあります。本フォルダは **設定画面統合版**。
> データ形状（`memoryStore.ts`）・ツリー/ビューア/エディタの中身・6 状態は共通で、
> **違いは "どこに出るか"（独立右ペイン vs SettingsView の 1 セクション）だけ**です。

---

## Overview（プロダクトモデル）

**メモリ = Anthropic Managed Agents の Memory Store**。エージェントがセッションを跨いでユーザーの好み・
業務文脈を覚えておくための、テキストファイル群。本 UI が扱う store は **2 つだけ**:

1. **個人設定（`preferences`）** … 全エージェント共通。口調・日付表記・業務用語エイリアスなど。
2. **このエージェント（`agent-context`）** … 現在選択中のエージェント固有の学習・修正記録。

- 各 store は **複数の Markdown ファイル**を持つ（例 `general.md` / `field-aliases.md` / `notes.md`）。
- 中身は基本 **エージェントが自律的に読み書き**する。この UI はユーザーが **確認し、必要なら手直し（編集/削除）** するためのもの。
- **SettingsView の「メモリ」セクション**として提供する。メモリ ON/OFF トグル（Header の別コントロール）とは役割が違う。

### スコープ外
versions 履歴 / 復元 / redact（#149）、ファイル新規作成、admin 用共有メモリ（Step 3）、モバイル幅。
**versions 履歴タブは置かない**（将来ここに「履歴」導線が増える余地だけ意識）。

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**であり、そのままプロダクションに貼るものではありません。
タスクは **これらの設計を対象コードベースの既存環境（React + Tailwind + 既存 `--cw-*` トークン + 既存 SettingsView）で再現すること**です。

- `memoryStore.ts` … **そのまま流用できるフレームワーク非依存の TS**（型 + 派生ヘルパー）。
- `MemorySection.tsx` … **React (TSX) 参照実装**。既存 SettingsView プリミティブ（`PaneHeading` / `SectionLabel` /
  `SectionCard` / `panePadding` / `ghostBtn`）と共通部品（`Markdown` / `ConfirmDialog` / `Banner` / icons）を
  import する形。トークン（`--cw-*`）が揃っていれば最小修正で組み込める。末尾に **nav 追加スニペット** `MEMORY_NAV_ITEM`。
- `prototype/` … 触って確認するスタンドアロン版（vanilla React + Babel）。
  `Memory Settings - UX Exploration.html` を開くと、nav 統合・全 6 状態・kintone 文脈・仕様まとめを確認できる。
  **実装は `prototype/` のインライン style ではなく、ルートの TS/TSX（`--cw-*` トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。**新規意匠は無し**
（SettingsView / SettingsNav / ArtifactPane の語彙の再構成）。

---

## ① SettingsNav への統合

既存 SettingsView は **左 nav（幅 192px）+ 右 detail** の 2 カラム。nav 項目には **admin 限定フラグ**があり、
非 admin には per-user 項目（「定期実行」など）だけが出る。

- nav に **per-user の「🧠 メモリ」項目**を 1 つ追加（＝「定期実行」と同じ非 admin 可、`perUser: true`）。
- **count の代わりに「自分」バッジ**を出して per-user であることを示す。
- 選ぶと右 detail に MemorySection（§②）を描画。非 admin もこの画面を開ける前提（入口は実装側で配線）。
- アイコンは既存 `NavIcon` の `brain` を流用。追加定義は `MemorySection.tsx` の `MEMORY_NAV_ITEM`。

---

## ② MemorySection（右 detail）

detail 幅は他セクションと同等。**上=2 store ツリー / 下=選択ファイル詳細**の縦割りで、detail 全体が
他セクションと同じ `overflow:auto` でスクロールする。

```
メモリ                                    自分の記憶を確認・編集   ← PaneHeading（title + sub）
──────────────────────────────────────────────────────────────
👤 個人設定（全エージェント共通）                    2 ファイル   ← SectionLabel（store 見出し）
┌────────────────────────────────────────────────────────────┐
│ 📄 general.md                          2.1 KB          🗑     │  ← カード内ファイル行
│ 📄 field-aliases.md                    0.4 KB          🗑     │
└────────────────────────────────────────────────────────────┘
✦ このエージェント（業務エージェント）              2 ファイル
┌────────────────────────────────────────────────────────────┐
│ 📄 notes.md                            1.2 KB          🗑     │
│ 📄 past-corrections.md                 0.3 KB          🗑     │
└────────────────────────────────────────────────────────────┘
────────────────────────────────────────  ← 区切り線
選択ファイル                                          更新 3日前   ← SectionLabel（右にメタ）
┌────────────────────────────────────────────────────────────┐
│ 📄 general.md                                          [編集] │  ← カードヘッダ
│ ─────────────────────────────────────────────────────────── │
│ # 口調・出力スタイル                                          │  ← Markdown レンダ / textarea
│ - ですます調で回答する。                                      │
└────────────────────────────────────────────────────────────┘
```

### ツリー / リスト部
- **2 store を SectionLabel の見出し**で分ける（`👤 個人設定（全エージェント共通）` / `✦ このエージェント（<エージェント名>）`）。右端に「N ファイル」。
- 各ファイル行: **file アイコン + basename（mono）+ サイズ（`byteLabel`）+ hover で表示される 🗑**。選択行は `accent-soft` 地 + 左に inset accent バー + アイコン塗り。
- **空 store**: 「まだ記憶がありません。会話を重ねるとエージェントが自動で書き込みます。」の dashed カード。

### ビュー / エディタ部
- 選択ファイルの内容を **ミニ Markdown レンダで表示**（artifact ペインの `.md-body` トーン）。カードヘッダ右に [編集]。
- **[編集]** → textarea 化（**等幅不要**・素直なテキスト編集、13px/1.7）。**[保存] / [取消]**。保存中はボタン内に accent spinner。
- **競合（保存時 409）** … 既存 **Banner（warn トーン）** で「このファイルは他で更新されました。最新の内容を再読込します。」+ 「再読込」。保存は `content_sha256` 楽観ロック。
- **ローディング** … store 解決 + 一覧取得中は ArtifactPane と同じ **shimmer スケルトンカード**。
- ビュー時のカード下に「エージェントが自動で更新します。手動の変更もいつでも上書きできます。」の一文。

### 削除
- ファイル行の 🗑 → **既存 `ConfirmDialog`（danger トーン）** → 消える。破壊的だがエージェントが再学習しうるので警告は控えめ。

---

## 状態バリエーション（プロトの各モック）

| # | 状態 | 説明 | プロト artboard |
|---|---|---|---|
| 1 | **初期 / 未選択** | ツリーだけ、下段は空プレースホルダ | `s1-empty-sel` |
| 2 | **選択・閲覧（主状態）** | Markdown レンダ | `s2-view` |
| 3 | **編集中** | textarea + 保存/取消 | `s3-edit` |
| 4 | **空メモリ** | 両 store とも seed 直後で中身薄い | `s4-empty` |
| 5 | **競合エラー** | 保存時 409 の再読込バナー | `s5-conflict` |
| 6 | **ローディング** | store 解決 + 一覧取得中 | `s6-loading` |
| — | 削除確認 | ConfirmDialog | `confirm` |

nav 統合は `inhost` / `solo-view` で確認（左 nav に「メモリ（自分）」がハイライト）。

---

## Design Tokens

CSS 変数（`--cw-*`、light 既定）。既存 SettingsView（`richColors` light）と同一語彙。

| トークン | light | 用途 |
|---|---|---|
| `--cw-bg` | `#faf8f3` | detail 背景・textarea 地 |
| `--cw-panel` | `rgba(255,255,255,0.88)` | Settings ヘッダ地 |
| `--cw-card` | `#ffffff` | ファイルカード・ダイアログ地 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | nav 地・カードヘッダ・スケルトン・hover |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | カード枠 |
| `--cw-border` | `rgba(35,18,0,0.10)` | 区切り・行境界・dashed |
| `--cw-text` | `#231200` | 見出し・本文・ファイル名 |
| `--cw-muted` | `#6b5f4a` | サブテキスト・サイズ |
| `--cw-subtle` | `#a89d85` | 空表示・件数 |
| `--cw-accent` | `#0d9488` | teal。選択・アイコン・保存ボタン・spinner・inset バー |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | 選択行地・store アイコン枠・nav ハイライト |
| `--cw-on-accent` | `#ffffff` | accent 塗り上の文字 |
| `--cw-warn` / `--cw-warn-soft` | `#b45309` / `#fef3c7` | 競合バナー |
| danger | `#b91c1c` | 削除確定ボタンのみ |

### 採寸
- **detail**: `panePadding = 22px 26px 32px`（他セクションと同）。
- **nav**: 幅 192px、項目 `padding:7px 10px`・`radius:8px`、「自分」バッジ 8.5px。
- **SectionLabel（store 見出し）**: 10.5px/700/大文字、アイコン枠 18px。
- **ファイル行**: `padding:10px 14px`・`gap:11px`、ファイル名 12px（`JetBrains Mono`）、サイズ 10.5px、選択で `inset 2px 0 0 accent`。
- **ファイルカードヘッダ**: `padding:9px 14px`、`card-hi` 地。[編集]/[保存]/[取消] は `padding:5px 12〜13px`・`radius:7px`。
- **本文**: Markdown 13px/1.7、textarea 同サイズ（resize:vertical）。
- **角丸**: カード 12px、行アイコン枠 6px、ボタン 7px、ダイアログ 14px、状態円/spinner 50%。
- **タイポ**: 本文 `Noto Sans JP`。ファイル名・サイズ・件数・メタは `JetBrains Mono`。

---

## データ形状（実装側の確定仕様）

```ts
type MemoryStoreView = {
  kind: 'preferences' | 'agent-context';
  label: string;              // 「個人設定（全エージェント共通）」/「このエージェント（○○）」
  storeId: string;            // memstore_...
  files: MemoryFile[];
};

type MemoryFile = {
  id: string;                 // mem_...
  path: string;               // '/preferences/general.md'（表示は basename）
  sizeBytes: number;
  updatedAt: string;
  content?: string;           // 選択時に retrieve(view=full) で取得
  contentSha256?: string;     // 編集保存の楽観ロック
};
```

派生値は `memoryStore.ts` の `basename()` / `byteLabel()` / `relativeTime()` / `isStoreEmpty()` /
`isMemoryEmpty()` / `resolveSelection()` を参照（フレームワーク非依存）。

- セクションは **表示・編集専用**。読み書きは host 側 REST（Anthropic Memory API）が担う。
- 非 admin が設定画面を開ける入口、および nav への「メモリ」項目追加は実装側で配線する。

---

## 組み込み手順（要約）

1. SettingsNav の項目定義に `MEMORY_NAV_ITEM`（`perUser: true`）を追加。非 admin フィルタで「定期実行」と同列に出す。
2. SettingsView の detail ルータに `section === 'memory'` を追加し、`<MemorySection … />` を描画。
3. ファイル選択時に `retrieve(view=full)` で `content` + `content_sha256` を取得（それまで `asyncState='loading'`）。
4. 保存は `content_sha256` を載せて PUT。409 なら `asyncState='conflict'` にして Banner 表示、「再読込」で再取得。
5. `Markdown` / `ConfirmDialog` / `Banner` / SettingsView プリミティブは既存の実体に差し替え。`--cw-*` が揃っていれば配色調整は不要。

---

## Files

| ファイル | 役割 |
|---|---|
| `memoryStore.ts` | **型 + ヘルパー（本体）**。`MemoryStoreView` / `MemoryFile` / `basename` / `byteLabel` / `resolveSelection` ほか。フレームワーク非依存（`memory-pane/` と共通） |
| `MemorySection.tsx` | **参照実装**。SettingsView の 1 セクション（6 状態・ツリー・閲覧/編集・削除確認）+ `MEMORY_NAV_ITEM`。`--cw-*` + 既存プリミティブ参照 |
| `prototype/Memory Settings - UX Exploration.html` | スタンドアロン検討版（nav 統合・全状態・kintone 文脈・仕様まとめ） |
| `prototype/memory-section.jsx` | プロト本体（`MemorySection` / `SettingsShell` / ファイル行 / 詳細 / 削除確認） |
| `prototype/memory-data.jsx` | プロトの土台（`richColors` / `MemIcons` / ミニ Markdown / サンプル store） |
| `prototype/{design-canvas.jsx, styles.css}` | プロト実行用の土台（design canvas / フォント・keyframes） |
