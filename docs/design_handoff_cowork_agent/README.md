# Handoff: Cowork Agent for kintone — Chat Side Panel

## Overview

**Cowork Agent for kintone** は、kintone のレコード一覧画面のサイドパネルに常駐する
AI コワーカーエージェントのチャット UI。Claude Managed Agents API をバックエンドとし、
自然言語で kintone レコードの検索・集計・作成・更新・削除を実行する。

本ハンドオフは MVP (フェーズ1) の **チャット UI コンポーネント本体** の仕様である。
対象機能: F-01 チャット UI / F-07 HITL 承認 / F-08 非同期ジョブ進捗 / F-09 セッション継続 /
シナリオ US-01 (自然言語での検索・集計)。

> **関連ドキュメント** (齟齬がある場合はそちらを優先):
> - [`docs/product-requirements.md`](../product-requirements.md) — プロダクト要求定義
> - [`docs/functional-design.md`](../functional-design.md) — 機能設計 (アーキテクチャ、データモデル、Custom Tool の扱い、命名規則)
> - [`docs/architecture.md`](../architecture.md) — 技術スタック、開発プロセス、制約
> - [`docs/repository-structure.md`](../repository-structure.md) — リポジトリ構造

---

## About the Design Files

同梱の `reference/` 配下の HTML/JSX は、**意図する見た目と挙動を示すためのデザインリファレンス
(プロトタイプ)** であり、そのまま本番コードとしてコピーするものではない。

タスクは「このデザインを **kintone プラグイン (JavaScript カスタマイズ) の実行環境で再現する** こと」。
kintone プラグイン側のビルド設定・使用ライブラリ・既存パターンに沿って実装し直す。
プロトタイプは React + Babel standalone で書かれており、本番実装も `docs/architecture.md` に従い
**TypeScript + React 18 + Vite + Tailwind CSS** で構築する (プロジェクト全体の技術スタック統一のため)。

## Fidelity

**High-fidelity (hifi)**。色・タイポ・余白・アイコン・インタラクションはすべて最終形。
ピクセル忠実度を保って再現すること。下記の Design Tokens に挙げた値は厳密値である。

---

## Target Variant

プロトタイプには当初 3 variant (minimal / rich / terminal) があったが、**Rich variant のみ** を
採用して進める。本ドキュメントは Rich variant についてのみ記述する。

参照ファイル: `reference/variant-rich.jsx`

---

## Screens / Views

チャットパネルは **固定幅 380px (推奨)** のサイドパネル内で縦方向にレイアウトされる。
構造は上→下の 3 ブロック。

### 1. Header (固定 60px 前後)

| 要素 | 詳細 |
|---|---|
| Avatar | 34×34px, `border-radius: 10px`, 背景はアクセント色からの135°リニアグラデーション (`accent` → `accent+40 (lighten)`), 中央に 18×18 の星型アイコン (stroke 1.8), 白または濃茶のアイコン色 (背景の明度で分岐), `box-shadow: 0 4px 14px accent40` |
| Status dot | Avatar 右下に 11×11px の緑 (`#22c55e`) 丸, パネル背景色で 2px ボーダー |
| Agent name | "Aoi" (14px / weight 600, `color: text`) |
| AGENT badge | name の右, 10px / weight 500, アクセント色文字, `accent+1a (10% alpha)` 背景, 4px radius, padding 1/6px |
| Status line | 11px / `muted` 色, 9×9 時計アイコン + "作業中 · kintone接続" |
| Icon buttons | タスク / 設定 / 閉じる。30×30, 透明背景, `muted` 色, 8px radius, アイコン 12-14px stroke 1.5-1.6 |
| 背景 | `c.panel` (半透明白 / 黒), `backdrop-filter: blur(12px)`, 下に 1px ボーダー |

### 2. Chat scroll area (flex: 1, 縦スクロール)

`padding: 18px 16px` (airy密度のとき。compact=14px, comfortable=18px), `gap: 18px` (同上),
メッセージは以下のカードタイプの縦積み:

#### 2a. Greeting (初回のみ)
- タイトル "こんにちは。今日はどんな作業をお手伝いしましょうか？" 16px / weight 600 / letter-spacing -0.3 / line-height 1.4
- サブ文言 "アプリ検索、集計、レコード操作まで。思いついたことを話しかけてください。" 12px / `muted`
- Suggestion chips 3つ。左寄せ, 12.5px, 背景 `c.card`, 1px border `c.cardBorder`, radius 10px, padding 10/12, 先頭に 20×20 矢印アイコン (`accentSoft` 背景)

