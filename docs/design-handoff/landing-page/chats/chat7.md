# プリセット一覧レイアウト設計

_Started 2026-06-06 05:01 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Cowork Agent for kintone"
Project currently has 22 file(s)
User is viewing file: Cowork Agent Chat Panel.html
Current date is now June 6, 2026
</system-info>

<default aesthetic_system_instructions>
The user has not attached a design system. If they have ALSO not attached references or art direction, and the project is empty, you must ASK the user what visual aesthetic they want. Use the questions_v2 tool to ask about preferred vibe, audience, colors, type, mood, etc. Do NOT just pick your own visual aesthetic without getting the user's aesthetic input -- this is how you get slop!

Once answered, use this guidance when creating designs:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are files in the project already.
</default aesthetic_system_instructions>

<pasted_text name="Pasted text (115 lines)">
# Cowork Agent for kintone — プリセットエージェント一覧 UI の検討依頼

## プロダクト概要

**Cowork Agent for kintone** は、kintone (サイボウズの業務 SaaS) 内に組み込むチャットパネル型の AI エージェントプラグイン。バックエンドは Anthropic Managed Agents + リモート MCP。kintone データ操作・集計・ドキュメント生成・JS カスタマイズ生成などを担う。

UI は kintone 画面の右側に縦長サイドパネルとして開く構造で、おおよそ以下の幅を想定:

- **シングル時**: 幅 360〜640px (ユーザー環境次第)
- **アーティファクト/設定ペインが横並びの時**: チャット側 360〜500px、右ペイン 480〜560px
- 縦は kintone ウィンドウ全高 (通常 700〜900px)

現在のチャットパネル構造 (上から下):

```
┌───────────────────────────────┐
│ Header (Agent ピッカー / ⚙ /✕)  │  ← 60-72px
├───────────────────────────────┤
│                               │
│   メインエリア                  │
│   (現状: WelcomeMessage か      │
│    チャット履歴 MessageList)    │
│                               │
├───────────────────────────────┤
│ ConversationUtilityBar         │  ← 履歴/新規会話ボタン (細い)
├───────────────────────────────┤
│ Composer (自由入力テキスト欄)    │  ← 60-100px (添付ボタン込)
└───────────────────────────────┘
```

## 解きたい課題

業務ユーザー (営業/財務/製造などの非エンジニア) が**チャットパネルを開いた瞬間に「何ができるか」が分からず、プロンプトも書けない**ため、現状の自由チャット入力主体の UX では刺さらない。

> 「設定しといて、ボタン押したら成果物が出る」レベルまで簡略化する必要がある。

## 今回作りたい体験

> **2 クリックで価値が出る UX:** (1) 並んでいるエージェントの中から (2) サンプルプロンプトボタンを 1 つ押す → 即実行 → 成果物が出る → そのまま既存チャット画面で対話継続。

### 機能要件

1. **チャットパネル起動直後 (履歴空 & セッション未開始)** に、現状の WelcomeMessage (静的な説明文) の代わりに **プリセットエージェント一覧画面** を表示する
2. 一覧には **公開設定された (visibility=public) エージェント** が並ぶ — 想定数は **3〜6 個** (Phase 1 は 3 個: 業務エージェント / Customizer Opus / Customizer Sonnet)
3. 各エージェントには:
   - アイコン (絵文字 or グリフ)
   - 名前 (例: 「業務エージェント」)
   - 短い説明 (1 行、20〜35 文字)
   - モデルバッジ (OPUS / SONNET)
   - **サンプルプロンプトボタン 4〜5 個** (1 個 20〜60 文字程度の日本語)
4. ボタンを押すと:
   - 該当エージェントが選択され
   - そのプロンプトを user message として送信
   - **即座にチャット画面 (MessageList) に遷移** して、ストリーミング応答を見ながら成果物が出る
   - その後は通常のチャット (自由入力でフォローアップ) として続けられる
5. 一覧画面でも **下の Composer (自由入力欄) は常時表示** (プロンプトを書ける層を排除しない)
6. (二次) 既存ユーザー向けに **「履歴を開く」「新規会話を始める」** 程度の導線はどこかに残したい

### サンプルプロンプトの実例 (UI 設計に使ってよい本物の文言)

業務エージェント:
- 「kintone アプリ一覧を見せて」
- 「先週追加された案件レコードを集計して」
- 「未対応の問い合わせを一覧化して、優先度を提案して」
- 「今月の売上をアプリから取得して、グラフ付きの Excel レポートにまとめて」
- 「議事録の PDF からタスクを抽出して、kintone のタスク管理アプリに登録案を作って」

カスタマイザーエージェント (Opus / Sonnet 共通):
- 「特定フィールドが空のときに保存できないようにする JS を作って」
- 「一覧画面で、ステータスフィールドの色分けをする JS を作って」
- 「保存時に別アプリのマスタを参照して値を自動入力する JS を作って」
- 「フォーム読み込み時にカスタムボタンを追加して、特定 URL を新規タブで開く JS を作って」
- 「現在のアプリの fields 定義を読み取って、テスト用のサンプルレコード生成 JS を作って」

## 制約

