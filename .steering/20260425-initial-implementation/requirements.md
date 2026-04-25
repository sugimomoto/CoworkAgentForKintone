# 要求内容: 初回実装 (MVP)

**作業タイトル**: initial-implementation
**開始日**: 2026-04-25
**対象バージョン**: v0.1.0 (MVP)

---

## 1. 作業の目的

Cowork Agent for kintone の MVP (フェーズ1) を実装し、**OSS として公開可能な最小動作版** を用意する。ゴールは以下:

1. kintone スタンダード環境にインストール可能な `.zip` プラグイン
2. Claude Managed Agents API に接続し、**kintone レコード操作 (検索/集計/作成/更新/削除)** を自然言語で実行可能
3. 破壊的操作は必ず HITL 承認を経て実行
4. PyPI に公開される Python ヘルパーライブラリ `cowork-agent-kintone`
5. README とセットアップ手順が整備され、第三者がインストール・動作確認可能

---

## 2. 実装対象機能 (PRD 5.1 より)

MVP を内部的に 4 つのサブフェーズに分割して段階的に実装・検証する。各サブフェーズ完了時に動作確認・振り返りを行い、次に進む。

### Phase 1a: 最小動作確認 (UI + Agent 会話の疎通)

kintone プラグインとして表示され、Anthropic Managed Agents とチャットできる最小構成。

| ID | 機能 | 内容 |
|----|------|------|
| F-01 | サイドパネル チャット UI | Rich variant のデザイン適用、メッセージ送受信表示 |
| F-09 | ユーザー単位の会話セッション | Session の metadata 解決・継続 (kintone 操作なしでも動作) |
| F-10 | 管理者プラグイン設定画面 | Anthropic API Key 登録 + Proxy 設定保存 |

**Phase 1a の到達点**: 「Anthropic API Key を設定 → チャットを開く → 自由なテキストで会話ができる」(kintone 操作は未対応でも OK)

### Phase 1b: kintone 認証基盤 + 読取操作 + HITL 基盤

ユーザー単位の Vault / Environment を作成し、kintone REST API 読取と実行計画提示の基盤を導入する。

| ID | 機能 | 内容 |
|----|------|------|
| — | **ユーザー認証情報登録 (新規)** | チャット初回起動時にユーザーが kintone ID/PW を入力 → Vault 作成 → ユーザー専用 Environment 作成 |
| F-02 | レコード検索・集計・要約 | ヘルパーライブラリ経由で `get_records` / `get_app_schema` を実行、結果を Result カードで表示 |
| F-07 | 実行計画の提示と承認 (HITL) | Plan カード (read-only / destructive 両対応) の表示と承認フロー基盤 |
| F-08 | 非同期ジョブ進捗表示 | Progress カードによる長時間タスク可視化、パネルを閉じても継続・復元 |

**Phase 1b の到達点**: 「ユーザーが kintone 認証情報を登録 → 自然言語でレコード検索・集計を依頼 → Progress / Result カードで結果確認」

### Phase 1c: kintone 書き込み操作

破壊的操作の実行を解禁し、HITL 承認フローを完成させる。

| ID | 機能 | 内容 |
|----|------|------|
| F-03 | レコード一括作成 | ヘルパーライブラリの `add_records` (100 件超は自動分割) |
| F-04 | レコード一括更新 | `update_records` (同上)、Plan (destructive) で承認必須 |
| F-05 | レコード一括削除 | `delete_records` (同上)、Plan (destructive) で承認必須 |

**Phase 1c の到達点**: 「自然言語で作成/更新/削除を依頼 → Plan (destructive) を提示 → 承認して実行 → 結果報告」

### Phase 1d: アプリ横断転記 (検証のみ、追加実装なし)

| ID | 機能 | 内容 |
|----|------|------|
| F-06 | レコード間データ連携・転記 | Phase 1b〜1c までの機能を Agent が組み合わせて自動実現。**新規実装は不要**、プロンプト調整と動作検証のみ |

**Phase 1d の到達点**: 「問合せアプリの未対応レコードを案件アプリに転記して」のような複合指示が意図通り動作することを確認

---

### 対象外 (フェーズ2以降)

- カスタム Agent 作成 UI
- モバイル対応
- Slack / Teams / Gmail / Salesforce 連携
- ドキュメント生成 (メール/議事録等)
- kintone カスタマイズ / プラグイン開発支援
- 通知機能 (Webhook)
- PII マスキング / 監査ログ
- 英語対応 (i18n 基盤は準備するが MVP は日本語のみ)

---

## 3. ユーザーストーリー (代表)

- **US-01**: 「今月の受注 500 万円以上を担当別に集計」を自然言語で実行し、結果カードで確認できる
- **US-02**: 「カテゴリ未設定レコードを『未分類』に一括更新」を依頼し、実行計画を承認してから実行できる
- **US-03**: 「問合せ未対応レコードを案件アプリに転記」を依頼し、アプリ横断でデータ移動できる
- **US-04**: 破壊的操作前に件数・影響範囲が Plan カードに表示され、承認しない限り実行されない
- **US-11**: 初回利用時に kintone ID/PW を入力し、以降は毎回入力不要
- **US-12**: 管理者が Anthropic API Key を設定するだけで組織全体にプラグインが展開できる

