# プロダクト要求定義書 (Product Requirements Document)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.3 (V1 wedge MVP — プリセット / Designer / Custom Skills 反映)
**最終更新日**: 2026-06-07

> **2026-05-17 アップデート**: プロダクト初期ターゲットを「情シス・カスタマイザー」に定め、wedge 戦略を追加。詳細仕様は [.steering/20260517-customizer-wedge-design/](../.steering/20260517-customizer-wedge-design/) を一次ソースとし、本書は概要をリンクで案内する。V1 完了後に本書を全面的に永続化更新する予定。
>
> **2026-06-07 アップデート**: V1 wedge MVP の主要機能群が出揃ったため永続化更新を実施。Custom Agent 永続化 / Agent 詳細編集 (F-16, 2026-06-01)、プリセットエージェント + クイックアクション (F-17, 2026-06-06)、エージェントデザイナー (F-18, 2026-06-07) を Phase 2 の正式機能として記載。Customizer Wedge Phase 1 (preview/apply/rollback) は 2026-05-30 完了済み。次は LP ローンチおよび Agent ACL (進行中) を経て V2 へ。

---

## 1. プロダクトビジョン

### 1.1 ビジョン
Claude Managed Agents API を活用した「バックグラウンドで自律的に動く AI 協働エージェント」を kintone 上に提供し、**kintone を取り巻くあらゆる業務をチャット UI 一つで完結させる**ことを目指す。

### 1.2 目的
- kintone ユーザーの日常業務(検索・集計・データ登録・更新・削除)を自然言語で実行可能にする
- 長時間かかる業務を AI が非同期で自律的に遂行し、ユーザーを待ち時間から解放する
- 将来的には kintone カスタマイズ/プラグイン開発、外部 SaaS 連携、自律ワークフローまで拡張し、kintone を業務ハブ化する

### 1.3 プロダクトコンセプト
> **「kintone のサイドパネルに、いつでも相談できる AI コワーカーが常駐する」**
> ユーザーはチャットで依頼するだけで、AI が裏でデータ操作や一連のタスクを遂行し、結果を報告する。

---

## 2. ターゲットユーザー

| ペルソナ | 役割 | 期待する価値 | 戦略上の位置づけ |
|----------|------|--------------|---------------|
| **情シス・カスタマイザー** ⭐ | JavaScript カスタマイズ・プラグイン開発を担当する社内開発者 | カスタマイズ JS 生成 → preview → apply → rollback の wedge ループ完結 | **初期 wedge ターゲット** (差別化・GTM・最初のヘビーユーザー獲得の起点) |
| **一般業務ユーザー** | 営業、人事、カスタマーサポート等で kintone を日常利用 | レコード操作の手間削減、自然言語での業務指示 | wedge 後の **broaden 対象** (MVP から提供継続) |
| **kintone 管理者** (= Plugin 管理者) | 社内のアプリ設計・運用 + Plugin Config / Settings View での Agent / Skill キュレーション | 業務ユーザーと情シスの両方に最適化された Agent を提供 | **隠れペルソナ** (情シスと兼任ケース多) |

