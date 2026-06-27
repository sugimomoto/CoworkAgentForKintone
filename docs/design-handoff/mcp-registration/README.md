# Handoff: 追加 MCP Server 登録 + 接続管理 UI（#42）

Cowork Agent for kintone — ユーザーが必要とするリモート MCP を柔軟に追加して使えるようにする
**MCP サーバー登録 + 接続管理** の実装ハンドオフ。このフォルダだけで実装に着手できるよう、
設計意図・採寸・トークン・参照実装をまとめています。

---

## Overview

kintone OAuth の仕組みを「複数 MCP サーバー」に一般化した **Model A**。責務を 3 層に分離し、画面も分けます。

| 層 | 内容 | スコープ | 画面（サーフェス） |
|---|---|---|---|
| ① **サーバー定義（カタログ）** | name / URL / 認証方式 /（OAuth）endpoints・client_id・secret | **テナント共有**（admin が定義） | **A · Plugin Config**（kintone 管理画面） |
| ② **接続（認証情報）** | 各ユーザーが自分のアカウントで接続（OAuth 認可 or トークン入力） | **per-user** | **B · Chat Panel Settings → MCP**（一番リッチ） |
| ③ **attach** | どのエージェントでそのツールを使うか / tool ON-OFF | Agent ごと | **C · Agent 詳細編集**（#40 連動） |

> **要点**: admin が「使える MCP サーバーのカタログ」を定義し、**各ユーザーはそこから自分のアカウントで「接続」する**。
> ユーザーが任意 URL を自由登録するのではない（kintone 連携と同じ思想）。

認証方式は 3 種: `none`（認証なし公開）/ `bearer`（API キー・PAT）/ `oauth`（PKCE。public 優先・confidential も可）。

データモデルは `mcpRegistry.ts` の型を正とします（`McpServerDef` / `McpConnection` / `McpAttachment`）。

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**（見た目と挙動を示すプロトタイプ）であり、
そのままプロダクションに貼るものではありません。タスクは **これらの設計を対象コードベースの既存環境
（React + Tailwind + 既存トークン）で再現すること**です。環境が未確立なら最適なフレームワークを選んで再現してください。

- `mcpRegistry.ts` は **そのまま流用できるフレームワーク非依存の TS**（型・バリデーション・状態ヘルパー）。
- `McpServersPane.tsx`（B）/ `McpServerForm.tsx`（A）/ `McpAttachSection.tsx`（C）は **React (TSX) 参照実装**。
  `mcpRegistry.ts` に依存し、CSS 変数トークン（`--cw-*`）を Tailwind の arbitrary value で参照しています。
  トークン定義さえ合っていれば最小修正で組み込めます。
- `prototype/` は触って確認するスタンドアロン版（vanilla React + Babel）。
  ブラウザで `MCP Registration - UX Exploration.html` を開くと、全状態・3 サーフェス・kintone 文脈・設計根拠・UI コピーを
  実際に操作できます（接続 / 認可ポップアップ / 解除 / テスト / フォーム入力が動きます）。
  **実装は `prototype/` のインライン style ではなく、ルートの TS/TSX（`--cw-*` トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。
既存 Settings / AgentDetailModal / Plugin Config と同一トーンになるよう設計しているので、
既存コンポーネント/トークンを使ってピクセル単位で再現してください。新規意匠は **AuthBadge** のみ（後述）。

---

## Screens / Views

### A — Plugin Config 全体の再設計（MCP カタログを統合）

kintone プラグイン管理画面（Chat Panel とは別環境）。admin 専用。`ConfigScreen.tsx` / `prototype/mcp-config-screen.jsx` 参照。

> **IA の提案（委ねられた論点への回答）**: 現状は「4 ステップを保存後も使い回す単一ウィザード」。
> これを **ライフサイクルで 2 ゾーンに分離**する。MCP は後付けでなく、この再設計の一部として統合する。

**左レール 2 ゾーン**（`ConfigScreen` の Shell）:

| ゾーン | 性質 | 未設定時 | 設定済み時 |
|---|---|---|---|
| **接続セットアップ** | 初回 1 回 | **ウィザード**（Step 0〜3） | **ステータス + 各項目編集**（部分更新） |
| **MCP サーバー** | 継続 CRUD | （常に）一覧 + 追加/編集/削除 | 同左 |

- レール項目にステータス（接続セットアップ = 設定済み/未設定 pill、MCP = 件数）。アプリバー右に「接続セットアップ済み」バッジ。
- **MCP をウィザードに連番接ぎしない**理由: セットアップは一度きり、MCP カタログは継続運用。性質が違うので独立ゾーンが自然。

