# Artifact 生成基盤 (Step 1: Foundation) — 要求定義

> 関連 Issue: [#14 アーティファクト生成基盤 (Claude Desktop 風 artifact)](https://github.com/sugimomoto/CoworkAgentForKintone/issues/14)

## 背景

Phase 1b-5 (UX 強化) で MVP 水準の UX が揃い、Issue #9 (kintone カスタマイズ支援) / #10 (ドキュメント生成) などの「**生成物を返すユースケース**」を本格化させる準備が整った。
これらのユースケースは共通して、

- LLM が生成した「**再利用可能な成果物 (コード / 図 / レポート / データ)**」を
- **会話ストリームと分離した専用ペイン** で
- 表示 / 編集 / コピー / ダウンロード / (将来は kintone への適用) できる

ことを必要とする。Claude Desktop の "artifact" に相当する仕組みである。
**先に基盤として作っておくと #9 / #10 の UI 部分が大半カバーされる**ので、本フェーズで横断基盤として整備する。

本フェーズは Issue #14 の **Step 1 (Foundation)** 部分のみを対象とし、Step 2 (Visual: mermaid / svg / iframe)、Step 3 (kintone-customize-js 連携)、Step 4 (Polish) は別フェーズに切り出す。

## ねらい

- Anthropic Managed Agents の **Custom Tool** 機構を使って、Agent が任意のタイミングで「成果物を作った / 更新した」と宣言できるようにする
- 宣言された成果物 (artifact) を **chatStore に蓄積** し、ChatPanel の右側 (もしくはオーバーレイ) で表示する
- 会話ストリームには「📄 アーティファクト作成: <title> [開く]」というタイル状の参照だけを残し、**本文は別ペイン**で見せる
- ページリロード時、events stream から replay することで artifact を **同じ session で復元** できる (localStorage 不使用 = ステートレス原則維持)

## スコープ全体図

| カテゴリ | 概要 |
|---|---|
| 1. Custom Tool 定義 | Agent 側に `create_artifact` を登録し、Anthropic Managed Agents 経由で呼び出せるようにする |
| 2. イベント処理 | `agent.custom_tool_use` を解釈して chatStore.artifacts へ反映、`user.custom_tool_result` を返却 |
| 3. データモデル | `Artifact` 型 / `chatStore.artifacts: Map<id, Artifact>` |
| 4. レンダリング | `markdown` / `code` / `json` / `react` の 4 kind に対応。`react` は iframe sandbox 内で React + Babel standalone を動かす |
| 5. UI | ChatPanel に Artifact ペイン、ToolCardMessage に「アーティファクト作成」タイル、開閉操作 |
| 6. 永続化 / 復元 | events replay で session 単位に artifact を再構築 |
| 7. システムプロンプト | 「成果物は create_artifact ツールを使う」を明記 → promptVersion bump |

優先度: **P1 = 本フェーズ必須**、**P2 = 余力で着手**、**P3 = 別フェーズ送り**。
工数: S = 半日 / M = 1〜2 日 / L = 数日。

---

## 機能要件

### F1. Custom Tool `create_artifact` の定義と配線

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F1-1 | Agent 設定 (toolset) に `create_artifact` Custom Tool を追加 (input_schema は Issue #14 に準拠 + `kind` enum に `react` を追加) | P1 | S |
| F1-2 | Worker 側で Custom Tool を Agent 設定に含める (Managed Agents の `tools` 配列) | P1 | S |
| F1-3 | システムプロンプトに「再利用可能な成果物 (コード / 図 / レポート / データ) を返すときは `create_artifact` ツールを使うこと」「同じ id を渡せば更新扱いになること」を明記 → promptVersion bump | P1 | S |

**受入条件**
- Agent が Markdown レポート / コード片を返す指示を受けたとき、`agent.custom_tool_use` イベントが発火する (Worker のログで観測可能)

### F2. Plugin 側のイベント処理

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F2-1 | `useEventPoller` で `agent.custom_tool_use` (tool_name === `create_artifact`) を検出し、`chatStore.upsertArtifact(input)` を呼ぶ | P1 | M |
| F2-2 | 即座に `user.custom_tool_result` を Worker 経由で送り返し (status: `ok`)、Agent ターンを継続させる | P1 | M |
| F2-3 | 同じ `id` で再度呼ばれた場合は **更新扱い** (Map.set で上書き) | P1 | S |
| F2-4 | events replay 時 (履歴セッション切替 / ページリロード) も同じハンドラ経路で `artifacts` を再構築 | P1 | S |

**受入条件**
- Agent が `create_artifact` を呼ぶ → 1〜2 秒以内に Artifact ペインに表示される
- ページリロードしても artifacts が消えない (events からの復元)

### F3. データモデル / chatStore 拡張

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F3-1 | `Artifact` 型を定義: `{ id, kind, title, language?, content, summary?, createdAt, updatedAt, version }` | P1 | S |
| F3-2 | `chatStore.artifacts: Map<string, Artifact>` を追加 (session スコープ) | P1 | S |
| F3-3 | `upsertArtifact / removeArtifact / clearArtifacts` のメソッド | P1 | S |
| F3-4 | session 切替時 / 新規セッション開始時に `clearArtifacts` | P1 | S |

**受入条件**
- 既存テスト (chatStore 周辺) を割らない
- artifact の追加 / 更新 / 取得が unit test で保証される

### F4. レンダリング (Step 1 範囲のみ)

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F4-1 | `markdown` kind: 既存の markdown-to-jsx を流用 | P1 | S |
| F4-2 | `code` kind: シンタックスハイライト無しの `<pre><code>` で OK (shiki 等は Step 2 候補)。`language` はラベル表示のみ | P1 | S |
| F4-3 | `json` kind: `JSON.stringify(parse, null, 2)` 整形して `<pre>` 表示。parse 失敗時は raw 表示 | P1 | S |
| F4-4 | `react` kind: **iframe sandbox** (`sandbox="allow-scripts"`、`allow-same-origin` を**付けない**) 内で React + ReactDOM + Babel standalone を CDN (esm.sh) からロードし、Agent が出力した JSX/TSX 文字列を Babel で transpile → render する。チャート用に Recharts も同 iframe 内に同梱ロードする | P1 | M |
| F4-5 | `react` kind 専用の **エラーハンドリング**: transpile エラー / render エラー / runtime エラーを iframe 内で捕捉 → `postMessage` で親に通知 → Artifact ペインに「実行エラー」表示 + エラー本文を折り畳み | P1 | S |
| F4-6 | 未対応 kind (mermaid / svg / html / kintone-customize-js / csv) は **「Step 2 以降で対応予定」のプレースホルダ** (raw content + 注意書き) を出す | P1 | S |

**非対象**: shiki / mermaid / DOMPurify / 親バンドル側での React コード実行 (react-live 等) は本フェーズでは入れない。`html` kind の iframe 対応は Step 2 で別途。

### F5. UI 構成

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F5-1 | ChatPanel に **右側 Artifact ペイン** を追加 (パネル幅が広い時は横並び 2 ペイン、狭い時はオーバーレイ) | P1 | M |
| F5-2 | Artifact ペインのヘッダ: タイトル / kind バッジ / 閉じるボタン | P1 | S |
| F5-3 | Artifact ペインのフッタ: **コピー** / **ダウンロード** ボタン (拡張子は kind から決定: md / json / txt) | P1 | S |
| F5-4 | ToolCardMessage で `create_artifact` のときは **専用タイル**「📄 アーティファクト作成: <title> [開く]」を表示。クリックで Artifact ペインを開きそのアーティファクトをアクティブにする | P1 | M |
| F5-5 | 複数 artifact が存在する場合のセレクタ (左カラム or タブ or ドロップダウン)。簡易にドロップダウンで切替で OK | P1 | S |
| F5-6 | パネル幅の判定とレスポンシブ挙動 (ブレークポイント: 1024px 程度) | P2 | S |

**受入条件**
- artifact が 1 個以上ある状態でペインを開ける / 閉じられる
- ToolCardMessage のタイルクリックで該当 artifact が開く
- 複数 artifact がある場合に切り替えできる

### F6. アクション (Step 1 範囲)

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F6-1 | 📋 **コピー** (全 kind) — Clipboard API で content をコピー | P1 | S |
| F6-2 | ⬇ **ダウンロード** (全 kind) — Blob + `<a download>` で保存。拡張子は kind に応じて決定 | P1 | S |
| F6-3 | ✏ **編集** / 🚀 **kintone 適用** / ▶ **プレビュー** | — | (Step 2 以降) |

**受入条件**
- 各 kind でコピー / ダウンロードがブラウザ操作として成功する

### F7. システムプロンプト更新

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F7-1 | プロンプトに「`create_artifact` の使い方 / id 採番方針 / 同じ id で更新扱い / `react` kind での前提 (利用可能なグローバル: `React`, `ReactDOM`, `Recharts`。default export として関数コンポーネントを `export default` する。外部 import 禁止)」を明記 | P1 | S |
| F7-2 | `promptVersion` を bump し、以降の新セッションで反映 | P1 | S |

---

## 非対象 (本フェーズではやらない)

- `mermaid` / `svg` / `html` (iframe sandbox) のレンダリング — Step 2
- artifact 編集 → Agent への再依頼フロー — Step 2
- `kintone-customize-js` の kintone への適用ボタン — Step 3 (Issue #9 と統合)
- shiki / prism によるシンタックスハイライト — Step 2
- artifact の **localStorage 永続化** — ステートレス原則を維持。events からの replay 復元のみ
- artifact 一覧の専用ビュー (HistoryView 等への露出) — 別フェーズ
- モバイル対応 (画面幅が狭い場合は最小限の動作確認のみ)

---

## 受け入れ条件 (フェーズ全体)

P1 項目すべての受入条件を満たすこと。具体的には:

- [ ] Agent に「Markdown でレポートを作って」と依頼すると、`create_artifact` が呼ばれ Artifact ペインに表示される (F1, F2, F4-1, F5-1)
- [ ] Agent に「kintone カスタマイズ JS を書いて」と依頼すると、`code` kind の artifact が生成され `<pre>` で表示される (F4-2)
- [ ] Agent に「先月の売上を棒グラフで」と依頼すると、`react` kind の artifact が生成され、iframe 内で Recharts のチャートが描画される (F4-4)
- [ ] `react` kind で構文エラーがあった場合、Artifact ペインにエラー本文が表示される (アプリ全体は落ちない) (F4-5)
- [ ] ToolCardMessage に「📄 アーティファクト作成」タイルが残り、クリックで該当 artifact を開ける (F5-4)
- [ ] 同じ id で 2 回呼ばれた場合、artifact が **更新** されることが unit test で保証される (F2-3, F3-3)
- [ ] ページリロード後も同じ session を開けば artifact ペインに artifact が復元されている (F2-4)
- [ ] コピー / ダウンロードが markdown / code / json の各 kind で動作する (F6-1, F6-2)
- [ ] `promptVersion` が bump されている (F7-2)
- [ ] 既存テスト (plugin / mcp / worker) を割らない

---

## 制約 / 前提

- Anthropic Managed Agents の **Custom Tool** は client-side 実行。Worker / Agent は tool 呼び出しを **イベントとして観測** するだけで、実体の保存処理は **Plugin 側**で行う
- artifact の保存先は **chatStore (in-memory + events replay)** のみ。Worker の DB / R2 / Vault には保存しない
- `agent_toolset_20260401` および `mcp_toolset` の既存設定には触らない (custom_tool は別系統)
- 新しい依存ライブラリ (shiki / mermaid / DOMPurify) は本フェーズでは導入しない
- `react` kind の React / ReactDOM / Babel standalone / Recharts は **iframe 内で esm.sh から CDN ロード**する。親バンドルには含めない (= **親バンドル増加 +10KB 以内**を維持)
- iframe sandbox は `allow-scripts` のみ。`allow-same-origin` は**付けない** (親 DOM / cookie / kintone セッションへのアクセスを完全に遮断)
- iframe と親の通信は `postMessage` のみ (描画完了通知 / エラー通知)
- kintone 環境の CSP / sandboxed iframe での esm.sh ロード可否は **2026-04-29 に実機検証済み** ([verify-esm-sandbox.html](./verify-esm-sandbox.html))。React + Recharts のチャート描画が動作することを確認済み
- esm.sh からの import は **バージョンを固定** + `?deps=` で React singleton を強制すること:
  - `https://esm.sh/react@18.3.1`
  - `https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1`
  - `https://esm.sh/recharts@2.12.7?deps=react@18.3.1,react-dom@18.3.1`
  - (`?external=` は import map 無しのブラウザでは bare specifier が解決できず動かないので **使わない**)
- 既存テスト (267 plugin / 80 mcp / Worker 系) を割らないこと
- Step 2 以降への拡張ポイント (kind 追加 / アクション追加) を意識した設計にする (が、過剰な抽象化はしない)
