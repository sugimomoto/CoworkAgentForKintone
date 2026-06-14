# Handoff: 定期実行 (Deployments) — スケジュール自律起動 UI

Cowork Agent for kintone — エージェントを cron スケジュールで定期起動する **「定期実行」機能** の実装ハンドオフ。
このフォルダだけで実装に着手できるよう、設計意図・採寸・トークン・参照実装をまとめています。

---

## Overview

「毎朝9時に未対応レコードを集計して担当者に通知」のような繰り返しタスクを、ユーザー自身が
セルフサービスで登録する機能。1 つの **Deployment** はエージェント・初回メッセージ・cron スケジュールを持ち、
時刻が来ると独立した会話セッションを生成してエージェントを自律起動する。

Settings（右ペイン 2-pane）に新セクション「定期実行」を追加する。配置は既存の
エージェント一覧 / スキル一覧と同じ視覚言語（クリーム×ティールのペーパー UI）。

**データモデル**（`deployments.ts` の `Deployment` を正とする）:

```ts
interface Deployment {
  id: string;
  name: string;                 // 表示名
  agentId: string;              // 対象エージェント（アイコン+名前+モデルバッジで表現）
  cron: string;                 // "分 時 日 月 曜日"
  tz: string;                   // IANA タイムゾーン。既定 'Asia/Tokyo'
  initialMessage: string;       // 実行時にエージェントへ送る初回メッセージ
  status: 'active' | 'paused';
  pausedReason?: string;        // paused のときの理由
  last?: { ok: boolean; at: string; dur?: string; err?: RunErrorKey };
  owner: string;                // 作成者 = kintone ユーザーコード
}
```

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**（見た目と挙動を示すプロトタイプ）であり、
そのままプロダクションに貼るものではありません。タスクは **これらの設計を対象コードベースの既存環境
（React + Tailwind + 既存トークン）で再現すること**です。既存環境がなければ最適なフレームワークを選んで実装します。

- `deployments.ts` は **そのまま流用できるフレームワーク非依存の TS**（型・cron 変換・プレビュー計算・サマリ）。
- `SchedulePicker.tsx` は **React (TSX) 参照実装**。`deployments.ts` に依存し、Tailwind トークン（`--cw-*`）で書いてある。
  一覧行・モーダル・履歴・確認ダイアログは本 README の採寸どおりに再現すること（プロトタイプの jsx も参照可）。
- `prototype/` は触って確認するスタンドアロン版（vanilla React + Babel）。`Deployments - UX Exploration.html` を
  ブラウザで開くと、全画面・状態・スケジュール入力を実際に操作できる。**実装は `prototype/` のインライン style ではなく、
  本 README の採寸 + ルートの TS/TSX（Tailwind トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。
既存 Settings 画面（`wedge-settings` 系）と同一トーンになるよう設計しているので、
既存コンポーネント/トークンを使ってピクセル単位で再現してください。

---

## 権限による出し分け（最重要）

ロールは **admin / 一般ユーザー** の 2 種。`visibleDeployments(all, role, currentUser, scope)` で算出。

| | 一般ユーザー | admin |
|---|---|---|
| Settings 左 nav | **「定期実行」のみ**表示 | 全セクション（エージェント / スキル / MCP / 定期実行） |
| 一覧の対象 | **自分が作成した Deployment のみ** | **全ユーザー分** |
| 所有者列 | 出さない | 各行に **owner** を表示 |
| スコープ切替 | なし | 「全員 / 自分のみ」pill |

> admin と一般を **別画面にせず**、同じ一覧コンポーネントの拡張（スコープ pill + 所有者列の有無）に留める。
> 過度に別物に見せないことが要件。

---

## Screens / Views

### 1. Settings 左 nav に「定期実行」を追加

