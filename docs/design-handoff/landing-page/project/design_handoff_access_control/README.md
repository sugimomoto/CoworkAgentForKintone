# Handoff: エージェント「公開先」(ACL) ピッカー

Cowork Agent for kintone — `AgentDetailModal` に追加する **「公開先」セクション** の実装ハンドオフ。
このフォルダだけで実装に着手できるよう、設計意図・採寸・トークン・参照実装をまとめています。

---

## Overview

admin（情シス）が「このエージェントを、どの kintone ユーザーが使えるか」を設定する新規セクション。
エージェントは並列な 3 つの配列を持つ：

```ts
allowedUsers: string[];          // kintone ユーザーコード（= ログイン名 = メールアドレス）
allowedGroups: string[];         // kintone グループコード
allowedOrganizations: string[];  // kintone 組織コード
```

**結合ロジック**：3 配列すべて空 → **全員に公開**。いずれかに値あり → **OR 結合**
（allowedUsers の誰か **OR** allowedGroups のどれか **OR** allowedOrganizations のどれかに属する）。AND ではない。

`AgentDetailModal`（幅 680px・センターモーダル・`overflow-y: auto`）内で、
**「クイックアクション」と「Skills」の間** に差し込む。

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**（見た目と挙動を示すプロトタイプ）であり、
そのままプロダクションに貼るものではありません。タスクは **これらの設計を対象コードベースの既存環境
（React + Tailwind + 既存トークン）で再現すること**です。

- `AccessPicker.tsx` / `accessControl.ts` は **そのまま流用できる React (TSX) 参照実装**。既存の Tailwind
  トークンに依存して書いてあるので、トークン定義さえ合っていれば最小修正で組み込めます。
- `prototype/` は触って確認するためのスタンドアロン版（vanilla React + Babel、モック API 入り）。
  ブラウザで `AccessPicker — UX Exploration.html` を開くと、4 レイアウト案・マイクロ UX・サマリ案・
  エッジケースを実際に操作できます。**実装は `prototype/` のインライン style ではなく、
  ルートの TSX（Tailwind トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。最終的な配色・タイポ・余白・角丸・インタラクションまで確定済み。
既存 Settings 画面（`wedge-settings` 系）と同一トーンになるよう設計しているので、
既存コンポーネント/トークンを使ってピクセル単位で再現してください。

---

## Screens / Views

### 1. 「公開先」セクション（採用案 A — 縦スタック / OR カード）

- **Purpose**: admin が公開範囲を一目で把握し、3 軸で incremental search して絞り込む。
- **Layout**: 縦 1 カラム、`flex-direction: column; gap: 12px`。上から
  1. **ステータスバナー**（全員 / 指定公開）
  2. **ユーザー カード**
  3. **OR コネクタ**
  4. **グループ カード**
  5. **OR コネクタ**
  6. **組織 カード**
  （カード間 gap 8px、バナー↔カード群 gap 12px）
- モーダル幅 680px 固定。縦は無制限（モーダル側がスクロール）。

#### 1-a. ステータスバナー
- 横並び `flex; align-items:center; gap:11px; padding:11px 13px; border-radius:10px`。
- **全員公開時**（3 軸空）：`background: var(--card-hi)`、`border:1px solid var(--border)`。
  - 左に 30×30 角丸 8px の白タイル（`border:1px var(--border)`）＋ globe アイコン（16px, `text-muted`）。
  - タイトル「**全員に公開**」12.5px/700/`text-text`。
  - サブ「この kintone を使う全ユーザーが…絞り込むには下で追加します。」10.5px/`text-muted`/line-height 1.5。
- **指定公開時**（1 件以上）：`background: var(--accent-soft)/0.6`、`border:1px solid var(--accent)/0.2`。
  - 左タイルは `bg-accent` + 白チェック（16px）。
  - タイトル「**指定したメンバーに公開** · 合計 N 件」。
  - サブ「5人 ・ 2グループ ・ 1組織 のいずれかに該当するユーザーが利用できます（OR 結合）」。

#### 1-b. 軸カード（ユーザー / グループ / 組織で共通構造）
- `background: var(--card); border:1px solid var(--card-border); border-radius:11px; padding:12px;`
  `display:flex; flex-direction:column; gap:10px`。
- **ヘッダ行** `flex; align-items:center; gap:9px`：
  - 26×26 角丸 7px の軸タイル（`background: <axis>/10`, アイコン `<axis>` 14px）。
  - 軸名 12.5px/600/`text-text`（ユーザー / グループ / 組織）。
  - 件数バッジ：あり = `<axis>/10` 背景・`<axis>` 文字・`font-mono` 10.5px/600・`padding:1px 7px`・
    `border-radius:999px`・`white-space:nowrap`（例「5人」「2グループ」「1組織」）。なし = 「指定なし」`text-subtle`。
