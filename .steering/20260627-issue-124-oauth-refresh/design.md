# design.md — Issue #124 調査・解消の設計

## アプローチ全体
「①診断で原因確定 → ②原因別の恒久修正 → ③検知導線改善」の3段。本設計では **①の診断スクリプト** を
実体として確定させ、②③は診断結果に応じた分岐として方針を定義する（実装は診断後に確定）。

## ① 診断スクリプト `scripts/diagnose-oauth-refresh.mjs`

### 目的
実環境の失効した credential に対し `mcp_oauth_validate` を実行し、`has_refresh_token` /
`refresh.status` / `mcp_probe` から A/B/C を切り分ける。

### 実装方針
- `scripts/verify-mcp-oauth.mjs` のヘッダ規約・`.env` パーサ・`anthropic()` ヘルパを踏襲（依存追加なし、Node 標準のみ）。
- 必要 env: `ANTHROPIC_API_KEY` のみ（読み取り専用診断なので OAuth client secret 等は不要）。
- 手順:
  1. `GET /v1/vaults?limit=100` で全 Vault 取得。
  2. `metadata.source === 'cowork-agent-for-kintone'`（[constants.ts:4](packages/plugin/src/core/constants.ts#L4) の `METADATA_SOURCE`）で本プラグイン由来の Vault に絞る。
     - metadata が拾えない場合に備え `--all` フラグで全 Vault 対象も可能にする。
  3. 各 Vault で `GET /v1/vaults/{vault_id}/credentials` → `archived_at` が無い active credential を抽出。
  4. 各 active credential に `POST /v1/vaults/{vault_id}/credentials/{credential_id}/mcp_oauth_validate`
     （`anthropic-beta: managed-agents-2026-04-01`）を実行。
  5. 結果を 1 行サマリ + 詳細 JSON で出力:
     - `status`（valid/invalid/unknown）
     - **`has_refresh_token`** ← A 確定の主指標
     - `refresh.status`（例 `no_refresh_token`）
     - `mcp_probe.http_response`（401/invalid_token 等）
  6. 末尾に判定ヒントを表示（has_refresh_token=false → 仮説A 等）。
- **副作用なし / 秘匿値は出さない**: token 類は表示しない。診断は読み取りのみ（archive もしない）。
- 引数: `--all`（metadata で絞らない）, `--vault <id>`（単一 Vault 限定）, `--json`（機械可読出力）。

### 出力例（想定）
```
vault_xxx (kintone / user=foo)
  cred_yyy  status=invalid  has_refresh_token=false  refresh=no_refresh_token  probe=401
  => 仮説A: refresh_token が Vault に存在しない
```

## ② 原因別の恒久修正（診断後に確定）

| 確定原因 | 修正方針 | 主な変更ファイル |
|---|---|---|
| **A** (no refresh_token) | (a) token 交換レスポンスに refresh_token が含まれるか実地確認（診断スクリプトを token 交換まで拡張 or `verify-mcp-oauth.mjs` 流用）。(b) 含まれない場合は **cybozu.com OAuth クライアント設定 / scope の見直し**（refresh_token 発行可否）を確認し導入ドキュメントに明記。(c) refresh_token 欠落時はユーザーに警告を出す導線を [useUserBinding.ts](packages/plugin/src/desktop/hooks/useUserBinding.ts) に追加 | constants.ts(scope), docs, useUserBinding.ts |
| **B** (rotation) | 再 upsert で refresh_token を上書きしない運用に統一（access_token のみ更新、refresh は触らない）。`buildUpdateBody` の refresh 同梱条件を見直し | credentials-upsert.ts, credentialsUpsertClient.ts |
| **C** (overwrite) | `connect()` 再実行時に既存 refresh を温存する分岐を追加。ただし現状コードでは発生しにくい想定 | useUserBinding.ts |

## ③ 検知導線の改善（できれば / 最小）
- 現状: MCP エラー文字列で事後検知（[useEventPoller.ts:31-47](packages/plugin/src/desktop/hooks/useEventPoller.ts#L31-L47) `isOAuthFailureText`）。
- 改善案: `vault_credential.refresh_failed` Webhook 購読で能動検知（#93/#114 の Webhook 基盤と関連）。
- 本 Issue では「設計メモ + 最小導線（既存のバナー発火を Webhook トリガに繋ぐ余地の確認）」までとし、
  フル実装は別 Issue 候補として切り出す。

## 影響範囲
- ①診断スクリプトは新規追加のみ（既存コードに影響なし）。
- ②③は診断結果に依存。確定後に tasklist.md を更新して実装する。

## テスト/検証方針
- 診断スクリプト: user 環境で実行し、失効 credential の `has_refresh_token` を確認。
- 修正後: ≥1h 放置 → ツール呼び出しが再認可なしで成功することを確認（`verify-mcp-oauth.mjs` の延長 or 手動）。
