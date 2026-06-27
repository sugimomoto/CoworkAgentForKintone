# Claude Design 依頼ブリーフ — 追加 MCP Server 登録 + 接続管理 UI（#42）

Cowork Agent for kintone に「**ユーザーが必要とするリモート MCP を柔軟に追加して使える**」機能の UI を設計依頼する。
成果物は既存ハンドオフ（`docs/design-handoff/webhook-notify/` 等）と同じ流儀の **hifi 仕様 + 参照 TSX + prototype**
を `docs/design-handoff/mcp-registration/` として作ること。

このブリーフは「何を設計してほしいか」の input。採寸の最終確定は Claude Design 側に委ねるが、
**既存の意匠・パターンを最大限流用**してほしい（新規発明は最小に）。

---

## 0. 大前提（プロダクトモデル = Model A）
kintone OAuth の仕組みを「複数 MCP サーバー」に一般化したもの。責務を3層に分離する:

| 層 | 内容 | スコープ | 画面 |
|---|---|---|---|
| ① **サーバー定義（カタログ）** | name / URL / 認証方式 /（OAuth）endpoints・client_id・secret | **テナント共有**（admin が定義） | **Plugin Config**（kintone 管理画面） |
| ② **接続（認証情報）** | 各ユーザーが自分のアカウントで接続（OAuth 認可 or トークン入力） | **per-user** | **Chat Panel Settings → MCP** |
| ③ **attach** | どのエージェントでそのツールを使うか / tool ON-OFF | 登録は全体 + Agent 個別 | **Agent 詳細編集（#40）** |

> 重要: admin が「使える MCP サーバーのカタログ」を定義し、**各ユーザーはそこから自分のアカウントで「接続」する**。
> ユーザーが任意 URL を自由登録するのではない（kintone 連携と同じ思想）。

認証方式は3種: `none`（認証なし公開）/ `bearer`（API キー / PAT）/ `oauth`（PKCE。public 優先・confidential も可）。

---

## 1. 設計してほしい 3 サーフェス

### Surface A — Plugin Config「MCP サーバー」セクション（admin・テナント定義）
kintone プラグイン管理画面（Chat Panel とは別環境。既存 Plugin Config の意匠に合わせる）。
- 登録済みサーバーの**一覧**（name / URL / authType バッジ）+ 追加 / 編集 / 削除。
- **追加・編集フォーム**:
  - 共通: `name`, `url`(https), `authType`(none | bearer | oauth)。
  - oauth 時のみ展開: `authorization_endpoint`, `token_endpoint`, `client_id`, `scope`,
    `token_endpoint_auth`(none=PKCE public / basic / post)。basic|post のとき `client_secret`（秘匿・保存後伏字）。
  - oauth の補足: redirect_uri は固定（Worker `/oauth/callback`）を**表示してコピーできる**と良い（third-party 側に登録させるため）。
- 秘匿値（client_secret）は webhook-notify と同じ**伏字運用**（保存後は生値を返さない / 再入力で上書き）。

### Surface B — Chat Panel Settings →「MCP サーバー」タブ（per-user・接続管理）★ 一番リッチ
現状プレースホルダ「MCP サーバー管理は V2 で提供されます」を本実装に置換。既存 Settings の 2-pane・admin nav 内。
**ただし接続操作は本人（per-user）**。テナント定義済みサーバー一覧に対し、各自の接続状態を出す。

各サーバー行で扱う**状態（webhook-notify の状態設計を踏襲）**:
1. **未接続**: server 情報（name/url/authType バッジ）+「接続」ボタン。
2. **接続中（bearer）**: API キー入力（秘匿・eye トグル）→ `tools/list` で疎通確認 → per-user に保存。
3. **接続中（oauth）**:「認可」→ ポップアップ（**既存 kintone OAuth connect の見た目を流用** = `ConnectKintoneButton` /
   binding フロー）→ 交換中スピナー。
4. **接続済**: 緑ドット +「接続済み」+ 公開ツール一覧（`tools/list` 結果、折りたたみ可）+「接続テスト」+「解除」。
5. **接続テスト結果**: 送信中 → 成功（ツール数）/ 失敗（エラー文）。webhook-notify のテスト UI を流用。
6. **解除確認**: インライン warn ボックス（webhook-notify 状態5 と同型）。
7. **失効/エラー**: 接続が無効（`mcp_oauth_validate=invalid`）→ 再接続導線。#124 の知見（過剰な再認可を出さない）を反映。
8. **空状態**: admin が未定義 →「管理者が MCP サーバーを登録していません」ガイダンス。

> このタブは実質「kintone 接続（ConnectKintoneButton + 再連携バナー）」を **N サーバーのリスト**に一般化し、
> **秘匿入力・接続テスト・解除**を webhook-notify から借りてきた合成。新規意匠は最小で良い。