- **検索フィールド**（下記 2 を参照）。
- **チップ群**（1 件以上のとき）：`flex; flex-wrap:wrap; gap:6px; max-height:132px; overflow-y:auto`。

#### 1-c. OR コネクタ
- `flex; align-items:center; gap:10px`：両側に `height:1px; background:var(--border)` の罫線、中央に「OR」バッジ。
- バッジ：`font-mono` 9.5px/800・letter-spacing .1em・`padding:2px 9px`・`border-radius:999px`。
  - 非アクティブ：`bg-card-hi`・`text-subtle`・`border:1px var(--border)`。
  - アクティブ（上の軸に値あり **かつ** 下に値あり）：`bg-accent-soft`・`text-accent`・`border:1px var(--accent)/0.25`。

### 2. ピッカーのマイクロ UX（検索フィールド + ドロップダウン）

- **入力欄**：`flex; align-items:center; gap:7px; padding:6px 10px; border-radius:8px; background:var(--card)`。
  - 通常 `border:1px var(--border)`。フォーカス時 `border-color:var(--accent)` ＋ `box-shadow:0 0 0 3px var(--accent)/0.10`。
  - 先頭アイコン：通常は虫眼鏡（14px, `text-subtle`）、検索中は spinner（同位置に差替）。
  - input は透明背景・12.5px・`text-text`・placeholder `text-subtle`。右端に値があれば × クリア。
  - placeholder：ユーザー「名前 / ログイン名で検索」、グループ「グループ名で検索」、組織「組織名で検索」。
- **ドロップダウン**：input 直下に anchored（`position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:40`）。
  `background:var(--card); border:1px solid rgba(35,18,0,0.18); border-radius:10px;`
  `box-shadow:0 12px 32px rgba(35,18,0,0.13)`。`max-height:232px; overflow-y:auto`。
  - フォーカス直後（空クエリ）は「候補」見出し（9px/700/uppercase/`text-subtle`）＋候補行。
  - **候補行**：`flex; align-items:center; gap:9px; padding:7px 10px`。アクティブ行は `bg-accent-soft`。
    - ユーザー：24px イニシャルバブル（円・`<axis>/15` 背景・`<axis>` 文字・姓頭文字）。
      1 段目 = **「名前（メールアドレス）」**（12.5px/500/`text-text`）。2 段目 = 所属（10px/`font-mono`/`text-subtle`）。
    - グループ / 組織：24px 角丸タイル＋アイコン。1 段目 = 名前。2 段目 = `code · N人`（グループ）/ 階層パス（組織）。
    - 右端に ＋ アイコン（アクティブ時 `text-accent`、非 0.5 透過）。
  - **loading**：「検索中…」＋ spinner。**該当なし**：「「{query}」に一致する{軸}はありません」＋「選択済みの項目は候補に表示されません」。
  - **API エラー**：警告三角（`var(--warn)`）＋「候補を取得できませんでした / kintone API への接続を確認してください。」＋「再試行」ボタン。**入力済みチップは保持**。
- **チップ**：`inline-flex; align-items:center; gap:6px; border-radius:999px; border:1px var(--border); background:var(--card)`。
  - ユーザー：左 18px イニシャルバブル、ラベル = **「名前（メールアドレス）」**（12px/500、`max-width:230px` で truncate、`title`=メアド）、右 × ボタン（16px 円、hover で `bg-border`）。
  - グループ / 組織：左アイコン（12px, `<axis>`）、ラベル = 名前（`max-width:150px`）。

### 3. AgentsListPane の「公開先」サマリ列（狭い列・約 116px）

一覧の各行に 1 列追加。**採用は案 1**（最短・1 行固定）。`accessControl.ts` のヘルパーで生成：
- 案 1（推奨）`formatAccessSummary`：`全員` / `5人` / `5人 +2` / `2グループ +1`（最大軸 + 余りを +N）。
- 案 2 `formatAccessFull`：`全員に公開` / `5人・2グループ・1組織`（折返し前提）。
- 案 3 `accessSummaryParts`：アイコン + 数字を軸ごとに描画。
- 全員のときは globe アイコン + 「全員」、`text-muted`。

---

## Interactions & Behavior

- **incremental search**：入力 → **debounce 300ms** → 各軸の検索関数を呼ぶ → 候補 **最大 10 件**。
- **追加**：候補クリック / Enter で確定 → チップ追加 → 入力クリア → 候補を引き直し。
- **削除**：チップの × で個別削除。
- **重複防止**：選択済み code を検索関数の `exclude` に渡し、候補から自動除外。
- **キーボード**：`↑/↓` 候補移動・`Enter` 確定・`Esc` クローズ・`Tab` で次の軸へ。input は `aria-label`、チップ × も `aria-label`。
- **外側クリック**でドロップダウンを閉じる。
- **トランジション**：フォーカスリング/枠線は 120ms。重い演出はなし（既存 Settings に合わせ抑制）。
- **レスポンシブ**：モーダル幅 680px 固定前提。縦はチップ領域 `max-height` + 内部スクロールで吸収。

