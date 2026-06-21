# 設計: kintone 管理系ツール (Phase C) — #24

## 設計判断（確定）

### D1. admin ゲート方式 = 「built-in から除外 + custom Agent で選択」
管理系 18 ツールは **どの built-in variant にも出さない**（業務/デザイナー/カスタマイザー全除外）。
admin が **Custom Agent**（#19）作成時に AgentDetailModal で必要な管理ツールを選び、公開先 ACL（#47）で
admin 限定にする運用。これで「admin 専用」を既存機構だけで実現（新しい権限機構を作らない）。

- 実装: 既存 `MANAGEMENT_TOOL_NAMES`（業務 spec が除外に使用中）を 18 ツール全名に拡張し、
  **全 built-in variant の `mcpToolFilter` が `MANAGEMENT_TOOL_NAMES` を除外**するようにする
  （業務は既に除外。カスタマイザーの `() => true` とデザイナーの readonly も除外を追加 or 構造上既に除外）。
  - デザイナー = `READONLY_KINTONE_TOOL_NAMES` のみ → 管理系は元から出ない。
  - カスタマイザー = `(name) => !WORKFLOW_TOOL_NAMES.has(name)` → ここに `!MANAGEMENT_TOOL_NAMES.has(name)` を追加。
  - 業務 = `!MANAGEMENT_TOOL_NAMES.has(name)` → 拡張で自動的に新管理系も除外。
- custom Agent: `KINTONE_TOOL_NAMES` に 18 追加 → AgentDetailModal の picker に出る → admin が選択可能。

### D2. wedge との棲み分け
一般ユーザの customize は従来どおり **wedge ボタン**（agent 直叩き禁止の system prompt）。管理系ツールは
**admin 専用 custom Agent からのみ**呼ばれるので、end-user の wedge フローと衝突しない。
business/customizer の system prompt は変更しない。

### D3. preview / live 抽象化（Worker 側で吸収）
- **取得系**: `preview?: boolean`（既定 `false` = live `/k/v1/app/...`）。`true` で `/k/v1/preview/app/...`。
  デプロイ前の編集中状態を読むときは `preview: true`。customize/deploy-status は preview のみ。
- **更新系**: 常に preview（`/k/v1/preview/app/...`）。deploy するまでライブ反映されない。
- 実装: パス組立ヘルパ `appConfigPath(segment, preview)` を Worker tools/utils に追加。

### D4. ツール本数の増加対策
admin/一般の **Agent 分離**（D1）で、一般ユーザの toolset は据え置き（17）。管理系は admin custom Agent に
admin が必要分だけ選択 → 1 Agent あたりのツール数を抑制。命名は名詞明示（`*-form-fields` / `*-app-acl` 等）。

## Worker 実装

### 共通
- 既存 `createTool` + `kintoneRequest` + `toolResult` パターン。
- `tools/utils/schemas.ts` に `previewSchema`（boolean）等を追加。
- `appConfigPath(segment, preview)` = `/(k/v1)(/preview)?/app/<segment>`。
  - 例: `appConfigPath('form/fields.json', true)` → `/k/v1/preview/app/form/fields.json`

### ツール一覧（18）と入出力（要点）
| ツール | method / path | 主な入力 | 出力 |
|---|---|---|---|
| get-customize | GET preview/app/customize.json | app, preview? | {js, css, revision, scope?} |
| update-customize | PUT preview/app/customize.json | app, js?, css?, scope?, revision? | {revision} |
| deploy-app | POST preview/app/deploy.json | apps:[{app,revision?}], revert? | {} (202) |
| get-app-deploy-status | GET preview/app/deploy.json | apps:[id] | {apps:[{app,status}]} |
| get-views | GET (preview/)app/views.json | app, preview? | {views, revision} |
| update-views | PUT preview/app/views.json | app, views, revision? | {revision} |
| get-form-layout | GET (preview/)app/form/layout.json | app, preview? | {layout, revision} |
| update-form-layout | PUT preview/app/form/layout.json | app, layout, revision? | {revision} |
| add-form-fields | POST preview/app/form/fields.json | app, properties, revision? | {revision} |
| update-form-fields | PUT preview/app/form/fields.json | app, properties, revision? | {revision} |
| delete-form-fields | DELETE preview/app/form/fields.json | app, fields:[code], revision? | {revision} |
| create-app | POST preview/app.json | name, space?, thread? | {app, revision} |
| get-process-management | GET (preview/)app/status.json | app, preview? | {enable, states, actions, revision} |
| update-process-management | PUT preview/app/status.json | app, enable?, states?, actions?, revision? | {revision} |
| get-app-acl | GET (preview/)app/acl.json | app, preview? | {rights, revision} |
| update-app-acl | PUT preview/app/acl.json | app, rights, revision? | {revision} |
| get-app-plugins | GET (preview/)app/plugins.json | app, preview? | {plugins, revision} |
| update-app-plugins | PUT preview/app/plugins.json | app, ids, revision? | {revision} |

- 多くは「app(+preview?) を受け、対応 body を渡す」薄いラッパ。`properties` / `views` / `layout` / `rights` /
  `states`+`actions` 等の構造は kintone 仕様に委ね、tool 側は `type: object`/`array` の汎用スキーマ + 説明文で誘導。
- エラーは `KintoneApiError` で surface（追加処理不要）。引数の必須チェックのみ tool 側。

## Plugin 配線
- `core/bootstrap/builtInAgents.ts`: `KINTONE_TOOL_NAMES` に 18 追加、`MANAGEMENT_TOOL_NAMES` を
  18 ツール全名に拡張（旧プレースホルダ名は実名に置換）。カスタマイザー spec の filter に
  `!MANAGEMENT_TOOL_NAMES.has(name)` を追加（業務は既存、デザイナーは readonly で対象外）。
- `core/bootstrap/agentToolDefs.ts`: **管理系は加えない**（確定）。legacy `resolveAgent` はフィルタ無し全公開
  のため、ここに加えると legacy default agent が admin ツールを持ってしまう。よって 18 ツールは
  **`builtInAgents.KINTONE_TOOL_NAMES` のみ**に追加（= built-in[フィルタ除外] + custom picker に出る／
  legacy には出ない）。agentToolDefs 側は #22 までの 12 ツールのまま据え置き。
- DESTRUCTIVE_TOOL_NAMES: `delete-form-fields` / `deploy-app` / `update-app-acl` など破壊的・影響大のものを
  `always_ask` にするか検討（custom Agent 側 = agentToolDefs の DESTRUCTIVE + builtInAgents の DESTRUCTIVE）。
  → 既定は deploy-app と delete-form-fields を always_ask（影響が大きく取り消しにくい）。

## テスト
- Worker: `management-tools.test.ts`（各ツールの path/method/body、preview 切替、エラー伝播）。
- Plugin: 管理系が全 built-in variant に出ない / custom picker には出る / DESTRUCTIVE 指定の検証。

## 受け入れ条件との対応
AC-1〜5 = Worker 18 ツール + preview/live + KintoneApiError。AC-6/7 = D1 の Agent 分離。AC-8 = test。
