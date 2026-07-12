# Handoff: メモリ閲覧/編集 UI（Memory Store viewer/editor）— #15 Step 2

Cowork Agent for kintone に、**ユーザーが自分の「メモリ（会話をまたいで蓄積される記憶）」を
ブラウズ・編集できる UI** を実装するための、Claude Code 向けハンドオフ。

このパッケージだけで、会話に居合わせていない開発者が実装に着手できるよう、設計意図・採寸・トークン・
参照実装・触れるプロトタイプを同梱しています。

---

## Overview

**メモリ = Anthropic Managed Agents の Memory Store**。エージェントがセッションを跨いでユーザーの
好み・業務文脈を覚えておくための、テキストファイル群（Markdown）。本 UI が扱う store は **2 つだけ**:

1. **個人設定（`preferences`）** … 全エージェント共通。口調・日付表記・業務用語エイリアスなど。
2. **このエージェント（`agent-context`）** … 現在選択中のエージェント固有の学習・修正記録。

中身は基本 **エージェントが自律的に読み書き**する。この UI はユーザーが **確認し、必要なら手直し（編集/削除）**
するための補助 UI。「開いて確認・微修正して閉じる」もので、過剰にリッチにしない。

### 2 つの配置案（どちらも同梱）

同じ機能を **どこに出すか** で 2 案を用意しています。中身（ツリー / ビューア / エディタ / 6 状態 / データ形状）は共通です。

| 案 | フォルダ | 出る場所 | 入口 |
|---|---|---|---|
| **A. 設定画面 統合（推奨・最新）** | `settings-integration/` | SettingsView の右 detail | 左 nav の per-user「🧠 メモリ」項目 |
| B. Header 独立ペイン | `header-pane/` | Chat Panel の独立した右ペイン | Header の 🧠 IconButton |

> **どちらを実装するかはプロダクト判断**。直近の意思決定は **案 A（設定画面統合）**。
> 案 B は代替として残しています。両案の詳細はそれぞれのフォルダ内 `README.md` を参照。

### スコープ外
versions 履歴 / 復元 / redact（#149）、ファイル新規作成、admin 用共有メモリ（Step 3）、モバイル幅。
**versions 履歴タブは置かない**（将来ここに「履歴」導線が増える余地だけ意識）。

---

## About the Design Files

このバンドルの HTML / JSX / TSX は **HTML で作った設計リファレンス**（見た目と挙動を示すプロトタイプ）であり、
**そのままプロダクションに貼るものではありません**。タスクは **これらの設計を対象コードベースの既存環境
（React + Tailwind + 既存 `--cw-*` トークン + 既存 SettingsView / ArtifactPane / ConfirmDialog / Banner）で
再現すること**です。まだ環境が無い場合はプロジェクトに最適なフレームワークを選び、そこに実装してください。

- **`.ts` / `.tsx`** … フレームワーク非依存の型 + ヘルパー（`memoryStore.ts`）と、React 参照実装。
  既存の共通部品（Markdown / ConfirmDialog / Banner / icons / SettingsView プリミティブ）は import 前提で、
  プロジェクト内の実体に差し替える。
- **`prototype/*.html`** … 触って確認するスタンドアロン版（vanilla React + Babel、インライン style）。
  **配色・寸法・挙動の "正" は各フォルダの TSX / README とし、プロトの inline style をそのまま写経しないこと。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。**新規意匠は無し**
（既存 SettingsView / ArtifactPane / Header の語彙の再構成）。UI は既存ライブラリ/パターンで
ピクセル単位に再現してください。

---

## Screens / Views

### 案 A: SettingsView「メモリ」セクション（`settings-integration/`）

**Name**: 設定 › メモリ
**Purpose**: 自分の 2 store のファイルを一覧し、選んで閲覧・編集・削除する。
**Layout**: 既存 SettingsView（左 nav 192px + 右 detail）。detail は縦割り: 上=2 store ツリー / 区切り線 /
下=選択ファイル詳細。detail 全体が他セクションと同じ `overflow:auto`。

**Components**:
- **nav 項目「メモリ」**: 既存 nav 語彙。`brain` アイコン。count の代わりに「自分」バッジ（per-user 表示）。
  admin 限定でない（「定期実行」と同列）。active 時 `--cw-card` 地 + `--cw-border` 枠。
- **PaneHeading**: title「メモリ」18px/700、sub「エージェントが会話から覚えた内容を確認・編集できます」11.5px/muted。
- **store 見出し（SectionLabel）**: 10.5px/700/大文字、18px アイコン枠（`accent-soft`地・`accent`）、右に「N ファイル」。
- **ファイル行**: `padding:10px 14px`・`gap:11px`。24px file アイコン枠 + basename（`JetBrains Mono` 12px）+
  サイズ（`byteLabel` 10.5px mono）+ hover で 🗑。選択行 = `accent-soft` 地 + 左 `inset 2px 0 0 accent`。
- **空 store プレースホルダ**: dashed カード「まだ記憶がありません。会話を重ねるとエージェントが自動で書き込みます。」
- **選択ファイルカード**: ヘッダ（`card-hi`地）に basename + [編集]。本文は Markdown レンダ（`.md-body`トーン）/ textarea。

### 案 B: Header 独立ペイン（`header-pane/`）

**Name**: メモリ ペイン
**Purpose**: 同上。**Layout**: ArtifactPane / SettingsView と同じ右ペイン枠（basis ~540px）。
上=2 store ツリー（`max-height:46%`）/ 下=ビュー・エディタ。**入口**: Header の 🧠 IconButton（⚙️ と同意匠、開くとハイライト）。
メモリ ON/OFF ピル（次の会話で使うか）とは別物。詳細は `header-pane/README.md`。