#### 接続セットアップ — 未設定（ウィザード）

`max-width:720px` 中央寄せ。**番号 + 接続線**の縦ステップ（`StepCard`）。各ステップは `bg-card; border-card-border; radius:12px` のフォームカード。

- **Step 0**: Cloudflare Workers デプロイ（**任意** バッジ）— Account ID + API Token（秘匿）+「Worker をデプロイ」（Cloudflare オレンジ `#f6821f`）+ 進捗（デプロイ中スピナー / 完了チェック）。
- **Step 1**: Worker URL + Anthropic API キー（秘匿・伏字・eye）。
- **Step 2**: cybozu.com OAuth 登録の**案内** — redirect_uri（固定）の **コピー** + 「cybozu.com 共通管理を開く」リンク + **手順詳細アコーディオン**。Worker URL 未入力時は `opacity:0.5; pointer-events:none` で dim。
- **Step 3**: kintone OAuth `client_id`（**公開識別子・伏字にしない**）+ `client_secret`（秘匿・伏字）。
- フッタ: 「秘匿値はパスワード同様」注記 + キャンセル / **保存して接続**。

#### 接続セットアップ — 設定済み（ステータス + 編集）

- 上部に**部分更新の注記**（accent soft ボックス）:「各項目の『再入力』でその秘匿値だけ更新。空欄保存は既存値据え置き」。
  → 現状実装の「初回フルセットアップ / 以降は部分更新」の二面性を UI コピーで明示。
- **ステータス行**（`StatusRow`）: 各設定項目をアイコン + ラベル + **緑「設定済み」** + 値（公開値はそのまま / 秘匿値は伏字 `●●●…`）+
  「編集 / 再入力」。押下でその行だけインライン編集（secret は `SecretInput`、公開値は通常 input）→ 更新 / キャンセル。
- 末尾に「セットアップをやり直す」（warn）+ 最終更新メタ。

#### MCP サーバー ゾーン（= Surface A カタログ）

セットアップとは別ゾーンとして、登録済みサーバーの**一覧 + 追加/編集/削除フォーム**を常時 CRUD で提供。詳細は次項。

#### MCP カタログ フォーム（`McpServerForm.tsx`）

admin がテナント共有のサーバー定義を登録する。秘匿値（client_secret）は **Step 1/3 の API キー/secret と同じ伏字・再入力更新の作法で統一**。

- 共通: `表示名`, `サーバー URL`（https）, `認証方式`（**3 連セグメント** none / bearer / oauth）。
  - **oauth のときのみ展開**（accent 枠のサブカード）: `authorization_endpoint`, `token_endpoint`,
    `client_id`, `scope`, `token_endpoint_auth`（**ラジオ** none=PKCE public / basic / post）。
  - `basic|post` のときだけ `client_secret`（秘匿入力・eye / 保存後は **伏字** + 「再入力」で上書き）。**PKCE public 時は secret 欄を隠す**（入力負荷を下げる）。
  - `redirect_uri`（**固定**・`/oauth/callback`）を **読み取り専用 + コピー**（third-party 側に登録させる）。
  - none / bearer のときは「ここで鍵は登録しない」旨のインライン注記。
- 採寸: フォーム入力 `radius:7px; padding:8px 11px`、oauth サブカード `border:1px var(--cw-accent)/0.2; radius:11px`、
  セグメント `bg:var(--cw-card); padding:3px`（選択 = `bg:var(--cw-accent)` + 白文字）。

### B — Chat Panel Settings →「MCP サーバー」タブ（per-user・接続管理）★ 一番リッチ

現状プレースホルダ「MCP サーバー管理は V2 で提供されます」を本実装に置換。既存 Settings の 2-pane・admin nav 内。
**接続操作は本人（per-user）**。`McpServersPane.tsx` / `prototype/mcp-servers.jsx` 参照。

- ペイン: `padding:22px 26px 36px`。PaneHeading + SectionLabel（「接続できるサーバー」+「接続はあなた個人」バッジ）。
- 行（`McpServerRow`）: カード `bg:var(--cw-card); border:1px var(--cw-card-border); radius:11px; padding:13px 15px`。
  `ServerTile`(36px) + name + **AuthBadge** + 状態に応じた trailing。

**各サーバー行で扱う状態（webhook-notify の状態設計を踏襲）**:

1. **未接続**: server 情報 +「接続」ボタン。authType で文言/アイコン/hint を変える
   （none=即接続・bearer=「接続」(鍵)・oauth=「認可して接続」(盾)）。下段に「接続後に N ツール」。