#### 2b. User message
- `align-self: flex-end`, max-width 85%
- 背景 `c.user` (accent+14 alpha = 8%), border 1px `c.userBorder` (accent+40 alpha = 25%)
- border-radius `16px 16px 4px 16px` (右下角だけ小さく=発話の尻尾)
- padding 10/14, 13px, line-height 1.5

#### 2c. Agent bubble / thinking
- 左寄せ, 8px gap で 22×22 アバター円 (Headerと同じグラデ) + 本文
- Thinking: 12px / `muted` + アクセント色の "..." 3 ドットアニメ

#### 2d. Tool call card
- 背景 `c.cardHi` (accent を 6% 乗せた半透明), border `c.cardBorder`
- radius 10, padding 8/11, 左に 20×20 チェックアイコン (`c.okSoft` 背景, `c.ok` 色)
- モノスペース小文字のツール名 (10.5px, accent, weight 600) + ラベル (12px weight 500)
- 11px `muted` で detail, 続けて items を `accentSoft` 背景の小ピルで表示

#### 2e. Plan card (HITL)
- 最上位コンテナ: `c.card` 背景, radius 14, border 1px
- **Destructive時**: border `c.warn + 55`, `box-shadow: 0 0 0 4px c.warn15, 0 4px 20px c.warn20` (グロー)
- ヘッダー帯: padding 10/14, 背景 `warnSoft` (destructive) / `accentSoft` (read-only), 下1px border
  - 14×14 アイコン (三角警告 or リスト), 12.5px weight 600 タイトル, 右端に "要承認" / "読取" ラベル
- 本体: padding 14, `<ol>` でステップ列挙
  - 各ステップ: 22×22 番号チップ (モノスペース 10px, `accentSoft` 背景, `accent` 文字) + `op` (9.5px upper, letter-spacing 0.6, `muted`) + `text` (12.5px)
- 見積行: 上に 1px dashed border, 時計アイコン + 11px `muted` テキスト
- **Destructive時** のみ 3 ボタン横並び (gap 6, marginTop 12):
  - **承認して実行** — flex:1, padding 9/12, 12.5px weight 600, 背景 `c.warn`, 白文字, radius 8
  - **修正** / **キャンセル** — 背景 transparent, 1px `c.border`, `muted` 文字, radius 8

#### 2f. Progress card
- `c.card` 背景, 1px border, radius 12, padding 13
- 上段: 22×22 スピナー (2px `accentSoft` リング, トップだけ accent, 0.9s 回転) + タイトル(12.5 w600) + サブ(10.5 muted) + 大きい % (16px w700, accent, tabular-nums)
- プログレスバー: 高さ 6, radius 3, 背景 `accentSoft`, 内側バーは `linear-gradient(90deg, accent, accent+40)` + シマーアニメ
- Substeps: 縦並び 5px gap, 13×13 円 (済: `c.ok` 塗り + 白チェック / 未: 1.5px border), 11.5px テキスト

#### 2g. Result card
- `c.card`, 1px border, radius 14, `box-shadow: 0 4px 20px rgba(0,0,0,0.04)`
- ヘッダー: padding 12/14, `linear-gradient(135deg, accentSoft, transparent)` 背景, 1px border 下
  - 13.5px w600 letter-spacing -0.2 タイトル, 11px muted サブ
- Rows: 各 padding 7/0, 下1px border (最後以外)
  - 上段 flex: 20×20 頭文字アバター (HSL 色を index*62°で回す), 12.5px w500 名前, 10.5 subtle 件数, 右端 12.5 w600 tabular-nums 金額 (万円区切り + 10px "万")
  - 下段 `margin-left: 28` ミニバー (高さ3, gradient)
- フッター: `c.cardHi` 背景, followup ピルボタン 5/11, radius 999, 矢印アイコン+11pxテキスト

### 3. Composer (下部固定)

- padding 10/14/14, 上 1px border, 背景 `c.panel`, blur 12
- 入力ラッパー: flex, 1px border, radius 14, padding 8/8/8/14, 背景 `c.card`,
  `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px accentSoft inset`
