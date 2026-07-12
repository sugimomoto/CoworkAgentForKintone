# Handoff: メモリ閲覧/編集 UI — MemoryPane（#15 Step 2）

Cowork Agent for kintone の Chat Panel に、**ユーザーが自分の「メモリ（会話をまたいで蓄積される記憶）」を
ブラウズ・編集できる右ペイン** を実装するためのハンドオフ。設計意図・採寸・トークン・参照実装をこのフォルダに
まとめています。**既存の ArtifactPane / SettingsView / Header の意匠・余白・トークンに馴染ませる**ことを最優先に設計しました。

---

## Overview（プロダクトモデル）

**メモリ = Anthropic Managed Agents の Memory Store**。エージェントがセッションを跨いでユーザーの好み・
業務文脈を覚えておくための、テキストファイル群。本 UI が扱う store は **2 つだけ**:

1. **個人設定（`preferences`）** … 全エージェント共通。口調・日付表記・業務用語エイリアスなど。
2. **このエージェント（`agent-context`）** … 現在選択中のエージェント固有の学習・修正記録。

- 各 store は **複数の Markdown ファイル**を持つ（例 `general.md` / `field-aliases.md` / `notes.md`）。
- 中身は基本 **エージェントが自律的に読み書き**する。この UI はユーザーが **確認し、必要なら手直し（編集/削除）** するためのもの。
- **Header の 🧠 ボタン**で開閉する。メモリ ON/OFF ピル（別コントロール）とは役割が違う。

設計サーフェスは **① Header の 🧠 エントリボタン** と **② MemoryPane（右ペイン本体）** の 2 つ。

### スコープ外
versions 履歴 / 復元 / redact（#149）、ファイル新規作成、admin 用共有メモリ、モバイル幅。
**versions 履歴タブは置かない**（将来ここに「履歴」導線が増える余地だけ意識）。

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**であり、そのままプロダクションに貼るものではありません。
タスクは **これらの設計を対象コードベースの既存環境（React + Tailwind + 既存 `--cw-*` トークン）で再現すること**です。

- `memoryStore.ts` … **そのまま流用できるフレームワーク非依存の TS**（型 + 派生ヘルパー）。
- `MemoryPane.tsx` … **React (TSX) 参照実装**。`memoryStore.ts` に依存し、`--cw-*` トークンを Tailwind arbitrary value で参照。
  Markdown レンダラ / ConfirmDialog / 各アイコンは既存の共通部品に差し替える前提（import を実体へ）。
- `prototype/` … 触って確認するスタンドアロン版（vanilla React + Babel）。
  `Memory Pane - UX Exploration.html` を開くと、全 6 状態・Header 入口・kintone 文脈・仕様まとめを確認できる。
  **実装は `prototype/` のインライン style ではなく、ルートの TS/TSX（`--cw-*` トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。**新規意匠は無し**
（ArtifactPane / SettingsView / Header の語彙の再構成）。

---

## ① Header の 🧠 エントリボタン

- 既存 Header（CA ブランド + メモリ ON/OFF ピル + ⚙️ + ×）に、**🧠 IconButton を 1 つ追加**。
- ⚙️（gear）と **同じ IconButton 意匠・サイズ（28×28 / radius 7）・余白**。押すと右ペインに MemoryPane を開き、
  開いている間は `accent-soft` 地 + `accent` 文字色で **トグル的にハイライト**（`aria-pressed`）。
- **メモリ ON/OFF ピルとは別物**。配置は「… ピル · 🧠 · ⚙️ · ×」の順で、ピルは**ラベル付き**、🧠 は**アイコンのみ**にして役割を視覚的に分ける。

| コントロール | 役割 |
|---|---|
| メモリ ON/OFF ピル（既存 `MemoryToggle`） | **次の会話でメモリを使うか** |
| 🧠 ボタン（新規） | **保存済みメモリを見る**（本ペインを開く） |

参照実装は `MemoryPane.tsx` の `MemoryEntryButton`。

---

## ② MemoryPane（右ペイン本体）