- **Layout**: 既存 `SettingsView` と同一。ヘッダ（高さ可変・`padding 12px 18px`）+ Body 2-pane。
  - **左 nav**: `width:192px; flex:0 0 192px; border-right:1px var(--cw-border); padding:12px 8px; bg:var(--cw-card-hi)`。
    nav 項目は `flex; gap:8px; padding:7px 10px; border-radius:8px; font-size:12.5px`。
    active = `bg:var(--cw-card)` + `border:1px var(--cw-border)` + 太字 600 + アイコン/文字 `var(--cw-accent)`。
    右端に件数（`font-mono` 10px `var(--cw-subtle)`）。
  - **「定期実行」項目**: アイコンは **時計**（円 + 時針/分針、14px）。一般ユーザーはこの 1 項目のみ。
  - **右 detail**: `flex:1; overflow:auto; position:relative`（モーダル/トーストの absolute 基準）。
- ヘッダのサブテキストは role で変える：admin =「管理者 · 全ユーザーの定期実行を管理」、一般 =「{氏名} · 自分の定期実行」。

### 2. 一覧ペイン + Deployment 行

- **ペイン**: `padding:22px 26px 36px`。先頭に PaneHeading（タイトル 18px/700 + サブ 11.5px/muted）と
  右上に **「+ 新規作成」**（primary ボタン）。
- **admin のみ**: 見出し直下に操作バー。左に **スコープ pill**（`全員 N` / `自分のみ N`。
  `inline-flex; bg:var(--cw-card); border:1px var(--cw-border); border-radius:8px; padding:2px`。
  選択 = `bg:var(--cw-accent-soft); text:var(--cw-accent); 600`）。右に「所有者で絞り込み」セレクタ（任意）。
- 行は縦スタック `flex-direction:column; gap:8px`。

#### 行（DeploymentRow）の構造

カード: `bg:var(--cw-card); border:1px var(--cw-card-border); border-radius:10px; padding:12px 14px`。
paused 時は `opacity:0.82`。上半分（情報）と下半分（アクション）を `border-top:1px var(--cw-border)` で分割。

**情報部** `flex; align-items:flex-start; gap:12px`:
- 左 **アイコン** 36×36・角丸 9px。active = `bg:var(--cw-accent-soft)` + 時計（`var(--cw-accent)`）。
  paused = `bg:rgba(35,18,0,0.05)` + `var(--cw-subtle)`。
- 本体（`flex:1; min-width:0`）:
  1. **名前**（13px/600）+ **StatusBadge**。
     - StatusBadge: `inline-flex; gap:4px; font-size:10.5px/600; padding:2px 8px 2px 6px; border-radius:999px`。
       active =「実行中」`bg:var(--cw-accent-soft); text:var(--cw-accent)` + 緑ドット(6px `#22c55e`)。
       paused =「一時停止」`bg:rgba(35,18,0,0.05); text:var(--cw-muted)` + 灰ドット。
  2. **対象エージェント**（AgentMini）: 20px 角丸アイコン + 名前 11.5px/600 + ModelBadge（OPUS=塗り / SONNET=枠線、`font-mono`）。
     customizer 系はアイコンを `bg:var(--cw-accent)` 塗り、default 系は `bg:var(--cw-accent-soft)`。
  3. **スケジュール行**（11px）: 時計(12px,accent) + **人間可読表記**（`cronHuman` 例「毎日 9:00」、null は「カスタム」、`text:var(--cw-text)/500`）
     + cron 式チップ（`font-mono` 10px `bg:rgba(35,18,0,0.04); padding:1px 5px; border-radius:3px`）+ `·` + tz。
  4. **次回実行**（10.5px/subtle）:「次回 **YYYY/MM/DD (曜) HH:MM**（text/500）{相対}」。相対は accent（今日/明日/N日後）。
     paused のときは代わりに warn バナー「一時停止中：{pausedReason}」（`bg:var(--cw-warn-soft); text:var(--cw-warn); border-radius:6px; padding:4px 8px`）。
  5. **直近 run + owner 行**（`flex; gap:10px`）: 「直近」+ **LastRunBadge** + `font-mono` タイムスタンプ、
     「実行履歴 →」リンク（accent 10.5px）。**admin はここに右寄せで OwnerChip**。
     - LastRunBadge: 成功 = チェック + 「成功」`text:#047857`。失敗 = `bg:var(--cw-fail-soft); text:var(--cw-fail); 600; padding:1px 7px`
       「失敗 · {エラー種別ラベル}」（`RUN_ERRORS[key].label`）。未実行 = 「未実行」subtle。
     - OwnerChip: 18px 円イニシャル + 氏名(10.5px muted) + `font-mono` ユーザーコード(9.5px subtle)。