2. **接続中（bearer）**: 行が展開し API キー入力（秘匿・eye トグル）→「接続して確認」→ **tools/list 疎通確認**（スピナー）→ per-user 保存。
3. **接続中（oauth）**:「認可」→ **認可ポップアップ**（既存 kintone OAuth connect の見た目を流用 = 擬似ブラウザ chrome +
   要求スコープ + 「認可する」）→ 閉じると **交換中スピナー**（code → token）。
4. **接続済**: 緑ドット +「接続済み」+ アカウント表記 + **公開ツール一覧**（`tools/list`、件数バッジ + 折りたたみ）+
   「接続テスト」+「解除」。
5. **接続テスト結果**: 送信中（`tools/list 送信中…`）→ 成功（`疎通 OK · N ツール`）/ 失敗（エラー文）。
6. **解除確認**: インライン warn ボックス（`bg:var(--cw-warn-soft); border:1px #f0c98a`）。webhook-notify 状態 5 と同型。
   「エージェントの attach 設定はそのまま残る」旨を明記。
7. **失効 / エラー**: `mcp_oauth_validate=invalid` のとき「要再接続」+ warn バナー + 再接続導線。
   **#124**: 確定 invalid のときだけ出す（一時的な失敗で再認可を促さない＝誤検知でのバナー乱発を避ける）。
8. **空状態**: admin 未定義 →「接続できる MCP サーバーがありません」+ 管理者依頼 / Plugin Config 導線。

- **権限による出し分け**（既存 Deployments の作法）: 一般ユーザーは左 nav が限定表示、admin は全 nav。
  接続そのものは role を問わず per-user（接続は本人の操作）。

### C — Agent 詳細編集の「MCP」セクション（#40 連動・最小）

`AgentDetailModal` 内に挿入。`McpAttachSection.tsx` / `prototype/mcp-attach.jsx` 参照。

- 登録済み MCP サーバーの **attach トグル**（iOS 風 32×18）+ attach 済みサーバーの **tool 単位 ON-OFF**（チェックリスト）。
  サーバー行のヘッダ チェックは all/partial/none（indeterminate）。既存の tool/skill ON-OFF と同型。
- 各行に **per-user 接続の参考表示**（接続済 / 未接続の小ドット）。**ここでは接続操作をさせない**（責務は「利用」）。
- 末尾に注記:「有効化したツールは、実行するユーザーが接続済みのときだけ動作します」。

---

## 設計判断（§5 の UX 論点への回答）

1. **authType による接続フローの出し分け** → 行 UI の trailing ボタンの文言・アイコン・hint で「次に何が起きるか」を予告。
   none は即完了、bearer はインライン入力欄、oauth は認可ポップアップ。（`prototype` の「認証方式による接続フローの出し分け」カード参照）
2. **公開ツール一覧（tools/list）** → 接続済みカード内に **件数バッジ + 折りたたみ**（`ToolList`）。常時展開せず情報密度を抑える。
3. **接続(B) と 利用(C) の責務分担** → B の問いは「**自分は接続済みか**」、C の問いは「**この Agent で使うか**」。
   C では接続状態を小さな参考表示に留め、接続操作は B（設定 → MCP）へ誘導して混同を防ぐ。
4. **A ↔ B の往復** → A で admin がカタログ定義 → B でユーザーが接続。B の空状態・末尾 info から Plugin Config へ導線。
5. **失効時（#124）** → 確定 invalid のときだけ「要再接続」。一時失敗では出さない（過剰に脅かさない方針）。

---

## Interactions & Behavior

- **接続（none）**: `onConnect(server)` → 即 connected（緑ドット）。入力なし。
- **接続（bearer）**: 行展開 → API キー入力 →「接続して確認」で `tools/list` 疎通（成功で per-user 保存・伏字化）。
- **接続（oauth）**: 「認可」→ ポップアップ（`/oauth/callback` 固定 redirect）→ 認可 → `code` を `access_token` に交換（スピナー）→ connected。
- **接続テスト**: `onTest(serverId)` を await。`sending → success/fail` をインライン表示。成功時はツール数を表示。
- **解除**: インライン確認 → `onDisconnect(serverId)`。per-user 接続のみ削除（attach は残す）。warn トーンで誤操作防止。
- **再接続（invalid）**: 確定 invalid のときだけ導線を出す。oauth=再認可 / bearer=再入力。
- **attach（C）**: controlled。サーバー トグルで全 tool ON/OFF、行展開で tool 単位 ON/OFF。`onChange(McpAttachment[])`。
- **秘匿運用**: client_secret / API キー / token は **パスワード同様**。保存後は伏字、生値を再表示しない（再入力で上書き）。
- **トランジション**: 枠線/フォーカス ~120ms、行の展開は軽い fade。重い演出なし（既存 Settings に合わせ抑制）。
- **レスポンシブ**: Chat Panel 幅 560px 前後、Plugin Config は admin ページ幅。狭幅でも 1 カラムで成立。

