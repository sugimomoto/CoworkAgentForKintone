# 機能追加検討

_Started 2026-05-17 06:17 UTC_

---

## User

新しい機能の追加を今のデザインに反映させたいと考えています
添付した仕様を読み取って、内容を検討してもらえますか？

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: questions_v2]_

仕様を読みました。要件定義として非常によく整理されていて、V1 のスコープも明確ですね。現状の Chat Panel デザインに反映すべき主要な追加要素を整理した上で、いくつか確認させてください。

## 仕様の理解 — 現状デザインとの差分

| 領域 | 現状 | 追加が必要 |
|---|---|---|
| **Header** | `Aoi AGENT` 固定表示 | **Agent プルダウン** (Built-in 3 variant: 業務ユーザー / Customizer Opus / Customizer Sonnet) + **⚙ アイコン (admin のみ)** |
| **新 View** | Conversation のみ | **Settings View** (2-pane: 🤖 Agents / 🧠 Skills / 🔌 MCP) |
| **Artifact アクション** | 「kintone 適用」モーダル 1 種 | **プレビュー → 適用 → ロールバック** の wedge ループ (Customizer Agent 限定) |
| **Conversation chrome** | — | **Memory トグル** (V2 だが UI placement は今回決めたい?) |
| **Empty / コンテキスト** | greeting + suggestion | Agent によって suggestion を出し分け (Customizer なら「JS カスタマイズを書いて」等) |

## V1 で新規に作るべき画面

- **A. Agent プルダウン (Header)** — Opus / Sonnet バッジ、現在の Agent ラベル
- **B. ⚙ Settings 入口** + **B-1. Agents タブ** (一覧, 公開トグル, デフォルト)
- **B-2. Skills タブ** (同期, 一覧, カスタム skill 追加モーダル)
- **C. Customizer Agent の会話** — プレビュー / 適用 / ロールバックの artifact アクション (#20)
- **D. 業務ユーザー視点** — ⚙ 非表示、Agent プルダウンは公開された Agent のみ

V2 のもの (Agent 詳細編集 / MCP / Memory) は別フェーズで扱いますが、今回 V1 と並べて広めに探索することもできます。

## 進める前に確認したいこと

## User

Questions answered:
- scope: V1〜V3 全部 (Custom Agent 新規作成 / system prompt 編集まで)
- settings_surface: 右側の Artifact ペインを置き換えて開く (Side-by-Side 同様のレイアウト)
- agent_picker_style: Explore a few options
- opus_sonnet_visual: Agent 名の後ろに小さな MODEL バッジ (例: OPUS / SONNET)
- apply_action_visibility: Artifact のフッターにステップ式の workflow バーを置く (Step1 プレビュー → Step2 適用 → Step3 ロールバック)
- admin_gear_visibility: はい、admin と非 admin の両方のアートボードを並べてほしい
- exploration_breadth: 各画面 1 案ずつで、決定打を作る
- memory_in_v1: V1 のうちに Header の placement だけ決めておく (機能 OFF だが置き場所だけ確保)
- japanese_or_bilingual: 日本語のみ (現状ベースに合わせる)

## Assistant

_[tool: update_todos]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

_[tool: write_file]_

良い感じで仕様も把握できました。それでは Customizer wedge の追加 UI を現状デザインの語彙に揃えて全部組み立てます。design canvas に新しい section を追加していく形で、見比べやすく並べます。

_[tool: write_file]_

Now the Settings View — the biggest piece. I'll build all sub-sections (Agents / Skills / MCP / Custom Agent Create) in one file.Now the workflow footer bar for the Customizer apply flow.

_[tool: update_todos]_

_[tool: write_file]_

_[tool: str_replace_edit]_

Now wire everything into the design canvas — adding new sections for all the wedge features.Now I'll add a wedge-specific section. Let me copy the existing file to make a v2 and add new DCSections — actually, simpler: insert new sections before the closing `</DesignCanvas>` tag.

_[tool: str_replace_edit]_

Now let me create the WedgeSections component as a new file that defines all the canvas sections:

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: update_todos]_

_[tool: show_html]_

_[tool: done]_

_[tool: fork_verifier_agent]_

仕様の wedge 追加分を全部現状のデザイン語彙に揃えて design canvas に追加しました。

## 追加したセクション

新しい 4 ファイル (`wedge-header.jsx` / `wedge-settings.jsx` / `wedge-workflow.jsx` / `wedge-canvas.jsx`) で実装。design canvas の既存セクション (Overview / 添付 / Artifact) の下に **8 セクション** を追加しています:

| # | セクション | 内容 |
|---|---|---|
| 1 | **Header の Agent 切替 — 3 案探索** | A. インライン Pill / B. 名前 + ▾ (最小変更) / C. 独立 Agent Pill。各案で「閉/開」2 状態、最後にトレードオフ比較カード (推奨は **案 B**) |
| 2 | **Admin vs 業務ユーザー** | ⚙ 表示・非表示、公開 Agent の出し分けを並べて比較 |
| 3 | **Settings · エージェント (V1)** | 一覧 + 組織デフォルト指定 + 公開トグル。Side-by-Side ホスト統合 + 単体 |
| 4 | **Settings · スキル (V1)** | Plugin 同梱 / カスタム / Workspace 全体の 3 層、同期ボタン |
| 5 | **Settings · エージェント編集 (V2)** | skill / tool の ON-OFF ツリー、Kintone MCP は cascade + 参照系/書込系/管理系のカテゴリ、`⚠ ask` バッジ |
| 6 | **Settings · MCP (V2)** | Built-in (kintone) + 追加 server、3 ステップ案内モーダル |
| 7 | **Settings · カスタム Agent 作成 (V3)** | system prompt エディタ + skill / tool 構成 |
| 8 | **Customizer · プレビュー→適用→ロールバック (#20)** | Step バー 5 状態 (ready / previewed / applying / applied / rolled-back) + ホスト統合フルフロー |

## 設計判断

- **MODEL バッジ** — Opus は塗り (高位感)、Sonnet は枠線 (軽量感)。Header / ドロップダウン / Settings 全て統一
- **Memory トグル** — Header の ⚙ 左に控えめな pill で V1 から placement だけ確保 (OFF 表示・disabled 寄り)
- **Settings View** — 左 192px nav + 右 detail の 2 pane。Artifact ペインと差別化するため `c.bg` 背景にして「設定モード」を視覚的に区別
- **Workflow バー** — Step 2「適用」はアクセント色、Step 3「ロールバック」はワーニング色で別レイヤー感。Status line は色付きドット + 一行サマリ

## 次のステップ

1. Header 案を 1 つに決定 (推奨: B)
2. Step バーの「変更を依頼」入力欄の置き場 (現状ヒント行のみ、再依頼導線を残すか)
3. Customizer Greeting の suggestion 出し分け (今はスタブ) を別 section で詰めるか確認

Tweaks パネル (右下) で accent / theme / density を切替可能、新セクションも追従します。

## User

以下の画面が、縦幅が狭くて、ちゃんと全容が見えないのだけど
Header の Agent 切替 — 3 案探索
Admin vs 業務ユーザー

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: str_replace_edit]_

縦幅不足の原因は `StandalonePanel` の内側パネルが 720px 固定なのに対しアートボードが 420/520 で切れていたことです。パネルをアートボードにフィットさせ、ドロップダウン展開時用に高さも増やします。Now expand the heights so closed states show the panel + chat suggestions, and open states fit the full dropdown:

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: fork_verifier_agent]_

スクショは取れませんが構造的な修正なので、`fork_verifier_agent` で確認してもらいます。

`StandalonePanel` を 720px 固定からアートボード追従に変更し、Header 3 案セクションのアートボード高さを **閉=560px / 開=620px** に増やしました。これで Header + チャット本文 + 開いた時のドロップダウン全体が縦に切れずに収まります。Admin vs 業務ユーザーのセクションも同じ高さに合わせています。

_[tool: show_html]_

_[tool: sleep]_

_[tool: save_screenshot]_

スクリーンショットツールが今うまく動かないので、ユーザー側でご確認ください。修正自体は構造的なものです：

- 内側パネル: `height: 720px` 固定 → `height: 100%` でアートボードに追従
- 該当アートボード高さ: 閉 420→**560**、開 520→**620**

これで「案 A/B/C ドロップダウン展開」のドロップダウン (3 Agent + フッターヒント) も全部見えるはずです。問題があればまた教えてください。

## User