- **幅が狭い** (360px くらいから成立する必要がある) — 横スクロール or 2 段組 or アコーディオン的な工夫が要る
- **エージェントが増えてもスケールする** — 将来 #46 (プリセット マーケットプレイス) で 10 個以上並ぶ可能性
- **Composer (自由入力) は画面下に残る** ので、メインエリアの縦領域は限られる
- 既存 Header (Agent ピッカー) との **役割重複** をどう整理するかも論点 — Header の Agent ピッカーはそのまま残す予定だが、プリセット一覧画面でも兼ねるなら片方に寄せる選択肢もある
- 日本語のみ (i18n なし)
- スタイルは Tailwind CSS、トーンは「業務 SaaS の落ち着いた配色」 (派手すぎず、claude.ai に近い trustworthy なトーン)

## 既存 UI のトーン参考

- 色: アクセントは抑えた青系/サンドベージュ系。背景は白〜薄グレー。
- フォントサイズ: 本文 13px / 見出し 14-15px / 細字 11-12px
- 角丸: 6-12px
- 影はほぼ使わず、ボーダーで領域を区切る

## 検討してほしいこと

1. **3〜4 案のレイアウト案** を ASCII モック (または HTML/React モック) で提示してください。各案で:
   - 1 画面で全エージェントを見せるか、タブ/アコーディオン/カルーセルで切替えるか
   - サンプルプロンプトボタンの並べ方 (縦リスト / 横スクロール / 2 列グリッド / チップ風など)
   - 「自由チャットを始めたい」層への目立たない逃げ道
2. 各案の **トレードオフ** (情報量 / スクロール量 / 拡張性 / 業務ユーザーの認知負荷)
3. **推奨案 1 つと、その理由**
4. **マイクロインタラクション** の提案:
   - ボタンを押した後、一覧 → チャット画面への遷移をどう演出するか (フェード? カードがメッセージに変形? 即切替?)
   - 一覧画面に「Agent をもう一度選び直す」導線を残すべきか (= 履歴空ならいつでも戻れる)
5. **エッジケースの扱い**:
   - サンプルプロンプトが 0 個のエージェントがあるとき
   - エージェントが 1 個しかないとき
   - エージェントが 10 個以上に増えたとき (#46 後)
   - パネル幅が 360px ちょうどのとき

## 補足

- **このコンポーネントは React (TSX) + Tailwind CSS で実装される予定**
- 既存のアイコン/色は `iconKind: 'biz' | 'cust' | 'dev' | 'analytics' | 'mail' | 'calendar' | 'ops' | 'ai' | 'doc'`, `iconColor: 'accent' | 'accentSoft' | 'teal' | 'emerald' | ...` 等から選ぶスキーマがすでにある
- **テキストはすべて日本語** で問題ない

UX 案の比較検討と推奨をお願いします。

</pasted_text>


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: list_files]_

I'll start by exploring the existing project files to understand the design context, since there's already a chat panel and 22 files here.

_[tool: read_file]_

_[tool: read_file]_

This is a rich, mature project. Let me read the core data and the main "rich" variant to learn the exact component vocabulary and tokens.Now let me read the main rich variant and the wedge files to understand the full component vocabulary, colors, and header/composer treatment.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Let me read the wedge files (which handle the agent picker/customizer) and the styles, to fully nail the vocabulary before designing.

_[tool: questions_v2]_

I've now got a thorough read on the design system — warm sand palette (`#faf8f3` bg, `#231200` ink, teal `#0d9488` accent, kintone yellow host), Noto Sans JP + JetBrains Mono, flat/bordered cards at 10–14px radii, body 13px, and the existing `BUILTIN_AGENTS` schema, `AgentGlyph`, `ModelBadge`, and three header-picker explorations. I also see the design-canvas pattern (`DCSection`/`DCArtboard`) you've been using.

The brief is unusually complete (sample prompts, agent schema, tone, edge cases all specified), so I won't re-ask the basics. But a few genuine forks will shape the deliverable — let me confirm those before building.

## User

Questions answered:
- fidelity: デザインキャンバスに静的な比較カードとして並べる（見た目の比較重視）
- option_count: 4案
- canvas_target: 新規ファイル（プリセット一覧専用）として作る
- interaction_focus: エージェントの見せ方（全件1画面 / タブ / アコーディオン / カルーセル）, サンプルプロンプトの並べ方（縦リスト / 2列グリッド / チップ / 横スクロール）, ヘッダーの Agent ピッカーとの役割整理, 自由チャットへの逃げ道の出し方
- accent: 既存のティール #0d9488 を踏襲
- analysis_delivery: キャンバス内に付箋/カードとして載せる
- scale_demo: 推奨案だけ10個版も作る

## Assistant

_[tool: read_file]_

Got it — static comparison cards on a design canvas, 4 options, new dedicated file, keep teal `#0d9488`, analysis as on-canvas cards/post-its, and a 10-agent version of the recommended option. Let me confirm the design-canvas API and the kintone host I'll reuse.

_[tool: update_todos]_

I have full command of the system now. Let me lay out the plan and build.Now building `preset-agents.jsx` — the shared foundation:

_[tool: write_file]_

_[tool: write_file]_

Now the layouts file — 4 options, edge cases, the transition storyboard, and analysis cards:

## Assistant

_[tool: write_file]_

_[tool: write_file]_

Now the HTML that assembles everything on a design canvas, with an inline compact kintone host for context:

## Assistant

## User

進めて

## Assistant

_[tool: grep]_

_[tool: grep]_

The HTML write got blocked by a transient error. Let me retry it. First let me verify the key APIs I'm depending on — `DCPostIt`, `DCSection`, `DCArtboard` signatures and `ModelBadge`.

## Assistant

## Assistant

## Assistant