**アクション部** `flex; gap:7px; margin-top:11px; padding-top:11px; border-top:1px`:
- **今すぐ実行**（ghost+accent: `text:var(--cw-accent); border:var(--cw-accent-soft); bg:var(--cw-accent-soft 薄)`、▶ アイコン）
- **一時停止/再開トグル**（iOS 風 30×17、on=accent。ラベル「実行中/停止中」）
- spacer
- **編集**（28×28 アイコンボタン、鉛筆）
- **アーカイブ**（28×28、`text:var(--cw-warn)`、アーカイブ箱アイコン）→ 確認ダイアログ（§6）

#### 2-b. 空状態（1 件もない）

- 中央寄せの破線カード（`border:1px dashed var(--cw-border-strong); border-radius:14px; bg:var(--cw-card-hi); padding:30px 26px`）:
  52px 時計アイコン円 → 「定期実行はまだありません」(15px/700) → 説明 2 行(12px/muted/1.7) → 「**最初の定期実行を作成**」primary。
- 続けて **「こんな使い方ができます」** のユースケース 3 例（タップでテンプレ作成）。各行 = カード（`padding:12px 14px`）:
  32px アイコン + タイトル + cron バッジ（`font-mono` accent）+ 説明。例:
  - **日次通知** `毎日 9:00` — 毎朝9時に未対応レコードを集計して、担当者に通知
  - **週次サマリ** `毎週 月 8:00` — 毎週月曜の朝、先週の受注を Excel サマリにまとめて共有
  - **月次品質チェック** `毎月 1日 10:00` — 毎月1日に先月のデータ品質を点検して改善提案を作成

### 3. 作成 / 編集モーダル

- **オーバーレイ**: 右 detail ペインに重なる `position:absolute; inset:0; bg:rgba(20,14,5,0.45); z-index:30`。
  狭幅（モバイル相当）では全面オーバーレイ。カード `max-width:560px; max-height:100%; bg:var(--cw-card); border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,0.25)`。ヘッダ / body(スクロール) / フッタの 3 段。
- **ヘッダ**: 32px 時計アイコン（`bg:var(--cw-accent-soft)`）+ タイトル「定期実行を{作成/編集}」(14px/700) +
  サブ（新規「スケジュールと初回メッセージを決めるだけ」/ 編集「変更は次回の実行から反映されます」）+ × ボタン。
- **body フィールド**（`gap:16px`、各フィールドは label 11.5px/600 + 入力 + hint 10.5px/muted）:
  1. **名前** — text input。placeholder「例：毎朝の未対応集計」。
  2. **対象エージェント** — セレクタ風ボタン（AgentMini + ⌄）。クリックでドロップダウン展開（候補は AgentMini 行、選択中にチェック）。
  3. **初回メッセージ** — textarea（`min-height:64px`、リサイズ可）。placeholder「例：未対応の問い合わせを集計して、担当者ごとに通知して」。
     hint「実行時にエージェントへ最初に送る指示。1通の依頼として書きます。」
  4. **スケジュール** — `<SchedulePicker>`（§5 / `SchedulePicker.tsx` 参照）。
- **フッタ**: `bg:var(--cw-card-hi); border-top:1px`。左に「次回 {実体時刻} に実行」（ⓘ accent）、右に
  「キャンセル」(ghost) + **「{作成 / 変更を保存}」**(primary)。

### 4. 手動実行（今すぐ実行）のフィードバック — トースト