## State Management

- **A（フォーム）**: `McpServerForm` は controlled。`canSaveServerDef(draft)` で保存活性。保存時 `onSave(def, secret?)`
  （secret は basic|post かつ新規入力時のみ）。サーバは保存後 client_secret を返さず `hasSecret:true` のみ → 伏字表示。
- **B（接続）**: 親が `connections: Record<serverId, McpConnection>` を保持。行の内部一時状態は
  `phase`（idle / bearer-input / bearer-verifying / oauth-authorizing / oauth-exchanging）, `test`, `confirm`, 入力テキスト。
  保存後の鍵/トークンは state にもログにも残さない。
- **C（attach）**: 親が `McpAttachment[]` を保持。`onChange` で受ける。`enabledTools` 空 = attach OFF。
- **失効**: `status:'invalid'` はサーバー（`mcp_oauth_validate`）由来。UI は確定 invalid のみ再接続導線を出す。

## Design Tokens

CSS 変数（`--cw-*`、light 既定 + dark 対応）。既存 Settings（richColors light）と同一語彙。

| トークン | light | 用途 |
|---|---|---|
| `--cw-bg` | `#faf8f3` | ペイン背景 |
| `--cw-card` | `#ffffff` | カード / 入力 / モーダル |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | カード枠 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | 伏字フィールド地 / 淡い面 / nav 地 |
| `--cw-border` | `rgba(35,18,0,0.10)` | 罫線・区切り・入力枠 |
| `--cw-border-strong` | `rgba(35,18,0,0.18)` | 破線カード枠 |
| `--cw-text` | `#231200` | 本文 |
| `--cw-muted` | `#6b5f4a` | サブ・hint |
| `--cw-subtle` | `#a89d85` | 補助・placeholder・伏字 |
| `--cw-accent` | `#0d9488` | アクセント（ティール）/ oauth 識別色 |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | アクセント淡色 / テストボタン地 |
| `--cw-on-accent` | `#ffffff` | アクセント上の文字 |
| `--cw-warn` | `#b45309` | 失効・解除・上書き注意 / bearer 識別色 |
| `--cw-warn-soft` | `#fef3c7` | 警告ボックス地（枠 `#f0c98a`） |
| `--cw-danger` | `#dc2626` | テスト失敗 |
| `--cw-success` | `#047857` | テスト成功 |
| 緑ドット | `#22c55e` | 接続済みステータス点 |

- **authType 識別色（AuthBadge / ServerTile / hint の差し色）**: none=slate `#64748b`、bearer=amber `#b45309`、oauth=teal `#0d9488`。
  `MCP_AUTH` に 1 箇所集約。色だけでも識別できるための差し色（`ModelBadge` / `PlatformBadge` と同じ考え方）。
- **角丸**: 入力/伏字 7px、ボタン 7px、小バッジ 3px、サーバー行 11px、カード/サブカード 12px、モーダル 14px、トグル/pill 999px。
- **影**: 原則なし。モーダル/ポップアップ `0 20px 60px rgba(0,0,0,0.25-0.28)`。
- **タイポ**: 本文 `Noto Sans JP` 13px / 行高 1.4。URL・endpoint・client_id・ツール名・バッジは `JetBrains Mono`。
  ラベル 11.5px/600、hint 10.5px、見出し 10.5px/700/uppercase。

## Assets

- アイコンはすべて **インライン SVG**（plug / link / unlink / key / shield / globe / eye / eye-off / check / alert /
  info / spinner / copy / chevron / refresh / wrench / lock / pencil / trash / back）。外部アセットなし。
  対象コードベースに既存アイコンセットがあれば差し替え可。
- ブランド/画像アセットなし。サービスの公式ロゴは使わず、頭文字タイル + authType の差し色で中立に表現。

## Files