ArtifactPane / SettingsView と同じ枠・同じ開き方で右ペインに出る。開くペインの優先度は **`設定 > メモリ > Artifact`**。

- **basis 幅** … `~540px`（Artifact ~480 と Settings ~560 の中間）。Chat Panel が狭いと右ペインはオーバーレイ、
  広い（≥1024px）で横並び。
- **縦 2 段構成**（`SettingsView` の左 nav/右 detail をこの幅向けに縦へ畳んだもの）:

```
┌ 🧠 メモリ ─────────────────────────── [×] ┐  ← ペインヘッダ（SettingsView 同意匠）
│ ▾ 👤 個人設定                        2  │  ← store セクション 1（preferences）
│    📄 general.md            2.1 KB  🗑  │     ・ファイル行（basename + サイズ + hover 削除）
│    📄 field-aliases.md      0.4 KB  🗑  │
│ ▾ ✦ このエージェント（業務…）        2  │  ← store セクション 2（agent-context）
│    📄 notes.md              1.2 KB  🗑  │
│    📄 past-corrections.md   0.3 KB  🗑  │
├─────────────────────────────────────────┤  ← 上=ツリー（max-height:46%, 超過でスクロール）
│  📄 general.md              更新 3日前 [編集] │  ← 選択ファイルのビューヘッダ
│  ───────────────────────────────────────│
│  # 口調・出力スタイル                      │     ・Markdown レンダ（閲覧時）
│  - ですます調で回答する。                  │     ・[編集]で textarea に切替 → [保存]/[取消]
│  …                                       │
└─────────────────────────────────────────┘  ← 下=ビュー/エディタ（flex-1）
```

### ツリー / リスト部
- **2 store をセクション見出し**で分ける（`👤 個人設定` / `✦ このエージェント（<エージェント名>）`）。chevron で開閉、右端に件数。
- 各ファイル行: **file アイコン + basename（mono）+ サイズ（`byteLabel`）+ hover で表示される 🗑**。選択行は `accent-soft` 地 + `accent` 枠 + アイコン塗り。
- **空 store**: 「まだ記憶がありません。会話を重ねると自動で書き込まれます。」の dashed プレースホルダ。
- ファイル数が多い場合はツリー領域内でスクロール（`max-height:46%`）。

### ビュー / エディタ部
- 選択ファイルの内容を **ミニ Markdown レンダで表示**（artifact ペインの `.md-body` トーンに合わせる）。
- **[編集]** → textarea 化（**等幅不要**・素直なテキスト編集、13px/1.7）。**[保存] / [取消]**。保存中はボタン内に accent spinner。
- **競合（保存時 409）** … 「このファイルは他で更新されました。最新の内容を再読込します。」の **warnSoft バナー + 「再読込」**。
  保存は `content_sha256` 楽観ロックで判定。
- **ローディング** … store 解決 + 一覧取得中は Artifact ペインと同じ **shimmer スケルトン**。
- ビュー時のフッタに「エージェントが自動で更新します。手動の変更もいつでも上書きできます。」の一文。

### 削除
- ファイル行の 🗑 → **既存 `ConfirmDialog` 相当**（danger トーン・危険色ボタン + 一文）→ 消える。破壊的だがエージェントが再学習しうるので警告は控えめ。

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
| — | Header 入口 | ペイン閉/開（🧠 ハイライト） | `header-closed` / `header-open` |

---

## Design Tokens

CSS 変数（`--cw-*`、light 既定）。既存 Chat Panel（`richColors` light）と同一語彙。