> 初期 wedge ターゲットを情シス側に置く戦略の根拠 (支払い意思 / ユーザー深度 / 差別化 / コミュニティ) は [Issue #9 (umbrella)](https://github.com/sugimomoto/CoworkAgentForKintone/issues/9) および [.steering/20260517-customizer-wedge-design/requirements.md](../.steering/20260517-customizer-wedge-design/requirements.md) Section 2 に詳述。

---

## 3. 課題とニーズ

### 3.1 現状の課題
- kintone の標準機能ではレコード一括操作や横断検索に限界があり、CSV 出力/編集/取込などの作業負荷が大きい
- 複雑なクエリは kintone のクエリ構文を覚える必要があり、非エンジニアには敷居が高い
- 既存の AI プラグイン(チャット系)は対話が同期的で、長時間の自律タスクを任せられない
- kintone から他 SaaS への連携は個別実装が必要で、中小規模ユーザーには導入障壁が高い

### 3.2 本プロダクトが解消するニーズ
- 自然言語で kintone を操作したい
- 長時間の作業 (大量データ更新、複雑な集計) を AI に任せて他作業を進めたい
- 将来的には kintone を起点に他 SaaS 連携まで一気通貫で指示したい

---

## 4. 差別化ポイント

| 観点 | 既存 AI プラグイン | **Cowork Agent for kintone** |
|------|-------------------|-----------------------------|
| 実行モデル | 同期型チャット | **非同期バックグラウンド自律実行** |
| 操作範囲 | 主に Q&A・要約 | **データの作成/更新/削除まで実行** |
| 対象業務 | kintone 内で完結 | **将来的に kintone 外の業務(SaaS 連携、カスタマイズ開発)まで拡張** |
| 技術基盤 | 汎用 LLM API | **Claude Managed Agents (Vault / Environment / Custom Tool)** |

---

## 5. 機能スコープ

### 5.1 MVP (フェーズ 1)

対象: **kintone レコード操作のチャットベース実行**

| ID | 機能 | 内容 |
|----|------|------|
| F-01 | チャット UI | レコード一覧画面のサイドパネルに表示されるチャットパネル |
| F-02 | レコード検索・集計・要約 | 自然言語クエリ → kintone API で取得 → 要約・集計結果を提示 |
| F-03 | レコード一括作成 | ユーザー指示に基づきレコード追加 |
| F-04 | レコード一括更新 | 条件指定による一括更新 |
| F-05 | レコード一括削除 | 条件指定による一括削除 |
| F-06 | レコード間データ連携・転記 | 参照元アプリ → 参照先アプリへの転記、アプリ横断処理 |
| F-07 | 実行計画の提示と承認 (HITL) | 破壊的操作(更新/削除)は実行前に計画を提示、チャット上での「許可」で実行 |
| F-08 | 非同期ジョブ進捗表示 | バックグラウンド実行中のタスク状態をチャット内に表示 |
| F-09 | ユーザー単位の会話セッション | ユーザーごとに全アプリ横断の単一セッションを維持 |
| F-10 | プラグイン設定画面 | Anthropic API Key、Vault 登録用 kintone ログイン情報等の管理 UI |

### 5.2 フェーズ 2 (V1 wedge MVP — 2026-05-17 戦略変更後)

**ゴール**: 情シス・カスタマイザーが「カスタマイズ JS 生成 → 適用 → ロールバック」を会話だけで完結できる。

| ID | 機能 | 関連 Issue |
|----|------|-----------|
| F-11 | **Built-in Agent 3 variant** (業務 / Customizer Opus / Customizer Sonnet) + Header プルダウン切替 | [#39](https://github.com/sugimomoto/CoworkAgentForKintone/issues/39) |
| F-12 | **Chat Panel Settings View** (admin 専用、Agent 公開トグル / Skill 同期) | [#40](https://github.com/sugimomoto/CoworkAgentForKintone/issues/40) |
| F-13 | **Plugin Config 縮小** (Skills 同期 UI を Chat Panel に完全移管) | [#41](https://github.com/sugimomoto/CoworkAgentForKintone/issues/41) |
| F-14 | **Customizer Wedge ループ** (preview → apply → rollback の 5 状態 step bar + FileTree) | [#20](https://github.com/sugimomoto/CoworkAgentForKintone/issues/20) |
| F-15 | **Custom Skills インフラ** (kintone-customize-js / kintone-plugin-development skill) + .zip/.skill アップロード対応 | [#30](https://github.com/sugimomoto/CoworkAgentForKintone/issues/30) |
| F-16 | **Agent 詳細編集 + Custom Agent 新規作成** (admin、name / icon / system prompt / skills / tools 編集 + 雛形からコピーで Custom Agent 追加 + archive 削除) | [#19](https://github.com/sugimomoto/CoworkAgentForKintone/issues/19) (closed) |
| F-17 | **プリセットエージェント + クイックアクション** (`AgentRecord.quickActions` を用いた頻出依頼のワンクリック実行 UX、業務ユーザー向け導入摩擦の低減) | [#45](https://github.com/sugimomoto/CoworkAgentForKintone/issues/45) / [#46](https://github.com/sugimomoto/CoworkAgentForKintone/issues/46) |
| F-18 | **エージェントデザイナー** (built-in 3rd variant — Agent 自体を会話で設計する Agent。`propose_agent` Custom Tool + `agent-draft` アーティファクト kind を介して新しい Custom Agent をドラフト → 承認 → 永続化) | [#48](https://github.com/sugimomoto/CoworkAgentForKintone/issues/48) |
| F-19 | **定期実行 (Deployments)** (Anthropic Managed Agents の Scheduled Deployments を利用し、エージェントを cron スケジュールで自律起動。業務ユーザーがセルフサービスで「自分の」定期実行を登録・管理、admin は全ユーザー分を管理。Settings はロールで出し分け。実行履歴から各 run の生成セッション会話を確認可能) | [#81](https://github.com/sugimomoto/CoworkAgentForKintone/issues/81) |
| F-20 | **通知拡張 (Slack / Teams / Discord Webhook)** (Agent ごとに 1 本の Incoming Webhook を admin が登録し、`send_notification` ツールで処理結果を Slack / Microsoft Teams / Discord に送信。Webhook URL は Anthropic Vault に `static_bearer` で秘匿格納し JS から読めない・ログに出さない。platform は URL ホストで自動判定。チャット・定期実行の両方で利用可) | [#13](https://github.com/sugimomoto/CoworkAgentForKintone/issues/13) |
| F-21 | **プロセス管理 (ワークフロー) 操作** (kintone のプロセス管理を Agent から実行。レコードの**ステータス変更**（単一・最大100件一括）と**作業者変更**を自然言語で。「このレコードを完了に」「未対応案件を全部○○さんに振り直し」等。業務 Agent のみに公開。ステータス変更は取り戻し不可リスクに配慮し承認カード (`always_ask`)、作業者変更は可逆なので即時。OAuth は `k:app_record:write` に含まれ追加連携不要) | [#22](https://github.com/sugimomoto/CoworkAgentForKintone/issues/22) |

詳細仕様:
- Customizer Wedge: [.steering/20260517-customizer-wedge-design/](../.steering/20260517-customizer-wedge-design/) + [.steering/20260518-customizer-wedge-actualization/](../.steering/20260518-customizer-wedge-actualization/) (Phase 1 完了 2026-05-30)
- Custom Skills: [.steering/20260516-issue-30-custom-skills-infra/](../.steering/20260516-issue-30-custom-skills-infra/)
- Agent 詳細編集 + 追加: [.steering/20260601-agent-detail-edit/](../.steering/20260601-agent-detail-edit/) (完了 2026-06-01)
- プリセットエージェント + クイックアクション: [.steering/20260606-preset-agents-one-click/](../.steering/20260606-preset-agents-one-click/) (完了 2026-06-06)
- エージェントデザイナー: [.steering/20260607-agent-designer-builtin/](../.steering/20260607-agent-designer-builtin/) (完了 2026-06-07)
- 定期実行 (Deployments): [.steering/20260614-deployments-cron/](../.steering/20260614-deployments-cron/) (完了 2026-06-14)
- 通知拡張 (Slack / Teams Webhook): [.steering/20260620-notification-slack-teams/](../.steering/20260620-notification-slack-teams/) (完了 2026-06-20)

### 5.3 フェーズ 3 (V2) 以降の候補

- **Customizer Wedge Phase 2** ([#20](https://github.com/sugimomoto/CoworkAgentForKintone/issues/20)): CSS / mobile.js / config.js 解禁、kintone-customize-js skill に該当指針追加 (Phase 1 で desktop.js のみ対応済)
- **GitHub 連携** ([#17](https://github.com/sugimomoto/CoworkAgentForKintone/issues/17)): commit / PR / 履歴管理 + Customizer の snapshot 永続化 (現状 in-memory)
- **追加 MCP Server 登録** ([#42](https://github.com/sugimomoto/CoworkAgentForKintone/issues/42)): GitHub MCP / Slack MCP 等を Settings → MCP から登録、Vault Credential 管理
- **Plugin pack ツール** ([#43](https://github.com/sugimomoto/CoworkAgentForKintone/issues/43)): cli-kintone 相当の Plugin パッケージング / アップロードを Agent から呼べる MCP ツール化
- **Memory ON/OFF トグル** ([#15 縮小](https://github.com/sugimomoto/CoworkAgentForKintone/issues/15)): Conversation View の (user × agent) auto-ensure
- **kintone MCP 機能拡充** ([#24](https://github.com/sugimomoto/CoworkAgentForKintone/issues/24) / [#22](https://github.com/sugimomoto/CoworkAgentForKintone/issues/22) / [#25](https://github.com/sugimomoto/CoworkAgentForKintone/issues/25)): 管理系 / ワークフロー / クエリ拡充
- **Agent ACL** (進行中): Agent ごとの利用ユーザー / グループ制限、管理画面からの可視化制御
- **エージェントマーケットプレイス的取り込み**: F-17 で実装したプリセット機構をベースに、GitHub 等から Custom Agent / Custom Skill を取り込む配布フローを検討

umbrella: [#44 [V2 umbrella] Phase 2 — Customizer wedge 実用化 + Settings 詳細編集 + MCP 拡張](https://github.com/sugimomoto/CoworkAgentForKintone/issues/44)

### 5.4 後回し可 / 任意 (V4 以降)

- **ドキュメント生成** ([#10](https://github.com/sugimomoto/CoworkAgentForKintone/issues/10)): 議事録、メール文面、レポート
- **外部 SaaS 連携** ([#11](https://github.com/sugimomoto/CoworkAgentForKintone/issues/11)): Salesforce / Gmail / Slack
- **自律ワークフロー** ([#12](https://github.com/sugimomoto/CoworkAgentForKintone/issues/12)): 条件トリガー (イベント駆動)。※**定期実行 (cron)** は F-19 / [#81](https://github.com/sugimomoto/CoworkAgentForKintone/issues/81) で実装済み
- **通知機能拡張** ([#13](https://github.com/sugimomoto/CoworkAgentForKintone/issues/13)): Slack / MS Teams Webhook
- **モバイル対応** ([#4](https://github.com/sugimomoto/CoworkAgentForKintone/issues/4)): スマートフォン版 kintone 画面
- **Claude Platform on AWS** ([#32〜#38](https://github.com/sugimomoto/CoworkAgentForKintone/issues/32)): AWS 統合 / CloudTrail 監査 (エンタープライズ向け)

---

## 6. ユーザーストーリー (代表例)

### US-01: 自然言語でのレコード検索
> **As a** 営業担当者
> **I want to** 「今月の受注金額が 500 万円以上の案件を担当者ごとに集計して」とチャットで依頼
> **So that** 面倒なクエリ構文なしに即座に集計結果を得られる

### US-02: 大量レコードの一括更新
> **As a** kintone 管理者
> **I want to** 「カテゴリが空のレコードに『未分類』を設定して」と依頼し、バックグラウンド実行
> **So that** 長時間の一括処理を待たずに他の業務を進められる

### US-03: アプリをまたぐデータ転記
> **As a** カスタマーサポート担当者
> **I want to** 「問い合わせアプリの未対応レコードを案件アプリに転記して」と依頼
> **So that** 手動コピペ作業から解放される

### US-04: 破壊的操作の安全確認
> **As a** 業務ユーザー
> **I want to** 更新/削除の前に影響範囲をチャット上で確認できる
> **So that** 誤操作を未然に防げる

### US-05: カスタマイズ JS の生成と安全な適用 (Customizer wedge)
> **As a** 情シス・カスタマイザー
> **I want to** カスタマイザーエージェントに「一覧画面のステータス列を色分けして」と依頼し、生成された JS を preview → apply → 不具合があれば rollback
> **So that** kintone カスタマイズの試行錯誤をチャット上で安全に完結でき、本番影響リスクを最小化できる

### US-06: Custom Skill による組織固有ナレッジの注入
> **As a** kintone 管理者 (admin)
> **I want to** 自社のコーディング規約や利用パターンを `.skill` バンドルとして Chat Panel から同期し、エージェント全体に共有
> **So that** 個別ユーザーがプロンプトで毎回指示しなくても、エージェントが組織標準に沿った成果物を出してくれる

### US-07: 業務に合わせた Custom Agent をチャットで作る (エージェントデザイナー)
> **As a** kintone 管理者
> **I want to** 「経費精算アプリ専用の入力アシスタント Agent を作りたい」と話しかけるだけで、デザイナーエージェントが name / icon / system prompt / 推奨 skills / quickActions のドラフトを提案し、内容を確認して保存
> **So that** エージェント定義 JSON を手書きすることなく、業務に即した Custom Agent を素早く追加できる

### US-08: クイックアクションによるワンクリック実行
> **As a** 業務ユーザー (kintone 初心者)
> **I want to** チャット入力欄の下に並ぶプリセットボタン (例: 「未対応案件を集計」) を押すだけで定型作業を実行
> **So that** 自然言語で依頼する文章を考えなくても、頻出業務を即実行できる

---

## 7. 受け入れ条件 (MVP)

- [ ] レコード一覧画面のサイドパネルにチャット UI が表示される
- [ ] チャットで依頼した検索・集計処理の結果が表示される
- [ ] 破壊的操作(更新/削除)は実行前に計画が提示され、明示的な承認後のみ実行される
- [ ] バックグラウンド実行中のタスクがチャット UI 上で進捗確認できる
- [ ] チャット UI を閉じて再度開いても同一セッションの会話履歴が継続する
- [ ] プラグイン設定画面で Anthropic API Key を設定できる
- [ ] プラグイン設定画面で Vault 用の kintone ログイン情報(ID / パスワード)を登録できる
- [ ] Basic 認証経由で Custom Tool から kintone REST API にアクセスできる
- [ ] Anthropic API Key 未設定時に適切なエラーメッセージが表示される

---

## 8. 機能要件

### 8.1 UI 要件
- **配置**: kintone レコード一覧画面 (`app.record.index.show` イベントに対応) のサイドパネル
- **主要素**: 会話履歴、入力欄、実行中タスク表示、承認ボタン(破壊的操作時)
- **対応ブラウザ**: Chrome、Edge、Safari、Firefox の各最新版 (標準的な kintone サポート範囲)

### 8.2 Claude Managed Agents 連携要件
- **API Key 管理**: プラグイン管理者がプラグイン設定画面で登録。全ユーザー共用 (持ち込み方式)
- **Custom Tool**:
  - *MVP 時点の暫定セット (kintone レコード CRUD)*
    - `get_apps`: アクセス可能なアプリ一覧取得
    - `get_app_schema`: フィールド定義取得
    - `get_form_layout`: フォームレイアウト取得
    - `get_records`: レコード取得(クエリ指定・カーソル対応)
    - `add_records`: レコード一括追加
    - `update_records`: レコード一括更新
    - `delete_records`: レコード一括削除
    - `bulk_request`: 複数操作のアトミック実行
  - *V1 で追加した拡張ツール* — 詳細・最終リストは [docs/functional-design.md](functional-design.md) 参照
    - **ファイル系**: kintone 添付ファイルのアップロード / ダウンロード、Plugin 経由の自動 upload
    - **Customizer wedge 系**: カスタマイズ JS のプレビュー / 適用 / ロールバック、kintone-customize-bundle artifact 生成
    - **Agent 設計支援**: `propose_agent` (エージェントデザイナーが新 Custom Agent をドラフト提案する Custom Tool)
- **Vault**: kintone ログイン情報 (ID / パスワード) を保管し、Custom Tool から Basic 認証で利用
- **Environment**:
  - ネットワーク: `*.cybozu.com` / `*.kintone.com` / ユーザー指定のカスタムドメインへの Outbound 通信を許可
  - パッケージ: MVP 向け共通ライブラリをプリインストール(詳細は機能設計書で定義)
- **セッション**: ユーザー単位で単一セッションを継続。アプリ横断で文脈を保持

### 8.3 kintone 認証要件
- **MVP**: Basic 認証 (`X-Cybozu-Authorization` ヘッダ、ログイン名 + パスワード)
- **将来**: OAuth、API トークン認証への拡張を考慮した実装

### 8.4 対象 kintone 環境
- **プラン**: kintone スタンダードコース
- **スコープ外 (MVP)**: ゲストスペース、セキュアアクセス、IP 制限環境、ライトコース
- **対応画面**: レコード一覧画面 (PC 版)

---

## 9. 非機能要件

### 9.1 対応環境
- **デバイス**: PC のみ (フェーズ 2 でモバイル対応検討)
- **ブラウザ**: 標準的なモダンブラウザ (Chrome / Edge / Safari / Firefox)

### 9.2 パフォーマンス
- MVP では具体的な数値目標は設けない (運用を通じてベースラインを計測後、次フェーズで策定)

### 9.3 データ保護 / セキュリティ
- **Anthropic API へのデータ送信**: Claude Managed Agents API の利用規約を尊重する前提 (本プラグイン側では追加のマスキング・同意取得機構は実装しない)
- **API Key**: Anthropic API Key は「ユーザー持ち込み」方式。本プラグインは API Key を中継のみし、Anthropic 以外の第三者に送信しない
- **認証情報**: kintone ログイン情報は Managed Agents の Vault に保管し、プラグイン内部では平文保持しない
- **コード配布**: OSS として公開するため、認証情報がコードや設定ファイルに埋め込まれない設計を徹底

### 9.4 可用性
- Claude Managed Agents API および kintone REST API の可用性に依存

---

## 10. ビジネス要件

### 10.1 配布・ライセンス
- **配布形態**: OSS (GitHub 公開)
- **ライセンス**: (要決定 — 候補: MIT / Apache-2.0)
- **配布チャネル**: GitHub リポジトリ
- **ライセンスキー検証**: なし (OSS のため)

### 10.2 コスト構造
- **Anthropic API 利用料**: ユーザー側負担 (API Key 持ち込み方式)
- **kintone 利用料**: ユーザー側既存契約
- **プラグイン本体**: 無償

---

## 11. 成功の定義

### 11.1 MVP 時点
- kintone スタンダード環境に OSS として公開・インストール可能
- 上記 7. の受け入れ条件をすべて満たす
- ドキュメント (README、セットアップ手順) が整備され第三者がインストール・利用可能

### 11.2 中長期
- GitHub スター数、インストールユーザーからのフィードバック収集
- フェーズ2 (開発者支援、SaaS 連携、自律ワークフロー) への機能拡張が、MVP アーキテクチャ上で無理なく行える

---

## 12. 制約事項・前提条件

- Claude Managed Agents API (Beta) の仕様変更に追随が必要
- kintone REST API の Basic 認証が利用可能なこと (kintone 側管理者設定に依存)
- Anthropic API Key をユーザー自身が取得・保有していること
- 対象環境は MVP 時点では kintone スタンダードコース PC 版に限定

---

## 13. 用語 (暫定、正式版は `glossary.md` で定義)

- **Cowork Agent**: 本プロダクトの AI エージェント本体
- **Custom Tool**: Claude Managed Agents がエージェント実行中に呼び出す関数群 (本プラグインでは kintone 操作 API)
- **Vault**: Claude Managed Agents の秘密情報保管機構
- **Environment**: Claude Managed Agents のエージェント実行環境 (サンドボックス)
- **Session**: Claude Managed Agents の会話セッション(文脈保持単位)
- **HITL (Human-in-the-Loop)**: 破壊的操作実行前の人間による承認プロセス
- **Built-in Agent**: Plugin 同梱の auto-ensure 対象 Agent (V1 では 3 variant: 業務 / カスタマイザー / デザイナー)
- **業務エージェント / カスタマイザーエージェント / デザイナーエージェント**: Built-in Agent の用途別呼称
- **Variant / variantGroup**: 同じ purpose で model だけ違う Agent (例: カスタマイザー Opus / Sonnet) をまとめる識別子
- **Custom Agent**: admin がエージェントデザイナー経由または手動で追加する組織固有 Agent (永続化対象)
- **Settings View**: Chat Panel 内の admin 専用設定画面 (2-pane、Artifact ペインを置き換える)
- **wedge / wedge ループ**: 情シス向け差別化機能 (カスタマイズ JS 生成 → preview → apply → rollback)
- **Custom Skill**: 組織固有ナレッジを `.skill` バンドルとしてエージェントに注入する仕組み (kintone-customize-js / kintone-plugin-development を同梱)
- **quickActions**: AgentRecord に紐づくプリセット依頼文の配列。Composer 下にボタンとして並び、ワンクリックで実行される
- **agent-draft / propose_agent**: エージェントデザイナーが新 Custom Agent を提案するための artifact kind と Custom Tool
- **kintone-customize-bundle**: Customizer wedge が生成する JS バンドルの artifact kind (FileTree + preview/apply/rollback ステート)

---

## 14. 関連ステアリングドキュメント

特定の機能追加・戦略変更ごとの作業単位ドキュメントは `.steering/[YYYYMMDD]-[タイトル]/` に格納。本書 (永続的) との関係性は [CLAUDE.md](../CLAUDE.md) を参照。

| ステアリング | 内容 | ステータス |
|---|---|---|
| [.steering/20260517-customizer-wedge-design/](../.steering/20260517-customizer-wedge-design/) | Customizer wedge 戦略 (情シス向け差別化) の要求 / 実装設計 / タスク分解 | V1 着手中 ([#9 umbrella](https://github.com/sugimomoto/CoworkAgentForKintone/issues/9)) |
| [docs/design-handoff/customizer-wedge/](design-handoff/customizer-wedge/) | Claude Design ハンドオフバンドル (HTML/JSX プロトタイプ + 設計経緯チャット) | UI 仕様の一次ソース |