| ファイル | 役割 |
|---|---|
| `mcpRegistry.ts` | **型 + ヘルパー（本体）**。`McpServerDef` / `McpConnection` / `McpAttachment` / `MCP_AUTH` / `TOKEN_AUTH` / `REDIRECT_URI` / `maskedSecret` / `isHttpsUrl` / `needsClientSecret` / `canSaveServerDef` / `connectLabel` / `attachHeadState`。フレームワーク非依存 |
| `McpServersPane.tsx` | **B 参照実装**。per-user 接続管理（8 状態・authType 分岐・接続テスト・解除・伏字）。`AuthBadge` / `ServerTile` を export |
| `McpServerForm.tsx` | **A（MCP カタログ）参照実装**。追加・編集フォーム（oauth 展開・client_secret 伏字・redirect_uri コピー）。`AuthTypeSegment` を export |
| `ConfigScreen.tsx` | **A（Plugin Config 全体）再設計 参照実装**。2 ゾーン左レール `Shell` / `ConfigSetupWizard`（初回）/ `ConfigStatusView`（設定済み・部分更新）/ MCP ゾーン差し込み口 |
| `McpAttachSection.tsx` | **C 参照実装**。Agent の attach + tool 単位 ON/OFF（controlled） |
| `prototype/MCP Registration - UX Exploration.html` | スタンドアロン検討版（全状態・3 サーフェス・kintone 文脈・設計根拠・UI コピー） |
| `prototype/mcp-data.jsx` | プロトの土台（authType メタ / カタログ・接続・tools モック / アイコン / `AuthBadge` / `ServerTile` / 共通アトム） |
| `prototype/mcp-servers.jsx` | B 本体（`McpServerRow` 8 状態 / `OAuthPopup` / `McpServersPane` / 空状態） |
| `prototype/mcp-config.jsx` | A 本体（`McpServerForm` / `McpConfigList` / 旧 `PluginConfigHost`） |
| `prototype/mcp-config-screen.jsx` | **A 再設計**（`ConfigShell` 2 ゾーン / `ConfigSetupWizard` / `ConfigStatusView` / `StatusRow`） |
| `prototype/mcp-attach.jsx` | C 本体（`McpAttachRow` / `McpAttachSection`） |
| `prototype/mcp-context.jsx` | ホスト（`McpSettingsShell` 2-pane / `AgentMcpModal` / `ChatPanelHost`） |
| `prototype/mcp-explore.jsx` | 設計根拠（3 層モデル / authType 出し分け / B・C 責務分担 / 往復・失効 / 状態一覧 / UI コピー） |
| `prototype/{wedge-header,wedge-settings,deployments-data,design-canvas}.jsx`, `prototype/styles.css` | プロト実行用の土台（トークン / グリフ / モデルバッジ / design canvas / フォント） |

### 組み込み手順（要約）

1. **A（Plugin Config 全体）**: `ConfigScreen` の 2 ゾーン左レールを採用。**接続セットアップ**は未設定時ウィザード / 設定済み時ステータス+編集に切替。
   既存機能（Cloudflare デプロイ / Worker URL / Anthropic Key / cybozu OAuth 登録案内 / kintone client）は維持し、hifi トーンへ。
   **MCP サーバー**は別ゾーンとして常時 CRUD。`McpConfigList` + `McpServerForm` でカタログを操作。
   保存時 `onSave(def, secret?)`。client_secret は config に保存せず Worker 注入（保存後は `hasSecret` のみ返す）。
   秘匿値は接続セットアップの API キー/secret と同じ伏字・再入力更新で統一。
2. **B**: Settings 左 nav の「MCP サーバー」プレースホルダを `McpServersPane` に置換。
   `servers`（カタログ GET）+ `connections`（per-user GET）を渡し、`onConnect` で authType 別フローを起動、
   `onTest` で `tools/list` 疎通、`onDisconnect` で per-user 接続を削除。
3. **C**: `AgentDetailModal` の「ツール」近傍に `<McpAttachSection servers connections value={attachments} onChange />` を挿入。
   保存時に Agent ごとの `McpAttachment[]` を永続化。
4. 失効は `mcp_oauth_validate` の確定 invalid のみ「要再接続」を表示（#124）。
5. 認証方式の判定・伏字運用・PKCE/secret の要否は `mcpRegistry.ts`（`needsClientSecret` / `canSaveServerDef`）を参照。

## スコープ外（本設計では扱わない）

- MCP-spec 準拠の OAuth 自動ディスカバリ（WWW-Authenticate / RFC8414 / dynamic client registration）。admin が endpoints/client を明示設定する方式。
- ユーザーによる任意 URL の自由登録（カタログは admin 管理）。
- 個別ツール（GitHub 等）の中身。本件は基盤（#17 が最初の利用例）。
- kintone / notify 既存連携の作り替え（据え置き・互換維持）。