---

## Interactions & Behavior

- **ファイル選択**: 行クリックで選択、`view` モードに。選択時に `retrieve(view=full)` で `content` +
  `content_sha256` を取得（取得中は `asyncState='loading'` → スケルトン表示）。
- **編集**: [編集] → textarea 化（等幅不要・素直な text、13px/1.7）。[保存]/[取消]。保存中はボタン内 spinner。
- **保存（楽観ロック）**: `content_sha256` を載せて PUT。**409 なら `asyncState='conflict'`** → 警告バナー
  「このファイルは他で更新されました。最新の内容を再読込します。」+「再読込」ボタン（再 retrieve）。
- **削除**: 行の 🗑 → ConfirmDialog（danger トーン・危険色ボタン + 一文）→ 確定で行が消える。
- **空ファイル**: サイズ 0 は「空」表示、本文は「このファイルはまだ空です。」プレースホルダ。
- **アニメーション**: spinner `0.8s linear`、スケルトン shimmer `1.6s linear`。過剰な演出はしない。
- **レスポンシブ**: デスクトップ幅のみ（モバイルはスコープ外）。

---

## State Management

```ts
selection: { storeKind, fileId } | null   // 選択ファイル
mode: 'view' | 'edit'                       // ビューア/エディタ
asyncState: 'idle'|'loading'|'saving'|'conflict'|'error'
draft: string                               // 編集バッファ
pendingDelete: { storeKind, fileId } | null // 削除確認中
```

- 一覧は store ごとに `MemoryFile[]`。`content` は選択時に遅延取得。
- 保存成功で `mode='view'` に戻し、`sizeBytes` / `updatedAt` / `contentSha256` を更新。
- データ形状・派生ヘルパーの詳細は `memoryStore.ts`（`basename` / `byteLabel` / `relativeTime` /
  `isStoreEmpty` / `isMemoryEmpty` / `resolveSelection` / `totalFileCount`）。

### 状態バリエーション（各プロトに mock あり）
1 未選択 / 2 閲覧（主状態）/ 3 編集中 / 4 空メモリ / 5 競合エラー / 6 ローディング / （削除確認）。

---

## Design Tokens（`--cw-*`, light 既定）

| トークン | 値 | 用途 |
|---|---|---|
| `--cw-bg` | `#faf8f3` | 背景・textarea 地 |
| `--cw-panel` | `rgba(255,255,255,0.88)` | ヘッダ地（blur） |
| `--cw-card` | `#ffffff` | カード・ダイアログ地 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | nav 地・カードヘッダ・スケルトン・hover |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | カード枠 |
| `--cw-border` | `rgba(35,18,0,0.10)` | 区切り・行境界・dashed |
| `--cw-text` | `#231200` | 見出し・本文・ファイル名 |
| `--cw-muted` | `#6b5f4a` | サブテキスト・サイズ |
| `--cw-subtle` | `#a89d85` | 空表示・件数 |
| `--cw-accent` | `#0d9488` | teal。選択・アイコン・保存・spinner・inset バー |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | 選択行地・アイコン枠・ハイライト |
| `--cw-on-accent` | `#ffffff` | accent 塗り上の文字 |
| `--cw-warn` / `--cw-warn-soft` | `#b45309` / `#fef3c7` | 競合バナー |
| danger | `#b91c1c` | 削除確定ボタンのみ |

**採寸**: detail `padding 22/26/32`、nav 幅 192、ファイル行 `padding 10/14 · gap 11`、カード角丸 12・ボタン 7・ダイアログ 14。
**タイポ**: 本文 `Noto Sans JP`；ファイル名/サイズ/件数/メタは `JetBrains Mono`。

---

## Assets

外部アセットは無し。**アイコンはすべて inline SVG**（外部アイコンフォント不可）。プロトの `MemIcons`
（brain / person / spark / file / trash / pencil / refresh / warn / close / chevron）を参照し、
実装ではコードベース既存のアイコンセットに差し替え可。CA ブランドの teal は既存 `--cw-*` を使用。

---

## Files

```
design_handoff_memory/
├── README.md                    ← このファイル（自己完結の実装ガイド）
├── memoryStore.ts               ← 型 + 派生ヘルパー（フレームワーク非依存・両案共通の正）
│
├── settings-integration/        ← 案 A（推奨）: SettingsView セクション
│   ├── README.md                    詳細仕様
│   ├── MemorySection.tsx            参照実装（+ MEMORY_NAV_ITEM nav スニペット）
│   ├── memoryStore.ts               （同上のコピー — import 解決用）
│   └── prototype/
│       ├── Memory Settings - UX Exploration.html   ← ブラウザで開く
│       ├── memory-section.jsx / memory-data.jsx
│       └── design-canvas.jsx / styles.css
│
└── header-pane/                 ← 案 B: Header 独立右ペイン
    ├── README.md
    ├── MemoryPane.tsx               参照実装（+ MemoryEntryButton）
    ├── memoryStore.ts
    └── prototype/
        ├── Memory Pane - UX Exploration.html       ← ブラウザで開く
        ├── memory-pane.jsx / memory-data.jsx
        └── design-canvas.jsx / styles.css
```

**着手手順**: ①採用する案のフォルダの `README.md` を読む → ②`prototype/*.html` をブラウザで開いて全状態を触る
→ ③`memoryStore.ts` の型を実装に取り込む → ④`MemorySection.tsx` / `MemoryPane.tsx` を既存プリミティブ・
共通部品に読み替えて再現（`--cw-*` が揃っていれば配色調整不要）→ ⑤host 側 REST（Anthropic Memory API）に結線。