- `<input>`: placeholder "このアプリについて聞く / レコードを操作..."
- 右に 添付アイコンボタン (30×30) + **送信ボタン** 32×32 radius 10, accent グラデ背景, 白矢印, `box-shadow: 0 2px 8px accent55`
- 下に 10px subtle ヒント行: `⌘K 呼び出し · Claude Managed Agents`

---

## Interactions & Behavior

### シナリオ US-01 の自動再生 (参照)
`reference/data.jsx` の `SCENARIO.script` が初期メッセージ `user → thinking → tool → tool → agent → plan(read-only) → progress → result` の順で並んでいる。プロトタイプでは 600ms スタートで、kind に応じたディレイ (tool 650 / plan 950 / progress 1200 / 他 800ms) で追加表示。本番では実際のエージェントイベント (Managed Agents Session の `GET /v1/sessions/{id}/events` ポーリングで取得) に差し替える。

### HITL 承認フロー (F-07)
破壊的操作 (update_records / delete_records) は必ず:
1. Agent が `plan` (destructive=true) カードを発話
2. UI は影響範囲 (対象アプリ / フィールド / レコード件数 / 可逆性) を明示
3. ユーザーが **承認して実行** / **修正** / **キャンセル** のどれかを押すまで Agent は破壊的操作を実行しない
4. 承認後は `progress` カードに遷移

> 実装上、Agent は `user.message` で明示的に「実行して」と返信を受け取ってから破壊的操作を実行する。プラグインは承認ボタン押下で「承認」を表す `user.message` を Managed Agents に POST する。

### 非同期ジョブ進捗 (F-08)
- 長時間処理は Progress カードで表示
- ユーザーがチャットパネルを閉じても、ジョブは継続
- 再度開いたときに復元表示する。状態はサーバー (Managed Agents Session) が持つ

### セッション継続 (F-09)
- ユーザー単位で単一セッションを保持 (アプリ横断)
- `app.record.index.show` で毎回、metadata (`source=cowork-agent-for-kintone`, `kintoneUserCode`, `kintoneDomain`) で Session をクライアント側フィルタして復元
- 会話履歴の取得は `GET /v1/sessions/{id}/events?order=asc&limit=100&page=<cursor>` で行う (kintone.proxy は SSE 非対応のためポーリング方式)
- プラグイン側には Session ID を永続化しない (metadata から都度解決)

### アニメーション
- Thinking dots: 3 つのドットが順次 fade (0.4s 間隔)
- Progress spinner: 0.9s linear infinite rotate
- Progress bar shimmer: バー内側に `::before` で白い光スイープ (2s linear infinite)
- 新着メッセージ: `opacity 0 → 1`, `translateY 4px → 0`, 200ms (参照CSS `.msg-in`)

### ホバー / フォーカス状態
- Suggestion chip, followup pill, icon button: hover で border を accent に, 背景を `accentSoft` に
- 入力: focus 時に ラッパー border を `accent`, inset shadow を `accent+33` に強化

---

## State Management

### 必要なステート (概念)
```
session: {
  sessionId: string,                 // Managed Agents のセッション ID
  userId: string,                    // kintone ログインユーザー
  messages: Message[],               // 会話履歴
  runningJob: JobProgress | null,    // アクティブな非同期ジョブ
  pendingApproval: PlanCard | null,  // ユーザー承認待ち
}

Message: {
  kind: 'user' | 'agent' | 'thinking' | 'tool' | 'plan' | 'progress' | 'result',
  ... kind 依存のフィールド (data.jsx 参照)
}
```

### イベント
- **ユーザー送信** → `user` メッセージを UI に即追加 → `POST /v1/sessions/{id}/events` (`user.message`) → **ポーリング** (`GET /v1/sessions/{id}/events?order=asc&page=<cursor>`) で `agent.thinking` / `agent.tool_use` / `agent.message` / `agent.custom_tool_result` 等のイベントを差分取得 → UI 側で `tool` / `agent` / `plan` / `progress` / `result` カードに変換
- **承認ボタン押下** → `POST /v1/sessions/{id}/events` に「承認します」という `user.message` を POST → Agent が破壊的操作スクリプトを実行 → `progress` カードに遷移
- **パネル開閉** → localStorage に `isOpen` のみ保存 (認証情報や会話データは保存禁止)。`app.record.index.show` で復元