| トークン | light | 用途 |
|---|---|---|
| `--cw-bg` | `#faf8f3` | ペイン背景・textarea 地 |
| `--cw-panel` | `rgba(255,255,255,0.88)` | ヘッダ/フッタ地（`backdrop-blur`） |
| `--cw-card` | `#ffffff` | ダイアログ地 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | 非選択アイコン枠・スケルトン・hover |
| `--cw-border` | `rgba(35,18,0,0.10)` | 境界・行区切り・dashed プレースホルダ |
| `--cw-text` | `#231200` | 見出し・本文・ファイル名 |
| `--cw-muted` | `#6b5f4a` | サブテキスト・サイズ |
| `--cw-subtle` | `#a89d85` | 空表示・chevron・件数 |
| `--cw-accent` | `#0d9488` | teal。選択・アイコン・保存ボタン・spinner |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | 選択行地・store アイコン枠・🧠 ハイライト |
| `--cw-on-accent` | `#ffffff` | accent 塗り上の文字 |
| `--cw-warn` | `#b45309` | 競合バナー文字/ボタン |
| `--cw-warn-soft` | `#fef3c7` | 競合バナー地 |
| danger | `#b91c1c` | 削除確定ボタンのみ |

### 採寸
- **ペインヘッダ**: `padding:12px 16px`、アイコン枠 26px（SettingsView 準拠）。
- **store 見出し**: `padding:6px 8px`、アイコン枠 20px、chevron 12px。
- **ファイル行**: `padding:7px 10px 7px 12px`・`gap:9px`・`radius:8px`、ファイル名 12px（`JetBrains Mono`）、サイズ 10.5px。
- **ビューヘッダ**: `padding:10px 16px`。[編集]/[保存]/[取消] は `padding:5px 11〜13px`・`radius:7px`・11.5px。
- **本文**: Markdown 13px/1.7、textarea 同サイズ。ツリー領域 `max-height:46%`。
- **角丸**: ペイン枠は host 側、行/アイコン枠 8px 前後、ボタン 7px、ダイアログ 14px、状態円/spinner 50%。
- **タイポ**: 本文 `Noto Sans JP`。ファイル名・サイズ・件数は `JetBrains Mono`。

---

## データ形状（実装側の確定仕様）

```ts
type MemoryStoreView = {
  kind: 'preferences' | 'agent-context';
  label: string;              // 「個人設定」/「このエージェント（○○）」
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

- ペインは **表示・編集専用**。読み書きは host 側 REST（Anthropic Memory API）が担う。
- Header 🧠 での開閉、右ペイン優先（`設定 > メモリ > Artifact`）は実装側で配線する。

---

## 組み込み手順（要約）

1. Header に `<MemoryEntryButton active={paneKind === 'memory'} onClick={toggleMemory} />` を ⚙️ の左隣に差し込む。
2. 右ペインのルータに `memory` を追加し、優先度 `設定 > メモリ > Artifact` で `<MemoryPane … />` を出す。
3. 選択時に `retrieve(view=full)` で `content` + `content_sha256` を取得（それまで `asyncState='loading'`）。
4. 保存は `content_sha256` を載せて PUT。409 なら `asyncState='conflict'` にしてバナー表示、「再読込」で再取得。
5. Markdown レンダラ / `ConfirmDialog` / アイコンは既存の共通部品に差し替え。`--cw-*` が揃っていれば配色調整は不要。

---

## Files

| ファイル | 役割 |
|---|---|
| `memoryStore.ts` | **型 + ヘルパー（本体）**。`MemoryStoreView` / `MemoryFile` / `basename` / `byteLabel` / `resolveSelection` ほか。フレームワーク非依存 |
| `MemoryPane.tsx` | **参照実装**。右ペイン本体（6 状態・ツリー・ビュー/エディタ・削除確認）+ `MemoryEntryButton`。`--cw-*` トークン参照 |
| `prototype/Memory Pane - UX Exploration.html` | スタンドアロン検討版（全状態・Header 入口・kintone 文脈・仕様まとめ） |
| `prototype/memory-pane.jsx` | プロト本体（`MemoryPane` / `MemHeader` / `ChatWithMemory` / `ConfirmDeleteDialog`） |
| `prototype/memory-data.jsx` | プロトの土台（`richColors` / `MemIcons` / ミニ Markdown / サンプル store） |
| `prototype/{design-canvas.jsx, styles.css}` | プロト実行用の土台（design canvas / フォント・keyframes） |