## State Management

- 親（`AgentDetailModal`）が `AccessValue`（3 配列）を保持し、`onChange(next)` で受ける **controlled** コンポーネント。
- ピッカー内部の一時状態：軸ごとに `{ query, open, loading, error, results, activeIndex }`、
  および **code → AccessEntry のキャッシュ**（チップ名解決用、選択時に充填）。
- 既存 value（保存済み code のみ）の表示名解決は任意 prop `resolveEntries(kind, codes)`。未指定だと解決前は code 表示。
- 非同期は最新リクエストのみ反映（reqId でレース無効化）。

## Design Tokens

既存 Settings（richColors light）と同一。Tailwind トークンに割り当てて使用：

| トークン | 値 | 用途 |
|---|---|---|
| `--bg` | `#faf8f3` | モーダル body 背景 |
| `--card` | `#ffffff` | カード / 入力 / ドロップダウン |
| `--card-hi` | `rgba(255,191,0,0.06)` | 淡い面（全員バナー等） |
| `--border` | `rgba(35,18,0,0.10)` | 罫線・区切り |
| `--card-border` | `rgba(35,18,0,0.08)` | カード枠 |
| （ドロップダウン枠） | `rgba(35,18,0,0.18)` | 浮く面の枠 |
| `--text` | `#231200` | 本文 |
| `--muted` | `#6b5f4a` | サブ |
| `--subtle` | `#a89d85` | 補助・placeholder |
| `--accent` | `#0d9488` | アクセント / ユーザー軸 |
| `--accent-soft` | `rgba(13,148,136,0.10)` | アクセント淡色 |
| `--on-accent` | `#ffffff` | アクセント上の文字 |
| `--warn` | `#b45309` | エラー |
| 軸色 group | `#7c6aa8` | グループ軸の識別色 |
| 軸色 org | `#2f6f9f` | 組織軸の識別色 |

- **角丸**：入力/タイル 7–8px、カード 11px、バナー/ドロップダウン 10px、チップ/バッジ 999px。
- **影**：原則なし。ドロップダウンのみ `0 12px 32px rgba(35,18,0,0.13)`。
- **タイポ**：本文 12.5px、軸名 12.5px/600、件数/code は `JetBrains Mono`、補助 10–10.5px。日本語 `Noto Sans JP`。
- **spacing**：カード padding 12px、行 gap 8–12px、チップ gap 6px。

軸の識別色（user=accent / group=`#7c6aa8` / org=`#2f6f9f`）は「一目で分かる」要件のための差し色。
不要なら group/org を中立色に寄せても可。参照実装は CSS 変数 `--axis` で 1 箇所に集約済み。

## Assets

- アイコンはすべて **インライン SVG**（user / group / org / globe / search / spinner / alert / check / plus / ×）。
  外部アセットなし。対象コードベースに既存のアイコンセットがあれば差し替え可。
- ブランド/画像アセットなし。

## Files

| ファイル | 役割 |
|---|---|
| `AccessPicker.tsx` | **参照実装（本体）**。採用案 A + 内部小コンポーネント。Tailwind トークン使用 |
| `accessControl.ts` | 型（`AccessValue` / `AccessEntry` / `AccessSearchFn`）と `formatAccessSummary` 系・`userLabel` |
| `prototype/AccessPicker — UX Exploration.html` | スタンドアロン検討版（4 案・マイクロ UX・サマリ・エッジ・比較表） |
| `prototype/access-data.jsx` | モック kintone ディレクトリ + モック非同期 search + サマリヘルパー（vanilla） |
| `prototype/access-picker.jsx` | プロトタイプの本体（採用案 A）+ 共通プリミティブ |
| `prototype/access-explore.jsx` | 案 B/C/D・マイクロ UX・サマリ・エッジ・比較/推奨カード |
| `prototype/design-canvas.jsx`, `prototype/styles.css` | プロトタイプ実行用（design canvas / フォント） |

### 組み込み手順（要約）

1. `AgentDetailModal` のクイックアクション直後に `<h3>公開先</h3>` ＋ `<AccessPicker .../>` を差し込む。
2. `searchUsers/searchGroups/searchOrganizations` を kintone REST → `AccessEntry`（`code`/`name`/`meta`）に正規化して渡す。
   ユーザーは `code` にメアド（=ログイン名）を入れれば `userLabel()` が「名前（メアド）」に整形する。
3. 保存済み code の名前解決が要るなら `resolveEntries` を渡す。
4. AgentsListPane に `formatAccessSummary(agent)` の列を 1 つ追加。

詳細な props / 検索関数の実装例は `AccessPicker.tsx` 冒頭コメントと、元 `handoff/access/README.md` を参照。
