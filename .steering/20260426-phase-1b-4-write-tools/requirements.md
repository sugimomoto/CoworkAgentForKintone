# Phase 1b-4 — kintone 書き込みツール追加 要求定義

## 背景

Phase 1b-3 までで以下の **読み取り系 4 ツール**が動作:

- `kintone-get-apps`
- `kintone-get-app`
- `kintone-get-form-fields`
- `kintone-get-records`

「メモを追加して」「ステータスを更新して」「このレコードを削除して」のような **書き込み系の依頼に答えられない** のが現在の主要な機能ギャップ。本フェーズで以下を追加する。

## 機能要件

### F1. 追加するツール

| ツール名 | kintone REST API | 役割 |
|---|---|---|
| `kintone-add-record` | `POST /k/v1/record.json` | 1 件追加 |
| `kintone-add-records` | `POST /k/v1/records.json` | 複数件追加 (最大 100 件) |
| `kintone-update-record` | `PUT /k/v1/record.json` | 1 件更新 (id or updateKey で指定) |
| `kintone-update-records` | `PUT /k/v1/records.json` | 複数件更新 (最大 100 件) |
| `kintone-delete-records` | `DELETE /k/v1/records.json` | 複数件削除 (最大 100 件、revision check 任意) |
| `kintone-add-record-comment` | `POST /k/v1/record/comment.json` | コメント追加 (mentions 任意) |

合計 **6 ツール追加** (現行 4 → 10 ツール)。

### F2. 入力スキーマ

各ツールの引数は kintone REST API の仕様に **可能な限り素直にマッピング** する。例:

#### `kintone-add-record`

```jsonc
{
  "app": "42",
  "record": {
    "title": { "value": "新規案件" },
    "status": { "value": "進行中" }
  }
}
```

#### `kintone-update-record`

```jsonc
{
  "app": "42",
  "id": "123",                 // OR updateKey
  "record": {
    "status": { "value": "完了" }
  },
  "revision": "5"              // 任意 (楽観ロック)
}
```

#### `kintone-update-record` (updateKey 形式)

```jsonc
{
  "app": "42",
  "updateKey": { "field": "code", "value": "C-001" },
  "record": { ... }
}
```

#### `kintone-delete-records`

```jsonc
{
  "app": "42",
  "ids": ["123", "456"],
  "revisions": ["5", "3"]      // 任意
}
```

#### `kintone-add-record-comment`

```jsonc
{
  "app": "42",
  "record": "123",
  "comment": {
    "text": "確認しました",
    "mentions": [
      { "code": "user1", "type": "USER" }
    ]
  }
}
```

### F3. 安全性

- 現行 Plugin の Default Agent は `permission_policy: { type: 'always_allow' }`。書き込みツールも例外なくこのポリシーに従う = **追加の HITL 承認は本フェーズではかけない**
- 本格的な承認 UI (タスクが言うところの ApprovalCard) は Phase 1c の課題として明記
- ただし system プロンプトで「破壊的操作の前にユーザに意図を確認するように促す」ガードレールを追加する

### F4. system プロンプト更新

`resolveAgent.ts` の `DEFAULT_AGENT_SYSTEM_PROMPT` に新ツールを列挙し、書き込み系の振る舞い指針を追加する。

```
- kintone-add-record / kintone-add-records: レコード追加
- kintone-update-record / kintone-update-records: レコード更新
- kintone-delete-records: レコード削除 (元に戻せない、慎重に)
- kintone-add-record-comment: コメント追加

ガードレール:
- レコード更新・削除のような破壊的操作を行う前は、必ずユーザに「どのレコードを」「どう変更するか」を
  確認してから実行してください。「全件削除」のような曖昧な指示には必ず一度確認を入れてください。
- フィールドコード・値型を間違えやすいので、操作前に kintone-get-form-fields を呼んで型を確認すること
  を推奨します。
```

### F5. テスト

各ツール:
- 引数 → URL / params / body 組立て検証
- 4xx / 5xx 例外伝播
- 主要パターン (id / updateKey / revisions / mentions) 別

合計 **6 ツール × 平均 3-4 テスト = 約 20 テスト** を追加。

## 非機能要件

- **後方互換性**: 既存 4 ツールに変更なし (引数 / 出力スキーマ非変更)
- **Worker サイズ**: gzip 後 ~10 KB 増加見込み (許容範囲)
- **Plugin agent metadata**: tools 構成変更時は metadata の `workerUrl` ハッシュ等で再作成判定 → ただし `mcp_toolset` は MCP server の tools/list を動的読込するため、Agent 自体の再作成は不要 (workerUrl が同じなら既存 Agent をそのまま使える)
- **Worker 再デプロイ**: 既存 Worker URL に対して上書きデプロイで OK

## スコープ外 (Phase 1c 以降)

- HITL 承認カード UI (破壊的操作前にユーザ確認)
- ファイルアップロード (`POST /k/v1/file.json`)
- アプリ管理系 (`POST /k/v1/preview/app/form/fields.json` 等の管理者 API)
- プロセス管理 (`PUT /k/v1/record/status.json`)
- スペース・ユーザ・組織管理

## 完了条件

- [ ] 6 ツール実装 + テスト追加 + Worker tests green
- [ ] Worker 上書きデプロイ
- [ ] resolveAgent system プロンプト更新 + Plugin tests green
- [ ] 既存 E2E (live-with-mcp など) は引き続き green
- [ ] 手動動作確認 (1 件作成 / 更新 / 削除 / コメント追加)