- 行の「今すぐ実行」押下 → ペイン下部にトースト（`position:absolute; left/right:26px; bottom:18px;
  bg:var(--cw-text); color:#fff; border-radius:10px; padding:12px 14px; box-shadow:0 12px 30px rgba(0,0,0,0.22)`）。
- 26px 円（半透明白地に緑チェック）+ 「テスト実行を開始しました」(12.5px/600) + 「「{name}」を今すぐ実行中。結果は実行履歴で確認できます。」
  + **「履歴を開く →」** ボタン（枠線 `rgba(255,255,255,0.25)`）。数秒で自動消滅 or × で閉じる。

### 5. スケジュール入力（SchedulePicker）

`SchedulePicker.tsx` が参照実装。controlled（`value: ScheduleValue` / `onChange`）。

- **プリセット セグメント**（毎日 / 毎週 / 毎月 / カスタム）: `bg:var(--cw-card)` の上に等幅ボタン。
  選択 = `bg:var(--cw-accent)` + 白文字。
- **条件フィールド**（FieldRow: label 84px + 入力）:
  - 毎週 → **曜日 7 トグル**（日月火水木金土、30×30、選択 = accent 枠+soft 地。日=赤系 / 土=accent の色分け）。
  - 毎月 → **日セレクタ**（1〜28日。「29〜31日は月により実行されないため 28日まで」の注記）。
  - カスタム → **cron text input**（`font-mono`。無効時 `border:var(--cw-fail)`。下に 分/時/日/月/曜日 の凡例）。
  - 毎日/毎週/毎月共通 → **時刻**（HH 時 : MM 分 セレクタ。分は 0/5/10/15/20/30/45）。
  - **タイムゾーン**（IANA。`TIMEZONES` 配列。既定 `Asia/Tokyo (既定)`）。
- **結果表示部**（`border-top; bg:var(--cw-card)`）:
  - **「生成された cron」** ＋ `font-mono` チップ ＋ `= {cronHuman}`（可読時）。無効時は赤。
  - **「次回の実行予定（直近3回）」** ＋ 番号付きリスト（`fmtRun` ＋ 相対表記）。
  - **DST 注記**: `dstRisk(s)` が true（夏時間地域 × 1〜3時台）のときだけ **warn 強調**
    （`bg:var(--cw-warn-soft); border:1px #f0c98a` + ⚠）。それ以外は控えめな破線 info（ⓘ）。
    本文「夏時間のある地域では 1〜3 時台の実行が境界日に飛ぶ／重複することがあります。確実に動かすなら UTC か 0〜1 時を避けた時刻を選んでください。」

### 6. アーカイブ確認ダイアログ（破壊的・取消不可）

- 中央オーバーレイ（`z-index:40`）。カード `max-width:400px`。
- 36px アーカイブアイコン（`bg:var(--cw-warn-soft); text:var(--cw-warn)`）+ 「定期実行をアーカイブ」(15px/700)。
- 本文「「{name}」をアーカイブします。以降スケジュールは実行されなくなります。」
- **warn ボックス**（`bg:var(--cw-warn-soft); border:1px #f0c98a`）: **「アーカイブは取り消せません。」**
  同じ設定で動かすには新しい定期実行を作り直す必要がある旨。実行履歴は残る旨。
- フッタ: 「キャンセル」(ghost) + **「アーカイブする」**（primary だが `bg:var(--cw-warn)` で塗る）。

### 7. 実行履歴（Run 一覧）— 行 → サブビュー

> **情報設計の判断**: 履歴は独立タブにせず、各行の「実行履歴 →」から **breadcrumb で潜るサブビュー** にする。
> 履歴は常に特定の Deployment に紐づくため、対象エージェント等の文脈を保ったまま見せられる。手動実行トーストからも同じ場所へ。

- breadcrumb「定期実行 › {name} › 実行履歴」+ PaneHeading（対象 AgentMini）+ 右上「← 一覧へ」。
- **サマリ + フィルタ**: 3 連スタット（実行回数 / 成功 / 失敗。失敗は `var(--cw-fail)`）+ **「すべて / 失敗のみ」pill**
  （失敗のみ選択時は `bg:var(--cw-fail-soft); text:var(--cw-fail)` + フィルタアイコン）。
