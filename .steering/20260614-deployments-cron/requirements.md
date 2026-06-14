# 要求: Deployments (cron 定期実行) — #81

## 位置づけ（承認済み）
**独立 MVP**として実装する。「スケジュール付きエージェント実行 = 判断が要る定期タスクを自律起動」に
スコープを限定し、#83（決定的フローエンジン / iPaaS 構想）の議論とは切り離す。#83 から見れば
本機能は「スケジューラ選択肢の一つ」を先に用意するもの。

## 解決したいこと
kintone 文脈の定期タスク（日次の未対応レコード通知、週次の変更サマリ、月次のデータ品質チェック等）を、
自前スケジューラなしで Anthropic Managed Agents の Scheduled Deployments に回せるようにする。
通知・書き込みは initial_events のプロンプト + kintone MCP ツールでエージェント自身に行わせる。

## 権限モデル（承認済み）
**エンドユーザーがセルフサービスで「自分の」定期実行を登録・管理できる**。承認フローは設けない。
業務ユーザーが自分の業務効率化のために自律タスクを仕込める、を主目的にする。

### Settings へのアクセス（既存挙動の意図的変更）
- 現状: Settings は `isAdmin` のハードゲートで、非 admin は開けない（[ChatPanel.tsx:340,397](../../packages/plugin/src/desktop/ChatPanel.tsx#L397)）。
- 変更: **Settings 入口を全ユーザーに開く**。中身は**ロールでセクション出し分け**する。
  - 非 admin: **Deployments セクションのみ**表示（Agents / Skills / MCP は出さない）。
  - admin: 従来どおり全セクション + Deployments。
- ⚠️ これは「歯車が admin のみ」という現挙動を変える。要ユーザー合意・要動作確認。

### Deployments の参照/変更（ロール差）
- 各 Deployment に **所有者 metadata（`owner` = 作成時の kintone ユーザーコード）** を付与する。
- 非 admin は **自分が所有する Deployment のみ** 一覧・操作できる（per-user フィルタ）。
- admin は **全ユーザーの Deployment** を一覧・操作できる（運用・棚卸し用 / 所有者列を表示）。
- スケジュール実行は所有者ではなく Workspace の共有認証で走る（= 既存の interactive セッションと同じ
  権限。エンドユーザーが手動でできる kintone 操作を自動化するだけ、という整理）。

> ロール軸は当面 `isAdmin` の2値（コードに細分ロールなし）。「業務ユーザー/一般ユーザー」の
> 細分が必要なら別 Issue。
> 将来（別 Issue）: 「Deployment を作成できるユーザーを絞る」管理スイッチ、run ごとのコストガード
> （予算 / モデル下限）。MVP には含めない。

## ユーザーストーリー
- 業務ユーザーとして、対象エージェント・初回メッセージ・cron 式・timezone を指定して自分の定期実行を**登録**できる。
- 業務ユーザーとして、自分の定期実行を**一覧**し、次回実行予定（upcoming_runs_at）と直近 run の成否を確認できる。
- 業務ユーザーとして、スケジュール前に**手動実行（run）でテスト**できる。
- 業務ユーザーとして、自分の定期実行を**一時停止 / 再開 / 編集 / アーカイブ**できる。
- 業務ユーザーとして、**失敗した run だけを絞り込んで**原因（環境 archived / rate limited 等）を確認できる。
- admin として、**全ユーザーの定期実行**を一覧して運用管理できる。

## スコープ（含む）
- API クライアント: `listDeployments` / `createDeployment` / `retrieveDeployment` /
  `updateDeployment` / `runDeployment` / `pauseDeployment` / `unpauseDeployment` /
  `archiveDeployment` / `listDeploymentRuns`(has_error フィルタ) / `retrieveDeploymentRun`
- 型定義: `Deployment` / `CronSchedule` / `DeploymentRun` / `DeploymentRunError` / `TriggerContext`
- **所有者 metadata（`owner`）の付与と per-user 一覧フィルタ**（一般=自分のみ / admin=全員）
- **Settings 入口の非 admin 開放 + セクションのロール出し分け**（非 admin は Deployments のみ表示）
- Settings 内に `deployments` セクション（nav + 一覧ペイン + 作成/編集モーダル）
- 一覧: 名前 / 対象 agent / status(active/paused) / 次回実行予定 / 直近 run 成否 / 操作ボタン（admin は所有者列も）
- 作成・編集モーダル: agent 選択・初回メッセージ・cron 式・timezone・（environment は bootstrap 自動）
- 手動 run / pause / unpause / archive（archive は不可逆 → ConfirmDialog 必須）
- run 一覧（失敗フィルタ）の表示

## スコープ（含まない / 別 Issue）
- **承認フロー**（admin が業務ユーザーの登録を承認）。設けない。
- **「Deployment を作成できるユーザーを絞る」管理機能**、run ごとの**コストガード**（予算 / モデル下限）。将来。
- run から起動した **session の詳細追跡**（event stream / 結果の中身）。MVP は run 成否表示まで。
- **イベント駆動トリガー**（kintone webhook → 起動）。cron のみ。
- files / github / memory_store / vault リソース指定（MVP は agent + environment + message + schedule のみ。
  将来 #15 / vault 連携で拡張）。
- cron 式の高度なビルダー UI（プリセット + 手入力 + 次回実行プレビューで足りる）。
- **エンドユーザーが他人の Deployment を見る/触る**こと（一般は自分の所有分のみ。横断は admin だけ）。

## 受け入れ条件
- [ ] AC-1: Plugin から Deployment の作成・一覧・取得・**更新**・pause/unpause/run/archive ができる
- [ ] AC-2: Deployment Run の一覧（失敗フィルタ含む）を表示できる
- [ ] AC-3: Settings の Deployments ペインで cron 式・timezone・対象 agent・初回メッセージを指定して登録できる
- [ ] AC-4: `upcoming_runs_at` で次回実行予定を表示する
- [ ] AC-5: 手動実行（run）でスケジュール前のテストができる
- [ ] AC-6: 編集モーダルで cron / メッセージ / agent を変更し保存できる（`POST /v1/deployments/{id}` 部分更新）
- [ ] AC-7: archive は ConfirmDialog で確認、不可逆の旨を明示
- [ ] AC-8: 作成時に `metadata.owner` = 現在の kintone ユーザーコードが付与される
- [ ] AC-9: 非 admin の一覧には**自分が所有する Deployment のみ**が出る。admin は全 Deployment が出る（所有者表示付き）
- [ ] AC-10: **非 admin でも Settings を開けて Deployments セクションが見える**。Agents / Skills / MCP は admin のみ表示
- [ ] AC-11: resources.ts / types.ts の単体テスト、per-user フィルタ、UI コンポーネントのテストを追加

## 制約・留意点
- 組織あたり最大 1,000 deployment。
- DST の取りこぼし/重複注意を cron 入力 UI に添える（または timezone に UTC を既定提示）。
- Worker / client は改修不要（passthrough + 既定 beta header で通る）。
- 状態管理は store スライスを新設せず、既存 skills と同じく Settings 層の local state + 直接 fetch で回す。
- 永続先は Anthropic Workspace（単一ソース、localStorage 不使用）。所有者 metadata も Workspace 側に持つ。
- 権限差は `isAdmin` で判定（非 admin = 自分の所有分のみ / admin = 全員）。Settings 入口の非 admin 開放を伴う。
