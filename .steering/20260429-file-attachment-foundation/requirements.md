# ファイル添付機能 (Step 1: Foundation) — 要求定義

> 関連 Issue: [#16 ファイル添付機能 (CSV / PDF / 画像 → Agent → kintone)](https://github.com/sugimomoto/CoworkAgentForKintone/issues/16)

## 背景

artifact 生成基盤 (#14) の完了で「Agent → ユーザー」の出力経路は揃った。
本フェーズではその逆向きの「**ユーザー → Agent**」のファイル経路を整備する。

代表ユースケース:
- **CSV → kintone 一括登録**: 「この顧客リストを kintone のお客様アプリに登録して」
- **PDF / 画像の構造化**: 見積書 PDF / 名刺画像 → 内容抽出 → レコード作成
- **既存資料を踏まえた応答**: マニュアル PDF を上げて「これに沿って分類して」

## 設計方針 (Issue #16 のオリジナル案からの変更点)

オリジナル案の「Anthropic Files API + session resources で `/workspace/uploads/<filename>` にマウントして Agent が bash で読む」は **採用しない**。理由:

1. **`kintone.plugin.app.proxy()` は multipart 非対応** (string / object のみ)。Anthropic Files API は multipart upload なので直接呼べない。Worker 中継は stateless 原則と相反
2. Anthropic の **`document` / `image` content block は `source.type: "base64"` でインライン data を受け付ける**ため、Files API を経由せず JSON 1 本で送れる
3. 本フェーズのユースケース (1 回送って 1 回処理) は file_id の再利用メリットが薄い

→ **base64 で content block に inline 埋め込みする方式**を採用する。Files API / session resources / `/workspace/...` マウントは使わない。

## ねらい

- Composer の **📎 ボタン** から PDF / 画像 / テキスト系ファイルを **複数**選択できる (ホワイトリスト範囲内)
- 添付ファイルを **content block (text / document / image)** として user.message に乗せて送る
- 簡単な添付シナリオ (PDF 1 枚を「要約して」/ 画像 1 枚を「何が写ってる?」/ CSV を「kintone に登録して」) が end-to-end で動く
- 失敗パターン (サイズ超過 / 拡張子非対応 / 通信エラー) はチャット内に分かりやすく出す

本フェーズは Issue #16 の **Step 1 (Foundation) + 複数ファイル対応**を対象。以下は本プロジェクトでは**対応しない** (削除):

- ドラッグ&ドロップ (DnD) 経由の添付
- 右ペイン Files タブ (Agent 生成ファイルの DL)
- kintone records → CSV エクスポート専用ツール
- 管理者の無効化フラグ

## スコープ全体図

| カテゴリ | 概要 |
|---|---|
| 1. ファイル種別と content block 対応表 | text / document / image の 3 経路を kind で判定 |
| 2. データモデル | `chatStore.attachedFiles: AttachedFile[]` を追加 |
| 3. UI (添付チップ) | Composer 上に「📎 顧客リスト.csv (12KB) [✕]」のチップ表示 + 読込進捗 |
| 4. メッセージ統合 | 送信時に user.message の `content` 配列に text/document/image block を組み立てる |
| 5. エラーハンドリング | サイズ超過 / 拡張子非対応 / 読込失敗 をチップ上に表示 |
| 6. ライフサイクル | session 終了 / 新規セッション開始時 / 送信完了時に attachedFiles をクリア |

優先度: **P1 = 本フェーズ必須**、**P2 = 余力で着手**、**P3 = 別フェーズ送り**。

---

## 機能要件

### F1. ファイル種別と content block 対応 (Step 1 範囲)

| 拡張子 | MIME | content block | 経路 |
|---|---|---|---|
| `.txt` / `.md` / `.json` / **`.csv`** | `text/plain` (csv は `text/csv` として扱うが内部はテキスト inline) | `text` | `FileReader.readAsText` → text block の `text` フィールドにファイル名 + 本文 inline |
| `.pdf` | `application/pdf` | `document` | `FileReader.readAsArrayBuffer` → base64 → `document` block の `source: { type: "base64", media_type, data }` |
| `.png` / `.jpg` / `.jpeg` / `.gif` / `.webp` | `image/png` 等 | `image` | 同上で `image` block |

**非対象 (本フェーズではエラー扱い)**: `.docx` / `.xlsx` / `.zip` / 実行系 (`.exe` / `.dmg` 等) / 拡張子なし

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F1-1 | 拡張子 / MIME ホワイトリストを `core/files/types.ts` (新規) に定義 + 判定関数 | P1 | S |
| F1-2 | テキスト系: `FileReader.readAsText` でデコード (UTF-8 既定、必要なら BOM 検出) | P1 | S |
| F1-3 | PDF / 画像: `FileReader.readAsArrayBuffer` → `btoa(String.fromCharCode(...))` で base64 化 | P1 | S |
| F1-4 | CSV のテキスト inline 形式: `添付ファイル: <filename>\n---\n<本文>\n---` のように区切りを入れて Agent が範囲を認識しやすくする | P1 | S |

### F2. データモデル / chatStore

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F2-1 | `AttachedFile` 型を定義: `{ localId, filename, size, mimeType, kind: 'text'\|'document'\|'image', status: 'pending'\|'reading'\|'ready'\|'error', errorText?, content?: string \| { base64: string } }` | P1 | S |
| F2-2 | `chatStore.attachedFiles: AttachedFile[]` + `addAttachedFile / updateAttachedFile / removeAttachedFile / clearAttachedFiles` | P1 | S |
| F2-3 | `startNewConversation` / `reset` で `clearAttachedFiles` を併発 | P1 | S |
| F2-4 | unit test: 追加 / 更新 / 削除 / clear / 新規セッション連動 | P1 | S |

### F3. UI — Composer 添付チップ

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F3-1 | Composer に **📎 ボタン** を追加 (左側 / 入力欄横)。クリックで `<input type="file" multiple accept=".txt,.md,.json,.csv,.pdf,.png,.jpg,.jpeg,.gif,.webp">` を起動 | P1 | S |
| F3-2 | 選択された各ファイルを `attachedFiles` に `pending` で追加、即座に並列で FileReader 読込開始 | P1 | M |
| F3-3 | チップ表示: ファイル名 / サイズ / 状態 (reading なら spinner) / ✕ ボタン。チップは横並び + 折り返し表示 | P1 | M |
| F3-4 | error 状態のチップは赤系 + 簡潔なエラーメッセージ + ✕ ボタンで取消 | P1 | S |
| F3-5 | 読込中 (`reading`) / `pending` のファイルがあるときは送信ボタンを **disable** | P1 | S |
| F3-6 | 添付ファイル数の上限 (本フェーズ固定で **10 ファイル**): 超過時はエラー表示 | P1 | S |

**受入条件**
- 添付ボタンクリック → ファイル選択 → チップが現れて 一瞬 reading → ready 状態
- ✕ ボタンで添付取消できる

### F4. メッセージ統合 (content block 組み立て)

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F4-1 | `handleSubmit` で送信前に attachedFiles の中で `ready` 状態のものを抽出 | P1 | S |
| F4-2 | content 配列を構築: 添付ファイルごとに対応 block (text/document/image) を順番に並べ、最後にユーザー入力 text block を置く。テキスト系は `添付ファイル: <filename>\n---\n<本文>\n---` の整形を入れる | P1 | M |
| F4-3 | 既存 `postUserMessage(sessionId, content)` は `string \| Array<...>` を受け取るので拡張不要だが、`document` / `image` block 形式を渡せることを型で確認 | P1 | S |
| F4-4 | UI 上の user message には **添付チップ + 入力テキスト**だけ残し、自動付与した「添付ファイル: ...」案内は表示しない (見栄え重視。LLM への入力には含む) | P2 | S |
| F4-5 | 送信完了後に attachedFiles をクリア (= 同じファイルが 2 回送信に乗らない) | P1 | S |

**受入条件 (実機)**
- 「PDF を添付して "要約して" と送る」→ Agent が PDF 内容を読み取って要約を返す
- 「画像 (PNG) を添付して "何が写ってる?" と送る」→ Agent が画像内容を説明する
- 「CSV を添付して "kintone のお客様アプリに登録して" と送る」→ Agent が CSV を読み取って `kintone-add-records` に成功する
- **複数ファイル同時添付**: 例「画像 + PDF を 1 メッセージで送って "両方の関係を説明して"」が動く

### F5. エラーハンドリング / バリデーション

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F5-1 | 1 ファイルのサイズ上限 (本フェーズ固定で **10 MB**) を超えたら add 前に弾いてチップ赤表示 | P1 | S |
| F5-2 | 拡張子 / MIME ホワイトリスト外なら add 前に弾く | P1 | S |
| F5-3 | FileReader 読込失敗時はチップに `読込失敗: <reason>` を表示 | P1 | S |
| F5-4 | base64 化失敗 (極端に大きなファイル等) も同様 | P1 | S |
| F5-5 | 添付ファイル合計が **10 件** を超えたらエラー (= 添付追加を弾く) | P1 | S |
| F5-6 | 添付ファイル合計サイズの目安として **30 MB** を超えそうなときは送信前に警告 (Anthropic API リクエストサイズ上限の保険) | P2 | S |

**受入条件**
- 11MB の PDF → 添付前にエラー
- `.docx` ファイル → 添付前にエラー (「現状 .docx は未対応です」相当)

### F6. システムプロンプト更新

| ID | 内容 | P | 工数 |
|---|---|---|---|
| F6-1 | プロンプトに「ユーザーが PDF / 画像 / テキストファイル (CSV / Markdown / JSON 等) を添付したときは内容を踏まえて回答すること」を追記。kintone-add-records と組合せた典型シナリオ (CSV → 一括登録) も例示 | P1 | S |
| F6-2 | `promptVersion` を v10 → **v11** に bump | P1 | S |

---

## 非対象 (本プロジェクトでは対応しない)

- **ドラッグ&ドロップ** — 📎 ボタン経由のみで十分と判断
- **右ペイン Files タブ** / Agent 生成ファイルの DL — Issue #14 と別軸の機能なので本プロジェクトでは未対応
- **kintone records → CSV エクスポート専用ツール** — 既存の kintone-get-records + Agent の bash で代替可
- 情報漏洩警告ダイアログ / 管理者の無効化フラグ — 必要になったら別フェーズ
- 拡張子: **`.docx` / `.xlsx`** などのバイナリ系 office ファイル — 要 client-side 変換ライブラリ、別フェーズ送り
- **Anthropic Files API / session resources** 連携 — 本フェーズの方針上、不採用 (kintone.proxy が multipart 非対応 + ユースケースが 1 回送って 1 回処理で十分)

## 受け入れ条件 (フェーズ全体)

P1 項目すべての受入条件を満たすこと。具体的には:

- [ ] **F3**: Composer から PDF / 画像 / テキスト系ファイルを **複数同時**添付してチップ表示できる
- [ ] **F4**: 添付した PDF を Agent が読んで「要約して」に応答できる (実機 1 シナリオ)
- [ ] **F4**: 添付した画像 (PNG) を Agent が読んで「何が写ってる?」に応答できる (実機 1 シナリオ)
- [ ] **F4**: 添付した CSV を Agent が読んで `kintone-add-records` でレコード追加できる (実機 1 シナリオ)
- [ ] **F4**: 画像 + PDF を 1 メッセージで一緒に送り「両方の関係を説明して」が動く
- [ ] **F5**: 10 MB 超 / 未対応拡張子 / 11 ファイル目は事前にエラーチップ表示
- [ ] **F2**: chatStore unit test 全件 pass、既存 434 テスト割らない
- [ ] **F6**: promptVersion v11 で agent 設定が更新されている

---

## 制約 / 前提

- `kintone.plugin.app.proxy()` は **string / object のみ対応** (binary / multipart 非対応) なので、ファイルは**全て base64 文字列に変換して JSON body の中に inline で送る**
- base64 化により転送量が ~33% 増える。10 MB ファイルは ~13 MB の JSON になるため、Anthropic API のリクエストサイズ上限 (要確認、おそらく 30 MB 前後) 内に収まる範囲で運用
- Anthropic API の context window が大きいファイルを許容するかは実機確認 (10 MB PDF の content block は数万トークン消費する可能性あり、課金注意)
- 既存テスト (434 plugin / 80 mcp / Worker 系) を割らないこと
- artifact 基盤 (#14) の `chatStore` / Composer / ChatPanel 改修との競合に注意 (Composer の左側ボタン領域は他に競合無いことを確認済)
- Step 2 以降への拡張ポイント (拡張子追加 / 複数ファイル / DnD) を意識した設計にする (が、過剰な抽象化はしない)