### Surface C — Agent 詳細編集の「MCP」セクション（#40 連動・最小）
AgentDetailModal 内に、登録済み MCP サーバーの **attach ON/OFF** と、attach 済みサーバーの **tool 単位 ON-OFF**
（チェックリスト）。既存の tool/skill ON-OFF チェックリストと同型で良い。#40 本体と協調する前提の最小版。

---

## 2. データモデル（設計の前提）
```ts
type McpAuthType = 'none' | 'bearer' | 'oauth';
interface McpServerDef {              // ① カタログ（テナント / Plugin Config 保存）
  id: string; name: string; url: string; authType: McpAuthType;
  tools?: { name: string; description?: string }[];   // tools/list キャッシュ（表示用）
  authorizationEndpoint?: string; tokenEndpoint?: string; clientId?: string; scope?: string;
  tokenEndpointAuthType?: 'none' | 'basic' | 'post';  // none=PKCE public（secret不要）
  // client_secret は config に保存しない（伏字・proxy 注入）
}
// ② 接続状態（per-user）: 'unconnected' | 'connected' | 'invalid'（mcp_oauth_validate 由来）
// ③ attach: agent ごとに { serverId, enabledTools: string[] }
```

---

## 3. 必ず流用してほしい既存資産（リポジトリ内）
- **`docs/design-handoff/webhook-notify/`** ← 最重要の先行例。秘匿値の伏字運用・接続テスト・**解除（インライン確認）**・
  状態設計・トークン表をそのまま語彙として使う。`NotifySection.tsx` の構造を範に。
- **`docs/design-handoff/deployments/`** ← 2-pane Settings・admin/一般の出し分け（nav・スコープ pill）の作法。
- **既存 kintone 接続 UI**: `packages/plugin/src/desktop/ConnectKintoneButton.tsx` と再連携バナー
  （`ChatPanel.tsx` の oauth-rebind）。OAuth 接続/失効/再接続の見た目はこれに合わせる。
- **Settings 基盤**: `packages/plugin/src/desktop/settings/SettingsView.tsx` / `SettingsNav.tsx`
  （MCP nav 項目・現プレースホルダの位置）。
- **Plugin Config 画面**: `packages/plugin/src/desktop/config/`（Surface A の意匠の土台）。
- **トークン**: `docs/design-handoff/customizer-wedge/tokens.json`（`--cw-*`、light/dark）。クリーム×ティールのペーパー UI。

---

## 4. 制約・トーン
- **Fidelity: hifi**。既存 Settings / AgentDetailModal / Plugin Config と同一トーンでピクセル単位で再現可能なレベルまで。
- 配色・タイポ・角丸・余白は `--cw-*` トークンと既存ハンドオフの語彙に統一（独自パレット禁止）。
- 秘匿値（client_secret / API キー / token）は**パスワード同様**。保存後は伏字、生値を再表示しない。
- ライト / ダーク両対応。
- アイコンはインライン SVG（既存セットに寄せる。plug / link / unlink / key / shield / eye / check / alert / spinner など）。

---

## 5. 設計判断を委ねる / 解いてほしい UX 論点
1. **authType による接続フローの出し分け**を、行 UI でどう自然に見せるか（none は「接続」即完了、bearer は入力、oauth は認可ポップアップ）。
2. **公開ツール一覧（tools/list）**の見せ方（接続済みカード内の折りたたみ？ 件数バッジ + 展開？）。
3. **接続済み × 各エージェントでの利用可否（attach）**の関係を、Settings(B) と Agent 編集(C) でどう責務分担して見せるか
   （B では「自分が接続済みか」、C では「この Agent で使うか」。混同させない）。
4. **Plugin Config(A) と Settings(B) の往復**（admin がカタログ定義 → ユーザーが接続）の導線・空状態の案内。
5. **失効時(#124)** の再接続導線を、過剰に脅かさず（誤検知でバナー乱発しない方針）どう出すか。

---

## 6. スコープ外（設計しなくてよい）
- MCP-spec 準拠の OAuth 自動ディスカバリ（WWW-Authenticate / RFC8414 / dynamic client registration）。今回は admin が endpoints/client を明示設定する方式。
- ユーザーによる任意 URL の自由登録（カタログは admin 管理）。
- GitHub 等の個別ツールの中身（本件は基盤。#17 が最初の利用例）。
- kintone / notify 既存連携の作り替え（据え置き・互換維持）。

---

## 7. 期待する成果物（既存ハンドオフと同形式）
`docs/design-handoff/mcp-registration/` に:
- `README.md`（Overview / Screens(3 サーフェス) / States / Interactions / Tokens / Files / 組み込み手順）。
- 参照実装 TSX（例: `McpServersPane.tsx`（Settings B）, `McpServerForm.tsx`（Config A）, `McpAttachSection.tsx`（Agent C）, フレームワーク非依存の型/ヘルパ）。
- `prototype/`（全状態・kintone 文脈を触れるスタンドアロン版）。
- `--cw-*` トークン準拠。状態は §1 の番号を網羅。