### ポーリング戦略
- 初期: 2 秒間隔
- バックオフ: `session.status_idle` かつ新規イベントなしで 2s → 3s → 5s → 10s と段階的に延長
- タスク完了 (`session.status_idle` + `stop_reason.type === "end_turn"`) でポーリング停止
- パネルを閉じたらポーリング停止 (再表示時に最新状態を再取得)

### データ取得
- **kintone 側**: Managed Agents Environment にプリインストールされた Python ヘルパーライブラリ (`cowork-agent-kintone`) が、Vault から注入された環境変数 (`KINTONE_LOGIN` / `KINTONE_PASSWORD` / `KINTONE_DOMAIN`) を用いて Basic 認証で REST API を呼び出す。Agent は `agent_toolset_20260401` の `bash` + `write` でスクリプトを組み立てて実行する。フロントエンドは直接 kintone API を叩かない
- **Anthropic 側**: プラグインは **kintone Proxy 設定** に登録された Anthropic API Key を `kintone.plugin.app.proxy` 経由で利用する。API Key はブラウザ JS から直接参照不可 (`kintone.plugin.app.getConfig` では取得しない)

---

## Design Tokens

### アクセント色 (確定)
- **`#0d9488`** (Teal) — Rich variant のプライマリアクセント。全 CTA / リンク / プログレスバー / グラデに使用

### Light theme (既定)
| トークン | 値 | 用途 |
|---|---|---|
| `bg` | `#faf8f3` | パネル背景 (ウォームオフホワイト) |
| `panel` | `rgba(255,255,255,0.85)` | Header / Composer の半透明レイヤー |
| `border` | `rgba(35,18,0,0.10)` | 一般 1px ボーダー |
| `text` | `#231200` | 主要テキスト (濃茶) |
| `muted` | `#6b5f4a` | 補助テキスト |
| `subtle` | `#a89d85` | さらに弱い (ヒント、メタ) |
| `card` | `#ffffff` | カード背景 |
| `cardBorder` | `rgba(35,18,0,0.08)` | カードの薄ボーダー |
| `cardHi` | `rgba(255,191,0,0.06)` | ホバー / tool カード背景 (薄アンバー) |
| `accent` | `#0d9488` | プライマリアクセント |
| `accentSoft` | `#0d94881a` | accent 10% alpha — バッジ / プログレスレール |
| `user` | `#0d948814` | user バブル背景 |
| `userBorder` | `#0d948840` | user バブル ボーダー |
| `warn` | `#b45309` | 破壊的操作アクセント (アンバー濃) |
| `warnSoft` | `#fef3c7` | 破壊的 Plan ヘッダー帯 |
| `ok` | `#8a6400` | 完了チェック (kintone アンバーの濃色) |
| `okSoft` | `#fff4c9` | tool call アイコン背景 |

### Dark theme
| トークン | 値 |
|---|---|
| `bg` | `#1a160f` |
| `panel` | `rgba(34,28,19,0.75)` |
| `border` | `rgba(255,191,0,0.12)` |
| `text` | `#ede4d0` |
| `muted` | `#a89d85` |
| `subtle` | `#6b6353` |
| `card` | `rgba(42,34,23,0.85)` |
| `cardBorder` | `rgba(255,191,0,0.12)` |
| `cardHi` | `rgba(255,191,0,0.05)` |
| `warn` | `#f59e0b` |
| `warnSoft` | `#f59e0b22` |
| `ok` | `#ffbf00` |
| `okSoft` | `#ffbf0022` |

### 注記: 色選定の根拠
- ベース背景 `#faf8f3` / テキスト `#231200` はホスト kintone のダークチョコヘッダー + ウォームオフホワイトの配色に合わせている
- 警告・OK 系のオレンジ/アンバー系は kintone ブランドのアンバー `#ffbf00` 周辺でまとめ、プライマリアクセントのティールが視覚的に主張するようにコントラストを設計した

### タイポグラフィ
- ベースフォント: `-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif` (継承想定)
- モノスペース: `"JetBrains Mono", "SF Mono", Consolas, monospace` — tool 名 / 番号チップ / kbd のみ
- サイズスケール (px): `9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 16`
- 行高: テキスト 1.5-1.6, 見出し 1.25-1.4
- weight: 500 (通常), 600 (強調), 700 (数字ハイライト)