「Header の Agent 切替 — 3 案探索」は案Cが良いかな
「Admin vs 業務ユーザー」は違いが見えない？
「Settings View · エージェント編集 (V2)」は、DescriptionとSystem プロンプトも表示するところが必要かな？
「Settings View · MCP サーバー (V2)」はToolsをクリックした際の画面イメージが欲しい
「Settings View · カスタムエージェント作成 (V3)」だけど、アイコンを保持するところが多分ない
「Customizer · プレビュー → 適用 → ロールバック (V1 · #20)」はファイルツリー画面も必要？

## Assistant

_[tool: read_file]_

ありがとうございます。フィードバックを 1 つずつ反映していきます。先にユーザー編集分とファイル状態を確認。

_[tool: update_todos]_

フィードバックを 6 点まとめて反映します。

_[tool: str_replace_edit]_

### 1. Header: 案 C を canonical 化、agents prop を pass-through できるよう変更

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

### 2 & 3. Settings View へ Description / System Prompt / MCP Tools 詳細 / Icon picker 拡充

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now let me extend AgentDetailPane (V2) with Description + System Prompt, and replace the icon picker in Custom Agent Create:

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now replace the simple icon picker in CustomAgentCreatePane with a proper IconPicker (glyph + color):

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now add IconPicker, MCPToolsPane, and extended glyphs at the end of wedge-settings.jsx. Also I need to define the `cog`/`chart`/etc. glyphs. Let me add these near the end before the `window` export:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

### 6. Customizer file tree sidebar — add to artifact card

_[tool: str_replace_edit]_

Now wire the file tree into CustomizerArtifactCard body:

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

### 4. Restructure canvas — C をメイン化、Admin/業務差分を明示、新セクションを追加

_[tool: str_replace_edit]_

## Assistant

_[tool: str_replace_edit]_

### Restructure wedge-canvas.jsx — apply all 6 feedback itemsNow add the helper components (RejectedNote, AdminVsUserCompare), update HostWithSettings to use HeaderVariantC, add MCP Tools artboard, and resize Customizer workflow artboards for the file tree:

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

Now add the MCP Tools detail artboard and update Workflow artboard sizes:

_[tool: str_replace_edit]_

Now resize the Customizer workflow artboards (file tree adds 200px width):

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

フィードバック 6 点を反映しました。

## 変更内容

| # | 反映内容 |
|---|---|
| **1. Header** | 「採用案 C — 独立 Agent Pill」にリネーム。Customizer Opus / Sonnet / 業務ユーザー選択中の状態 + ドロップダウン展開 + ホスト統合を C で揃え、案 A/B は「検討案 (参考)」カードに集約 |
| **2. Admin vs 業務** | 同サイズ・同条件パネルを横に並べ、各下に「⚙ アイコン / プルダウン件数 / 公開トグル」など項目別の比較表に `DIFF` バッジ付きで差分を明示。業務側は Customizer 非公開で **1 件のみ** 表示 |
| **3. Agent 編集 (V2)** | 説明 (Description) 編集行 + システムプロンプト枠を追加。Built-in は「Plugin が管理」バッジ付きで、上書きされる旨の注意も併記。アイコン編集行も追加 |
| **4. MCP Tools クリック** | 新セクション `Tools 詳細`: server 識別子 + 統計 (合計 / 要承認 / 使用 Agent 数) + 検索 + カテゴリ別 Tool テーブル (説明 + ask バッジ + 使用エージェント数) |
| **5. Custom Agent icon** | **8 glyph × 8 color マトリクス + ライブプレビュー (44×44)** に拡張。Glyph: 業務 / 開発 / 分析 / メール / 予定 / 運用 / AI / 文書 |
| **6. Customizer ファイルツリー** | Artifact 内に **200px 左サイドバー** を追加: `customize/desktop.js` (現在編集中) / `mobile.js` / `desktop.css` / `libs/` / `manifest.json` / `README.md`。kind バッジ + 変更ステータス (M / +) + 「プレビュー環境と同期」インジケータ |

副次的に Agent 詳細編集 V2 にもアイコン編集行を追加 (V3 だけでなく Built-in も色だけは変えられる)、Customizer workflow のアートボード幅を 560→800 (file tree 200px 分) に拡張、全フルフロー artboard も C ヘッダーで統一しました。検証エージェントから明示的なフィードバックは返ってきませんでしたが、ファイルにエラーは出ていません。ご自身でも確認してみてください。気になる点があればまた教えてください。

## User

採用案Cなんだけど現在改行のせいでごちゃっとなってるので、調整してくれない？

あと、「Settings View 単体 · 一覧」の組織のデフォルトなんだけど、ここは一旦いらないかな

「カスタムスキル追加」画面も必要かな？

MCP Tools詳細画面」だけど、参照系、書き込み系という分け方はしないで。その情報がMCP Server側の情報として保持していないので

## Assistant

_[tool: update_todos]_

4 点まとめて反映します。### 1. Header C: 改行なしの 1 行レイアウトに整理

_[tool: str_replace_edit]_

### 2. Agents 一覧から「組織のデフォルト」を削除

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

### 3. カスタムスキル追加モーダル

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

### 4. MCP Tools 詳細をフラット一覧に

_[tool: str_replace_edit]_

Now add a new artboard for the Custom Skill add modal in the canvas:

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

4 点まとめて反映:

1. **Header 案 C** — Brand mark の上にあった「Cowork Agent / for kintone」 2 行表示を削除し、CA ロゴ + Agent pill + ユーティリティアイコンの **1 行レイアウト**に。Pill は `flex: 1 1 auto + min-width: 0` で残り幅を埋め、Agent 名は `text-overflow: ellipsis` で安全に省略。改行なし。
2. **Agents 一覧** — 「組織のデフォルト」セクションを削除。
3. **カスタムスキル追加** — Skills セクションに新しいアートボード `カスタムスキル追加モーダル` を追加。スキル名 / 説明 / SKILL.md textarea + バリデーション表示 + アップロードボタン構成のモーダル。
4. **MCP Tools 詳細** — 参照系 / 書込系 / ファイルのグルーピングを削除し、**フラット 13 ツール一覧**に。並び替えセレクター (名前順 / 使用頻度順 / 要承認を上に) を追加。説明文と「使用エージェント数」「ask バッジ」はそのまま。検証エージェントから明示的なフィードバックは返ってきませんでしたが、ファイルにエラーは出ていません。ご自身でも確認してみてください。気になる点があればまた教えてください。

## User

Header 案 C なんですが、やっぱり文字が切れすぎて何も読めないので2段構成にしましょうか？
下段で、対象エージェントの表示、切り替えをするようなイメージかなと

## Assistant

_[tool: str_replace_edit]_

なるほど、その方が確実に読めますね。下段に Agent 切替を独立させた 2 段構成に変更します。

_[tool: done]_

案 C を **2 段構成** に変更しました。

- **上段** (高さ ~45px): CA brand mark + 「Cowork Agent」 + サブライン (`for kintone` バッジ + `kintone接続` ステータス) + Memory トグル + ⚙ + ×
- **下段** (高さ ~45px): フル幅の Agent selector pill。"エージェント" ラベル + アイコン + Agent 名 + MODEL バッジ + ▾

下段は 380px パネル幅をほぼフルに使えるので、「カスタマイザー」 + OPUS/SONNET バッジが省略されずに表示されます。ドロップダウンも下段 pill の真下に同幅で展開。

## User

「エージェント」という表記はいらんかな？
そのかわりサンプルのエージェント名を「カスタマイザーエージェント」にしましょうか

## Assistant

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

「for kintone」もタイトルにインライン化して、サブラインを丸ごと削除します:

_[tool: done]_

反映完了:

- 「エージェント」ラベル削除、サンプル名を **「カスタマイザーエージェント」「業務エージェント」** に変更
- 「kintone接続」ステータス行を削除し、`for kintone` バッジを **「Cowork Agent」タイトルの右にインライン化**
- Agent 編集 (V2) の breadcrumb / heading / 名前 input も新しい命名に追従

Header の上段は「CA + Cowork Agent [for kintone] + Memory + ⚙ + ×」の 1 行に縮約され、下段の Agent pill とのバランスも整いました。

## User

カスタムスキルを追加だけど、ファイルアップロードでもいけるようにしたいですね

## Assistant

_[tool: str_replace_edit]_

ファイルアップロードに対応します。タブで切り替え可能にして「ファイル」と「直接入力」両モードを並べます。

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now insert the tabs and conditional content. Let me replace the form body section:

_[tool: str_replace_edit]_

Now update the footer to handle mode-aware validation message and add the helper subcomponents:

_[tool: str_replace_edit]_

Now add the new sub-components (TabPill, SkillFileDropzone, SkillFileUploaded, SkillTextEntry) — insert them right after the SkillAddModal function:

_[tool: str_replace_edit]_

Now update SettingsView to thread the new modes, and add new artboards in the canvas:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now add the new artboards in the canvas — show all 3 modes:

_[tool: str_replace_edit]_

_[tool: done]_

カスタムスキル追加にファイルアップロード対応を追加しました:

- **タブ切替**: 「📤 ファイル」 / 「📝 直接入力」
- **ファイル ① 選択前** — ドロップゾーン (アップロードアイコン + ドロップエリア + 「ファイルを選択」ボタン)。受け付けは `SKILL.md / .md / .zip`、最大 8 MB
- **ファイル ② 選択後** — 選択ファイルカード (md ロゴ + 名前 + サイズ + バリデーション通過マーク + 差替/削除) + frontmatter から自動抽出された name / description (編集可) + 内容プレビュー
- **直接入力** — 既存の SKILL.md textarea

フッターのバリデーション表記とアップロードボタンも mode に応じて切り替わるようにしました (ファイル未選択時はボタン disable)。design canvas に 3 つの状態のアートボードを並べています。

