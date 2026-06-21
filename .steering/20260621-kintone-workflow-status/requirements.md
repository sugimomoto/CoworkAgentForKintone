# 要求定義: kintone プロセス管理（ワークフロー）レコード操作 — #22 Phase B-1

## 概要
kintone の **プロセス管理（ワークフロー）** を Agent から操作できるようにする。レコードの
**ステータス変更**・**作業者（assignee）変更** は業務システムで頻出だが、現状の MCP ツール
（CRUD 中心）では扱えない。本作業で **ワークフロー操作系の 3 ツール** を追加する。

- 対象 Issue: [#22](https://github.com/sugimomoto/CoworkAgentForKintone/issues/22)（Phase B-1, size M）
- スコープ確定（2026-06-21）: **#22 の 3 ツールのみ先行**。#24（管理系 17 ツール）は別フェーズ。

## 背景・目的
- 「未対応 → 対応中 → 完了」のような状態遷移、担当の付け替えは、kintone 業務の中核操作。
- 自然言語で「このレコードを完了にして」「未対応案件を全部 田中さんに振って」を実行できると、
  Cowork Agent の業務カバレッジが大きく広がる（一般業務ユーザ向け機能）。

## 追加するツール（3）

| ツール名 | kintone API | 入力 | 出力 |
|---|---|---|---|
| `kintone-update-record-status` | `PUT /k/v1/record/status.json` | `app`, `id`, `action`, `assignee?`, `revision?` | `{ revision }` |
| `kintone-update-records-statuses` | `PUT /k/v1/records/status.json` | `app`, `records: [{ id, action, assignee?, revision? }]` | `{ records: [{ id, revision }] }` |
| `kintone-update-record-assignees` | `PUT /k/v1/record/assignees.json` | `app`, `id`, `assignees: [code, …]`, `revision?` | `{ revision }` |

- `action`: プロセス管理で定義された **アクション名**（例「対応開始」「完了する」）。
- `assignee`（status 変更時）: 遷移先が作業者指定を要する場合に渡す単一ユーザ code。
- `assignees`（作業者変更）: 作業者の集合（複数可）。

## ユーザーストーリー
- **US-1**: 業務ユーザとして「アプリ X のレコード 12 を『完了』にして」と頼むと、ステータスが遷移する。
- **US-2**: 「先月の未対応案件を全部 田中さんに振り直して」と頼むと、対象レコードの作業者が一括変更される。
- **US-3**: 「このレコードを対応中にして、担当を自分に」と頼むと、ステータス遷移＋作業者指定が同時に行われる。
- **US-4**: 取り戻せない遷移（例『完了』）の前に、ユーザが**承認カードで確認**できる。

## 受け入れ条件
- [ ] AC-1: 単一ステータス遷移（`update-record-status`）が正しく動く。
- [ ] AC-2: 一括ステータス遷移（`update-records-statuses`）が複数レコードに対して動く。
- [ ] AC-3: 作業者変更（`update-record-assignees`）が動く（単一・複数 assignee）。
- [ ] AC-4: アプリのプロセス設定に存在しない **不正な action 名** のとき、原因が分かるエラーを返す。
- [ ] AC-5: **revision（楽観ロック）競合** を検出し、分かりやすいエラーにする。
- [ ] AC-6: kintone 側で **プロセス管理権限が無い / ワークフロー無効** の場合、API エラーをそのまま分かる形で提示する。
- [ ] AC-7: ステータス変更系は **取り戻し不可リスク** に配慮した承認フロー（→ 設計で `always_ask` 方針を確定）。
- [ ] AC-8: Worker / Plugin 双方で unit test green。Agent の toolset に 3 ツールが追加される。

## 制約・前提
- **OAuth スコープ**: 追加不要・再連携不要 ✅（裏取り済み: kintone OAuth は全 6 スコープのみで、
  [公式ドキュメント](https://cybozu.dev/ja/common/docs/oauth-client/scope-kintone/)上、**ステータス変更
  （`record/status.json` / `records/status.json`）と作業者変更（`record/assignees.json`）は
  `k:app_record:write` に含まれる**。現行 `DEFAULT_KINTONE_OAUTH_SCOPE` に既に付与済み）。
- **kintone 側権限**: プロセス管理の操作は、対象アプリで**ワークフローが有効**かつユーザに権限が必要。
  無い場合は API エラーをそのまま提示（プラグイン側で権限を偽装しない）。
- **取り戻し設定の事前チェックは本スコープ外**: アプリが「取り戻し」を許可しているかの判定は
  `kintone-get-process-management`（#24, read）が必要。本作業では **導入せず**、当面は
  `always_ask`（承認カード）＋ system prompt / Skills のガードレールで安全側に倒す。
- **対象者・公開先**: admin 限定ではない。一般業務ユーザの操作。**built-in「業務（business）」Agent の
  toolset にのみ出す**（Customizer Opus / Sonnet には出さない）。確定（2026-06-21）。

## 非対象（Out of Scope）
- プロセス管理の **定義変更**（`update-process-management` / `get-process-management`）= #24。
- #24 の管理系ツール（customize / views / fields / ACL / app 作成 / plugins）一式。
- 取り戻し可否に応じた `always_ask` の動的出し分け（Phase C で `get-process-management` 導入後）。