### Spacing
- メッセージ間 gap: `compact 10 / comfortable 14 / airy 18` (density tweak)
- カード内 padding: 8-14px
- セクション内の縦方向 rhythm は 4px グリッド

### Radius
- 小: 4, 6, 8 (badge / button / icon)
- 中: 10, 12 (card / input)
- 大: 14 (primary card, plan, result, composer wrapper)
- バブル: `16/16/4/16` (user), `16/16/16/4` (agent — プロトタイプでは未使用)
- 丸: 999 (pill), 50% (avatar / status dot)

### Shadow
- カード: `0 2px 12px rgba(0,0,0,0.04)` (通常), `0 4px 20px rgba(0,0,0,0.04)` (result)
- Destructive plan: `0 0 0 4px #b4530915, 0 4px 20px #b4530920`
- Avatar: `0 4px 14px <accent>40`
- 送信ボタン: `0 2px 8px <accent>55`
- Composer inset: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px <accentSoft> inset`

### Density levels (Tweak で切替)
| | Compact | Comfortable | Airy |
|---|---|---|---|
| 縦 gap | 10 | 14 | 18 |
| scroll padding top | 14 | 18 | 22 |

---

## Assets

- **アイコン**: すべてインライン SVG (外部ライブラリ依存なし)。stroke ベース, `stroke-width: 1.5-1.8`, `stroke-linecap: round`, `stroke-linejoin: round`
- **フォント**: システムフォント + 日本語ゴシック。必要に応じて JetBrains Mono を CDN で。kintone プラグイン配布時はフォントの同梱は避け、システムに任せる
- **画像**: なし
- **ロゴ**: Header のアバターのみ (星/コンパス型 SVG)

---

## Implementation Notes (kintone プラグイン向け)

### プラグイン最終出力構造 (cli-kintone plugin pack 後)
```
plugin.zip
├── manifest.json
├── html/
│   └── config.html              # 管理者設定画面 (Anthropic API Key のみ)
├── js/
│   ├── desktop.js               # Vite でバンドル済み (React + 依存)。app.record.index.show で side panel を挿入
│   └── config.js                # 設定画面ロジック (バンドル済み)
├── css/
│   ├── desktop.css              # Tailwind ビルド出力 (スコープ済み)
│   └── config.css
└── image/
    └── icon.png
```

ソース構造はモノレポ `packages/plugin/src/` 配下。詳細は `docs/repository-structure.md` §3 を参照。

### 挿入フック
```js
kintone.events.on('app.record.index.show', (event) => {
  mountChatPanel(event.appId);
});
```

### 推奨実装方針
- **フレームワーク**: `docs/architecture.md` に従い **TypeScript + React 18 + Vite + Tailwind CSS**。kintone プラグイン用に Vite でバンドルし、`cli-kintone plugin pack` で zip 化
- **スタイル**: デザイントークンを Tailwind の `theme.extend` に登録 + CSS カスタムプロパティ (`--cw-accent: #0d9488` 等) でランタイム切替可能にし、light/dark は `[data-theme]` で切替
- **DOM挿入**: `document.createElement` で `#cw-agent-root` を作り、kintone のレコード一覧 DOM に append (`kintone.app.getHeaderMenuSpaceElement()` or 右端固定 div)。React は `createRoot` でこの要素にマウント
- **スコープ**: プラグインのルート要素に `.cowork-agent-root` クラスを付与し、Tailwind の CSS が kintone 本体 UI に漏れないようスコープ
- **Z-index**: kintone 既存 UI を邪魔しない 100 前後。モーダルは 1000+
- **Scroll lock**: パネル内スクロールが親に bubble しないよう `overscroll-behavior: contain`
- **バンドルサイズ**: React を採用するが、本番ビルド時は Vite の Tree Shaking と動的 import で最適化。プラグイン zip 30MB 制限に対して十分に収まる想定

