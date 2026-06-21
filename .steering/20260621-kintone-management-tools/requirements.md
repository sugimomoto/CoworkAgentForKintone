# 要求定義: kintone 管理系ツール (Phase C) — #24

kintone のアプリ管理系 REST API を Agent から操作可能にする。**全 18 ツールをまとめて追加**する
（スコープ確定 2026-06-21: フェーズ分割せず一括実装）。

- 対象 Issue: [#24](https://github.com/sugimomoto/CoworkAgentForKintone/issues/24)（Phase C, size L）
- 連携: [#9](../../issues/9) フォーム設計 / [#19](../../issues/19) admin Custom Agent / [#20](../../issues/20) customize preview

## 前提（現状確認済み）
- **OAuth スコープ拡張は完了済み**: `k:app_settings:write` / `k:file:write` は既に
  `DEFAULT_KINTONE_OAUTH_SCOPE` に付与済み（#20 で拡張）。→ #24 の C-1（再連携 UX）は**不要**。
- **customize/deploy はプラグインの wedge ワークフローで既に実装済み**
  （`chat/workflow/kintoneCustomizeApi.ts`：preview/customize.json PUT・deploy.json POST・ポーリング）。
  業務/カスタマイザー Agent は system prompt で「customize.json を直接叩くの禁止（ボタン経由のみ）」と規定。
  → 本作業の MCP ツールは **admin 専用 Agent からのみ使う**ことで wedge と棲み分ける（後述）。

## 追加するツール（18）

### グループ1: customize / deploy（#20 連動, 4）
| ツール | API |
|---|---|
| `kintone-get-customize` | `GET /k/v1/preview/app/customize.json` |
| `kintone-update-customize` | `PUT /k/v1/preview/app/customize.json` |
| `kintone-deploy-app` | `POST /k/v1/preview/app/deploy.json`（`revert` 対応） |
| `kintone-get-app-deploy-status` | `GET /k/v1/preview/app/deploy.json` |

### グループ2: フォーム設計（#9 連動, 7）
| ツール | API |
|---|---|
| `kintone-get-views` | `GET /k/v1/(preview/)app/views.json` |
| `kintone-update-views` | `PUT /k/v1/preview/app/views.json` |
| `kintone-get-form-layout` | `GET /k/v1/(preview/)app/form/layout.json` |
| `kintone-update-form-layout` | `PUT /k/v1/preview/app/form/layout.json` |
| `kintone-add-form-fields` | `POST /k/v1/preview/app/form/fields.json` |
| `kintone-update-form-fields` | `PUT /k/v1/preview/app/form/fields.json` |
| `kintone-delete-form-fields` | `DELETE /k/v1/preview/app/form/fields.json` |

### グループ3: アプリ作成 / プロセス管理（4）
| ツール | API |
|---|---|
| `kintone-create-app` | `POST /k/v1/preview/app.json` |
| `kintone-get-process-management` | `GET /k/v1/(preview/)app/status.json` |
| `kintone-update-process-management` | `PUT /k/v1/preview/app/status.json` |

### グループ4: 権限 / プラグイン（4）
| ツール | API |
|---|---|
| `kintone-get-app-acl` | `GET /k/v1/(preview/)app/acl.json` |
| `kintone-update-app-acl` | `PUT /k/v1/preview/app/acl.json` |
| `kintone-get-app-plugins` | `GET /k/v1/(preview/)app/plugins.json` |
| `kintone-update-app-plugins` | `PUT /k/v1/preview/app/plugins.json` |

> フィールド/ビュー/フォーム/権限/プラグイン系は名称を `kintone-*-form-fields` / `kintone-*-app-acl` のように
> 名詞を明示して prefix を整理（#24 の論点「ツール名 prefix 統一」）。

## ユーザーストーリー（admin / 情シス向け）
- **US-1**: 「このアプリにフィールド『優先度(ドロップダウン)』を追加して」→ add-form-fields → deploy。
- **US-2**: 「一覧ビューを『未対応のみ』に絞って並び替え」→ get-views → update-views → deploy。
- **US-3**: 「新しい問い合わせ管理アプリを作って、ワークフローを 受付→対応中→完了 で」→ create-app → update-process-management → deploy。
- **US-4**: 「このアプリの権限を営業部だけ閲覧可に」→ get/update-app-acl → deploy。
- **US-5**: デプロイ前に「ライブと preview の差分」を Agent が説明できる（get 系で preview/live 両取得可）。

## 受け入れ条件
- [ ] AC-1: 18 ツールが Worker に追加され、各 API を正しいパス/メソッド/body で叩く。
- [ ] AC-2: **取得系は live/preview を選べる**（`preview?: boolean`、既定 live）。更新系は preview のみ。
- [ ] AC-3: 更新系は **deploy しない限りライブ反映されない**（preview に積む）。`deploy-app` で反映、`revert` で破棄。
- [ ] AC-4: `get-app-deploy-status` でデプロイ進行（PROCESSING/SUCCESS/FAIL/CANCEL）を確認できる。
- [ ] AC-5: 不正引数・kintone エラー（権限不足/不正設定/楽観ロック）は `KintoneApiError` でそのまま提示。
- [ ] AC-6: **管理系は admin 専用 Agent からのみ**使える（built-in 業務/カスタマイザー variant には出さない）。
- [ ] AC-7: ツール本数増（17→35）に対し、モデル混乱を抑える方針（admin/一般の Agent 分離 + 命名整理）。
- [ ] AC-8: Worker / Plugin unit test green。

## 制約・前提
- **OAuth スコープ**: 追加・再連携 **不要**（`k:app_settings:write` / `k:file:write` 付与済み）。
- **admin 権限**: これらの API は kintone のアプリ管理者権限が要る。無ければ API エラーをそのまま提示。
- **preview/live の 2 系統**: Worker 側で吸収（取得=`preview?` 切替、更新=preview 固定）。設計で詳細化。
- **wedge との棲み分け**: 一般ユーザの customize は従来どおり wedge ボタン（agent 直叩き禁止）。
  本ツールは admin 専用 Agent 用なので衝突しない。

## 非対象（Out of Scope）
- 一般業務 Agent への管理系ツール公開（admin 専用に限定）。
- Anthropic tool-search の有効化（将来の最適化。本作業では Agent 分離で対処）。
- 既存 wedge ワークフロー（preview/apply/rollback ボタン）の変更。
