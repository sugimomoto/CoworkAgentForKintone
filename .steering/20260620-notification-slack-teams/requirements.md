# 要求: 通知拡張 (Slack / Teams Webhook) — #13

## 背景 / 採用方針（オーナー確定済み）
タスク完了・集計結果・重要操作などを **Slack / Microsoft Teams の Incoming Webhook** に通知する。
Issue コメントで方針は **設計A（エージェント発信）** に確定:

- 既存 Remote MCP（`@cowork-agent/kintone-mcp`）に **`send_notification` ツールを追加**し、
  エージェントがセッション内でこのツールを呼んで通知する。
- Slack / Teams の Webhook URL は **サーバ側に秘匿**し、ブラウザ JS / エージェントの文脈からは読めない。
- #81 定期実行（Deployments）で記した「通知は initial_events のプロンプト + MCP ツールで
  エージェント自身に行わせる」と整合する。定期タスクの結果通知が主ユースケース。

> ⚠️ **非決定的**: エージェント発信のため、呼び忘れ・run 失敗時には飛ばない。
> **失敗通知を含む決定的な通知（ホスト発信 / Native Webhooks）は本 Issue の対象外 → #93**。

## ユーザーストーリー
- 業務ユーザーとして、Slack（または Teams）の Incoming Webhook URL を設定画面で登録したい。
- 業務ユーザーとして、「集計して、結果を Slack に通知して」と頼む（or 定期実行の初回メッセージに含める）と、
  エージェントが集計後に Slack へ要約を投稿してくれる。
- 管理者として、登録した Webhook URL が**ブラウザの JS から読み取れない**ことを担保したい。

## スコープ（含む）
1. **MCP ツール `send_notification`**（Worker `@cowork-agent/kintone-mcp`）
   - 入力: 宛先プラットフォーム（slack / teams）、本文（title / text、任意で kintone レコードリンク等の構造化フィールド）。
   - 動作: 保管された Webhook URL に Slack ブロック / Teams Adaptive Card 形式で POST。
   - 結果: 成功 / 失敗を toolResult で返す（エージェントが後続応答で言及できる）。
2. **Webhook URL の登録 UI**（**Agent 設定の一部** = Agent ごとに紐付け）
   - built-in / custom 両方の Agent に、Slack または Teams の Webhook URL を**1本**設定できる（admin 操作）。
   - 保存後は伏字表示。Agent X に紐付けた Webhook へ、X のセッション/定期実行が通知する。
3. **URL の秘匿保管**: サーバ側（Anthropic Vault の environment_variable 注入 or Worker ステートフル化）。
   ブラウザ JS から URL を取得できないこと。

## スコープ（含まない / 別 Issue）
- **決定的通知 / 失敗通知 / ホスト発信 / Native Webhooks** → #93。
- **通知ポリシーエンジン**（常時 / エラー時のみ / 特定ツール時のみ）。設計A では「いつ通知するか」は
  エージェントの指示（プロンプト / 定期実行メッセージ）が担うため、ホスト側ポリシーは #93 寄り。
- Slack / Teams 以外の宛先（Discord, generic webhook 等）。
- リッチな承認連動（ボタンで承認を Slack から返す等）。

## 受け入れ条件
- [ ] AC-1: **Agent 設定（built-in / custom 両方）**で Slack / Teams Webhook URL を1本保存できる（保存後は伏字）。
- [ ] AC-2: Worker に `send_notification` MCP ツールが追加され、各 Agent のツールセットに含まれる。
- [ ] AC-3: Webhook を紐付けた Agent に「通知して」と依頼すると、**その Agent の** Webhook に整形済みメッセージが POST される。
- [ ] AC-4: **Webhook URL がブラウザ JS から読み取れない**（DevTools / store / network レスポンスに生 URL が出ない）。
- [ ] AC-5: Slack（ブロック）/ Teams（Adaptive Card）双方で表示が崩れない最小フォーマット。
- [ ] AC-6: 送信失敗（無効 URL / 4xx / 5xx）時に toolResult で失敗を返し、機密（URL）はログに出さない（sanitize）。
- [ ] AC-7: 単体テスト（Worker ツール / UI）を追加。

## 制約・非機能
- **Worker はステートレス前提**（現状 `/mcp/<domain>` は何の secret も保持しない）。これを崩すか、Vault 注入で
  解決するかは design.md の最重要論点。
- Webhook URL は秘匿対象。ログ・エラーレスポンスでマスク（既存 `sanitizeError` 流儀）。
- 既存挙動（kintone MCP ツール群 / 認証）は不変。

## design.md で決める主要論点
- **Q1（最重要）Webhook URL の保管・注入方式**:
  - (a) Anthropic Vault の `environment_variable` クレデンシャルに保存し、MCP 呼び出し時に Worker へ注入
    （Worker ステートレス維持）。Managed Agents の Vault 注入が MCP server へ環境変数を渡せるかを要検証。
  - (b) Worker を KV/D1 でステートフル化し domain キーで保管（kintone proxy 経由で書き込み、JS は読めない）。
  - (c) その他。
- Q2: 宛先の持ち方（slack/teams 各1本 / 名前付き複数 / 既定1本）。
- Q3: `send_notification` の入力スキーマ（platform 指定要否、本文の構造化レベル、kintone リンクの渡し方）。
- Q4: ビルトインエージェントへの tool 追加（#86 の toolsVersion 自動 reconcile に乗るか）と権限ポリシー（always_allow？）。
- Q5: 定期実行（#81）からの利用導線（initial_events のテンプレ / クイックアクション）。