### Managed Agents 連携
- **kintone 操作は Environment 側で完結** (真のバックグラウンド実行を実現するため)
- Agent の tools は `agent_toolset_20260401` (`bash` + `write` + `read`) のみを使用。「Custom Tool」 (クライアント側実行) は MVP では使用しない
- Environment にプリインストールされる Python ヘルパーライブラリ `cowork-agent-kintone` が以下のメソッドを提供:
  - `Client()` (環境変数から認証情報自動取得)
  - `get_apps` / `get_app_schema` / `get_form_layout`
  - `get_records` (カーソル対応、10,000 件超は自動継続)
  - `add_records` / `update_records` / `delete_records` (100 件超は自動分割)
  - `bulk_request` (最大 20 操作のアトミック実行)
- Vault は kintone ユーザー単位で作成し、`KINTONE_LOGIN` / `KINTONE_PASSWORD` / `KINTONE_DOMAIN` を保管 → Session 作成時に Environment の環境変数として自動注入される
- Environment の outbound 許可 (`allowed_hosts`): `<kintoneDomain>` を動的に設定 (`*.cybozu.com` / `*.kintone.com` / カスタムドメイン)

### 管理者プラグイン設定画面 (別スクリーン)
- **Anthropic API Key のみ** を入力 (kintone Proxy 設定に保存され、ブラウザ JS から参照不可)
- プラグイン設定領域 (`kintone.plugin.app.setConfig`) には一切の永続データを保存しない
- Agent / Environment / Vault / Session は Managed Agents の metadata で動的参照

### ユーザー初回バインディングダイアログ (チャット起動時、UI 内モーダル)
- **各 kintone ユーザー自身** が自分の kintone ログイン ID / パスワードを入力
- 入力情報は Managed Agents Vault に直接 push し、Environment を同時に自動作成
- プラグイン設定には保存しない (管理者設定画面ではなく、ユーザー各自の初回利用時に表示)

### API Key 未設定時の UX
- チャットパネルは「管理者が Anthropic API Key を設定してください」という旨のエラーメッセージを表示 (PRD 受け入れ条件)

---

## Files

### `reference/` に同梱
| ファイル | 役割 |
|---|---|
| `Cowork Agent Chat Panel.html` | 全体プロトタイプ (design canvas + 3 アートボード) |
| `variant-rich.jsx` | **メイン参照**。Rich variant の全コンポーネント実装 |
| `data.jsx` | シナリオ (US-01 + HITL) のダミーデータ。メッセージ種別と形状のスキーマも兼ねる |
| `design-canvas.jsx` | プロトタイプを並べるキャンバス (本番実装には不要) |
| `styles.css` | 共有アニメーション (.msg-in, .dot, .shimmer 等)。本番 CSS に移植する |

### 本番で新規に必要 (詳細は `docs/repository-structure.md` 参照)

モノレポ `packages/plugin/` 配下:
- `manifest.json` (プラグイン定義、Proxy 設定要件含む)
- `src/desktop/` (チャット UI: ChatPanel / MessageList / ApprovalCard / ProgressCard / ResultCard / CredentialDialog 等)
- `src/config/` (管理者設定画面: Anthropic API Key 入力)
- `src/core/managed-agents/` (HTTP クライアント、リソース解決、ポーリング)
- `src/core/kintone/` (kintone API ラッパ、ユーザー情報取得)
- `src/core/bootstrap/` (Default Agent / Environment / Vault の metadata 動的解決・作成)
- `src/store/` (Zustand ストア)

別リポジトリ扱いとなる Python ヘルパーライブラリは `packages/kintone-helper/` として同リポジトリに含めるが、PyPI へ独立公開される

---

## 受け入れ条件のリマインド (PRD 7.)

- [ ] レコード一覧画面のサイドパネルにチャット UI が表示される
- [ ] チャットで依頼した検索・集計処理の結果が表示される (`result` カード)
- [ ] 破壊的操作は `plan(destructive=true)` を提示し、明示的な承認後のみ実行される
- [ ] バックグラウンド実行中のタスクが `progress` カードで進捗確認できる
- [ ] チャット UI を閉じて再度開いても同一セッションの会話履歴が継続する (metadata から Session 再解決)
- [ ] プラグイン設定画面で Anthropic API Key を設定できる (Proxy 設定経由)
- [ ] ユーザー初回バインディングダイアログで Vault 用の kintone ログイン情報 (ID / パスワード) を登録できる
- [ ] Environment 内のヘルパーライブラリから Basic 認証経由で kintone REST API にアクセスできる
- [ ] Anthropic API Key 未設定時に適切なエラーメッセージが表示される