- **run 行**: 22px 円ステータス（成功=緑チェック`#d1fae5`地 / 失敗=赤`var(--cw-fail-soft)`地）+
  `font-mono` タイムスタンプ + 2 段目（成功「成功 · 実行時間 {dur}」/ 失敗「失敗 · {エラー種別} — {hint}」`text:var(--cw-fail)`）+
  右に **「{sessionId} セッション →」** リンク（生成セッションへの導線）。

---

## Interactions & Behavior

- **新規作成 / 編集**: モーダルで controlled state を編集 → 「作成 / 変更を保存」で `onSave(deployment)`。編集は次回実行から反映。
- **今すぐ実行**: 行 → トースト（§4）。即時に独立セッションを生成して実行、結果は履歴へ。
- **一時停止 / 再開**: 行のトグルで `status` を `active ⇄ paused` 切替。paused 化時は `pausedReason` を任意入力（簡易プロンプト or 既定理由）。
- **アーカイブ**: 確認ダイアログ（§6）→ `onArchive(id)`。取消不可。論理削除（履歴は保持）。
- **スケジュール入力**: プリセット切替・時刻・tz 変更で `buildCron` → `cronHuman` ラベル + `nextRuns` プレビューを即時更新。
  カスタム cron が無効（`nextRuns` 空）なら赤枠 + 「式を確認してください」、保存ボタンは disable 推奨。
- **エージェント選択**: ボタンでドロップダウン開閉、外側クリックで閉じる。
- **トランジション**: フォーカスリング/枠線 ~120ms。重い演出はなし（既存 Settings に合わせ抑制）。
- **レスポンシブ**: 右ペイン幅 560px 前後を基準。狭幅ではモーダル/ダイアログを全面オーバーレイ。

## State Management

- 一覧は `Deployment[]` を親で保持。表示は `visibleDeployments(all, role, currentUser, scope)` で算出（`scope` は admin の pill）。
- モーダルは controlled。下書き state:
  ```ts
  { name: string; agentId: string; initialMessage: string; schedule: ScheduleValue }
  ```
  `ScheduleValue`（`deployments.ts`）→ `buildCron()` で保存用 cron に変換。
- 一覧/履歴の `next回実行` と `直近3回プレビュー` は `nextRuns(cron, now, n)` で導出（保存しない）。
- **タイムゾーン厳密化**: `nextRuns` はローカル近似。プロダクションでは保存 tz 基準の算出に
  `date-fns-tz` / `Luxon` 等を使い、サーバ側スケジューラ（実際の発火元）と一致させること。
- データ取得: 一覧 GET、作成/更新 POST/PUT、run トリガ POST、履歴 GET、アーカイブ POST（論理）。

## Design Tokens

CSS 変数（`--cw-*`、light 既定 + dark 対応）。既存 Settings（richColors light）と同一語彙。

| トークン | light | dark | 用途 |
|---|---|---|---|
| `--cw-bg` | `#faf8f3` | `#1a160f` | ペーパー背景 |
| `--cw-card` | `#ffffff` | `rgba(42,34,23,0.85)` | カード / 入力 / モーダル |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | — | カード枠 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | — | 淡い面 / nav 地 / 注記 |
| `--cw-border` | `rgba(35,18,0,0.10)` | — | 罫線・区切り |
| `--cw-border-strong` | `rgba(35,18,0,0.18)` | — | 破線カード枠 |
| `--cw-text` | `#231200` | `#ede4d0` | 本文 / トースト地 |
| `--cw-muted` | `#6b5f4a` | — | サブ |
| `--cw-subtle` | `#a89d85` | — | 補助・placeholder |
| `--cw-accent` | `#0d9488` | `#0d9488` | アクセント（ティール） |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | — | アクセント淡色 |
| `--cw-on-accent` | `#ffffff` | — | アクセント上の文字 |
| `--cw-warn` | `#b45309` | — | 警告 / アーカイブ / paused |
| `--cw-warn-soft` | `#fef3c7` | — | 警告淡色 |
| `--cw-fail` | `#dc2626` | — | run 失敗 |
| `--cw-fail-soft` | `#fee2e2` | — | run 失敗淡色 |
| 成功 | `#22c55e` / 文字 `#047857` / 地 `#d1fae5` | — | run 成功・online ドット |

