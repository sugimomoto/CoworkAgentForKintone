# 追加依頼プロンプト — Plugin Config 画面の design 化 + MCP カタログ統合

> これは `design-request.md`（#42 MCP UI 依頼）の **Surface A（Plugin Config）に関する補足プロンプト**。
> Plugin Config 画面はこれまで **デザインハンドオフを経ずに機能優先で実装**されており、現状デザインが
> Claude Design に渡っていない。今回 MCP カタログ（Surface A）を足すついでに、**Plugin Config 全体を
> 既存デザインシステムに乗せ直し**、MCP を後付けでなく**統合された形**で設計してほしい。

---

## この追加依頼の狙い
1. **現状の Plugin Config の design 化**: 機能はそのままに、Settings / webhook-notify と同じ hifi トーンへ。
2. **MCP カタログ（Surface A）の統合**: 未整備の画面に貼るのではなく、再設計の中に自然に組み込む。

---

## 現状の Plugin Config（実態。これが今まで未ハンドオフだった画面）
- **環境**: kintone のプラグイン設定ページ内に表示される admin 専用画面（Chat Panel とは別の表示面・別チラシ）。
  React + Tailwind、`cowork-agent-root` + `--cw-*` トークンは使用済み（ただし hifi 調整は未実施）。
- **形**: 単一スクロール、`max-width:720px`, `padding:24px`。`bg-card`/`border-card-border`/`rounded-12` の
  セクションカードを縦積みした **4 ステップウィザード**。見出し 14px/semibold、ラベル 12px、入力は `font-mono` 12px、
  アクセント塗りボタン。秘匿入力は `PasswordInput`（伏字 + 表示トグル）。保存済みは上部に再保存の注意バナー。
- **ステップ構成（機能は保持してほしい）**:
  - **Step 0**: Cloudflare Workers デプロイ（任意）— Account ID + API Token + 「デプロイ」ボタン + 進捗/エラー。
  - **Step 1**: Worker URL + Anthropic API Key（秘匿）。
  - **Step 2**: cybozu.com OAuth クライアント登録の**案内**（リダイレクト URI のコピー + cybozu 管理画面へのリンク +
    「手順詳細」アコーディオン）。Worker URL 未入力時は dim。
  - **Step 3**: kintone OAuth `client_id` + `client_secret`（秘匿）。
  - 末尾: 「保存」「キャンセル」。保存は setProxyConfig を直列実行 → setConfig。
- **再保存セマンティクス**: 一度保存後は、**入力した secret に対応する proxy 設定だけ**更新（空欄は据え置き）。
  この「初回フルセットアップ / 以降は部分更新」の二面性が UX 上のポイント。

> 補足: 細かな実装（setProxyConfig の直列実行・proxy 前方一致）は **再設計対象外**（裏方）。
> ただし「secret は伏字・再入力で更新」「client_id は公開識別子」という扱いは UI に反映してほしい。

---

## 設計してほしいこと
### (1) Plugin Config 全体の hifi 化
- 既存 Settings / webhook-notify と同一語彙（`--cw-*`、クリーム×ティールのペーパー UI、角丸・余白・タイポ）。
- **「初回セットアップウィザード」と「設定済み後の管理画面」の二面性**を、どう IA で見せるか提案してほしい。
  - 現状は同じ縦積みウィザードを保存後も使い回している。設定完了後は「ステータス + 各項目の編集」に寄せる等、
    完了後の体験を整理したい（要・改善提案）。
- ボタンの極薄シャドウなど、現状の手作り感が残る箇所は design システムに合わせて整える
  （例: 影は FAB/Settings と同基準へ。`0 1px 3px rgba(0,0,0,0.04)` のような極薄は使わない）。

### (2) MCP カタログ（Surface A）の統合
`design-request.md §1 Surface A` の内容を、この Plugin Config 再設計の**一部として**配置する。
- **配置の IA を提案**してほしい: 「Step 4: 追加 MCP サーバー」として連番に足すのか、
  あるいはセットアップ（Worker/OAuth）と**運用設定（MCP カタログ）を別ゾーン**に分けるのか。
  - 注意: Worker/kintone OAuth は **初回 1 回のセットアップ**だが、MCP カタログは **継続的な CRUD**。
    性質が違うので、ウィザードに無理に連番接ぎするより独立した「MCP サーバー」管理ブロックが自然かも（要提案）。
- MCP サーバーの**一覧 + 追加/編集/削除フォーム**（name/url/authType、OAuth は endpoints+client_id+scope+
  token_endpoint_auth、basic/post 時 client_secret 伏字、redirect_uri の表示コピー）。
- 秘匿値（client_secret）は Step1/3 の API Key/secret と同じ伏字・再入力更新の作法で統一。

---

## 制約・トーン（再掲）
- admin 専用 / kintone プラグイン設定ページ内 / `--cw-*` トークン / light・dark 両対応。
- 秘匿値はパスワード同様（保存後は生値非表示・再入力で更新）。
- 既存機能（Cloudflare デプロイ / Worker URL / Anthropic Key / cybozu OAuth 登録案内 / kintone client）は維持。
- 裏方（setProxyConfig の直列実行・proxy 前方一致）は再設計不要。

## 委ねる UX 論点
1. セットアップ（1回）と運用設定（MCP カタログ＝継続 CRUD）の **IA 分離 / 統合**の最適解。
2. 「設定完了後」の Plugin Config 体験（ウィザードのまま vs ステータス+編集ビュー）。
3. MCP の OAuth 設定フォーム（endpoints/client/secret/auth type）の入力負荷をどう下げるか
   （プリセット例・redirect_uri の自動表示・PKCE public 時は secret 欄を隠す等）。

## 期待成果物
`design-request.md §7` と同じく `docs/design-handoff/mcp-registration/` に統合。Plugin Config 分の参照実装は
`McpServerForm.tsx`（フォーム）に加え、必要なら `ConfigScreen` 再設計版のリファレンス（または採寸 + 既存
`ConfigScreen.tsx` への差分指示）を含めてよい。