---

## 4. 受け入れ条件

### Phase 1a 完了条件
- [ ] 管理者がプラグイン設定画面で Anthropic API Key を登録でき、Proxy 設定に保存される
- [ ] API Key 未設定時はチャットパネルに適切なエラーメッセージを表示
- [ ] レコード一覧画面のサイドパネルに Rich variant のチャット UI が Hi-Fi で表示される
- [ ] Default Agent が metadata で自動解決・作成される
- [ ] 最小 Environment (kintone 操作なし) が metadata で自動解決・作成される
- [ ] Session が metadata で解決され、チャットパネルを閉じて再度開いても会話履歴が継続する
- [ ] ユーザーメッセージ送信 → ポーリングで `thinking` / `agent.message` がチャット上に表示される

### Phase 1b 完了条件
- [ ] ユーザー初回利用時に kintone 認証情報入力ダイアログが表示される
- [ ] 入力した認証情報は Vault に保存され、プラグイン設定やローカルストレージに保存されない
- [ ] ユーザー専用 Environment が metadata で自動作成され、ヘルパーライブラリがプリインストールされている
- [ ] ヘルパーライブラリが環境変数 (`KINTONE_LOGIN` / `KINTONE_PASSWORD` / `KINTONE_DOMAIN`) から認証情報を取得し、Basic 認証で kintone REST API を呼ぶ
- [ ] 自然言語でレコード検索・集計を依頼できる (`get_records` / `get_app_schema` 経由)
- [ ] 10,000 件超のレコード取得がカーソル API で自動継続される
- [ ] Result カードで集計結果が表示される (ヘッダ + Rows + followup pill)
- [ ] Plan (read-only) カードが表示される基盤を実装
- [ ] Progress カードで長時間タスクが可視化され、パネルを閉じても継続し、再表示時に復元される

### Phase 1c 完了条件
- [ ] 自然言語で一括作成・更新・削除を依頼できる
- [ ] Plan (destructive) カードが表示され、「承認して実行」「修正」「キャンセル」の 3 ボタンが動作する
- [ ] 承認を表す `user.message` を POST し、Agent が破壊的操作を実行する
- [ ] 100 件超の操作はヘルパーライブラリ側で自動分割される

### Phase 1d 完了条件
- [ ] アプリ横断の転記 (「問合せ → 案件」等) が複合指示として意図通り動作する
- [ ] 失敗時のリカバリ手順が Agent 自身から提示される

### 非機能面 (全 Phase 完了時)

### 非機能面
- [ ] kintone プラグイン zip が 30MB 以下
- [ ] Chrome / Edge / Safari / Firefox 最新版で動作
- [ ] Lint / 型チェック / テストすべて CI で通過
- [ ] Python ヘルパーライブラリのユニットテストカバレッジ 80% 以上
- [ ] プラグイン `core/` 層のユニットテストカバレッジ 80% 以上
- [ ] README、セットアップ手順、プラグイン管理者向けガイドが整備されている

### 配布面 (Phase 1d 完了後)
- [ ] GitHub リポジトリに `plugin.zip` が Release として公開される
- [ ] `cowork-agent-kintone` が PyPI に公開される
- [ ] MIT ライセンスが付与されている

---

## 5. 制約事項

- **kintone スタンダードコース** の機能範囲のみ利用 (ゲストスペース / セキュアアクセス / IP 制限環境は MVP 対象外)
- **kintone Proxy API は SSE 非対応** のため、すべてポーリングで実装
- **Anthropic API Key は Proxy 設定** で管理し、JS から参照不可とする
- **kintone 認証情報は Vault** にのみ保存し、プラグイン設定・ローカルストレージに保存しない
- **プラグイン設定は管理者のみ書込可能** なため、ユーザー固有データをプラグイン設定に格納しない
- Managed Agents Beta API の仕様変更リスクを許容 (`anthropic-beta: managed-agents-2026-04-01`)
- MVP ではパフォーマンス定量目標は設定しない

---

## 6. 前提・依存

- Anthropic API Key を管理者が持参 (本プラグインは発行しない)
- kintone 検証環境 (スタンダードコース) を用意
- PyPI / GitHub のアカウントを保有
- 開発環境: Node.js 20.x / Python 3.11+ / pnpm / uv

---

## 7. スコープの区切り (本ステアリングの範囲)

本ステアリングでは **「動作する最小版」を一気通貫で実装** する。機能実装完了後、以下は **別ステアリング** で対応:

- ユーザービリティテスト・UX 磨き込み
- カスタム Agent 作成 UI (Phase2)
- SaaS 連携 (Phase2)
- 運用監視整備 (Sentry 等)
- 英語対応

---

## 8. 成果物 (本ステアリング完了時)

1. `packages/plugin/` のソース + ビルド成果物 `plugin.zip`
2. `packages/kintone-helper/` のソース + PyPI 公開用 wheel / sdist
3. `.github/workflows/` の CI/CD 定義
4. ルート `README.md` (セットアップ手順、利用方法、アーキテクチャ概要)
5. `packages/plugin/README.md` / `packages/kintone-helper/README.md`
6. `LICENSE` (MIT)
7. モノレポ設定 (`pnpm-workspace.yaml`, `package.json`, `pyproject.toml` 等)