- **角丸**: カード/行 10px、ボタン 7px、小バッジ 3px、pill/トグル 999px、モーダル 14px。
- **影**: 原則なし。モーダル `0 20px 60px rgba(0,0,0,0.25)`、トースト `0 12px 30px rgba(0,0,0,0.22)`、ドロップダウンのみ軽い影。
- **タイポ**: 本文 `Noto Sans JP` 13px / line-height 1.4。cron 式・ID・タイムスタンプ・件数は `JetBrains Mono`。
  名前 13px/600、サブ 11px/muted、メタ 10px/subtle。
- **spacing**: ペイン padding `22px 26px 36px`、行 padding `12px 14px`、行間 gap 8px、余白 12–14px 基調。

## Assets

- アイコンはすべて **インライン SVG**（時計 / ▶ / ⏸ / アーカイブ箱 / 鉛筆 / チェック / ⚠ / ⓘ / フィルタ / → / + / 地球 / 太陽 / 各 nav）。
  外部アセットなし。対象コードベースに既存アイコンセットがあれば差し替え可。
- 対象エージェントのグリフは既存 `AgentGlyph` / `ExtendedAgentGlyph`（biz/cust/chart/cog/doc…）を流用。
- ブランド/画像アセットなし。

## Files

| ファイル | 役割 |
|---|---|
| `deployments.ts` | **型 + cron ヘルパー（本体）**。`Deployment` / `ScheduleValue` / `RUN_ERRORS`、`cronHuman` / `nextRuns` / `buildCron` / `dstRisk` / `visibleDeployments` / `scheduleSummary` 等。フレームワーク非依存 |
| `SchedulePicker.tsx` | **React 参照実装**（スケジュール入力）。`deployments.ts` 依存・Tailwind トークン使用 |
| `prototype/Deployments - UX Exploration.html` | スタンドアロン検討版（全画面・状態・スケジュール入力を操作可能） |
| `prototype/deployments-data.jsx` | プロトタイプの土台（トークン / モックデータ / cron / 共通アトム） |
| `prototype/deployments-panes.jsx` | 2-pane シェル / 一覧 / 空状態 / 履歴 / トースト |
| `prototype/deployments-modal.jsx` | 作成・編集モーダル / SchedulePicker / アーカイブ確認 |
| `prototype/wedge-header.jsx`, `prototype/wedge-settings.jsx` | グリフ/モデルバッジ/既存 Settings コンポーネント（依存） |
| `prototype/design-canvas.jsx`, `prototype/styles.css` | プロトタイプ実行用（design canvas / フォント） |

### 組み込み手順（要約）

1. Settings 左 nav に **「定期実行」**（時計アイコン）を追加。role が一般ユーザーならこの 1 項目のみ表示。
2. 右 detail に一覧ペイン（§2）を実装。`visibleDeployments` で role/scope に応じて絞り込み、admin は所有者列 + スコープ pill を出す。
3. 「+ 新規作成」/「編集」で作成・編集モーダル（§3）。スケジュールは `<SchedulePicker>`（`SchedulePicker.tsx`）を流用。
   保存時は `buildCron(schedule)` を cron に変換して送信。
4. 行の「今すぐ実行」→ トースト（§4）、「実行履歴 →」→ サブビュー（§7）、「アーカイブ」→ 確認ダイアログ（§6）。
5. サーバ側スケジューラの発火 tz と UI の `nextRuns` 計算を一致させる（プロダクションは tz 対応ライブラリ推奨）。

詳細な採寸・コピーは本 README と `prototype/` を参照。型と cron ロジックは `deployments.ts` をそのまま使えます。
