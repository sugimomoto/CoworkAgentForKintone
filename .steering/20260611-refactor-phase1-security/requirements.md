# 要求: リファクタリング Phase 1 — セキュリティ修正 + CI テストゲート

## 背景

2026-06-11 実施のコードベース全体レビューで、ユーザーの資格情報 (kintone API トークン / Anthropic API キー) を扱う公開 Cloudflare Worker (`packages/kintone-mcp`) に、実害リスクのあるセキュリティ上の問題が 3 件確認された。また、CI (`.github/workflows/build-plugin.yml`) にテストステップが存在せず、ユニットテストが落ちた状態でも plugin.zip がビルド・リリースされ得ることが分かった。

確認済みの問題:

1. **クエリインジェクション** — `packages/kintone-mcp/src/tools/utils/build-query.ts:31-54` で、kintone クエリ DSL にフィールド名・値を未エスケープのまま文字列連結している。`"` を含む値や `status) or (status = "x"` のようなフィールド名でクエリ構造を破壊・改変できる。
2. **OAuth コールバックの postMessage ワイルドカード** — `packages/kintone-mcp/src/oauth-callback.ts:85` で `window.opener.postMessage(payload, '*')` としており、opener が悪意あるページの場合に認可コード + state を任意オリジンが受信できる。
3. **credentials-upsert の URL パス未エンコード** — `packages/kintone-mcp/src/credentials-upsert.ts:102-103` で `vaultId` / `credentialId` を `encodeURIComponent` なしで Anthropic API の URL パスに埋め込んでいる (`skills-sync.ts` ではエンコード済みで、Worker 内で不整合)。あわせて、各ハンドラのエラーログが上流 API のエラーメッセージを未サニタイズのまま `console.log` / `console.error` に出力しており、秘匿情報がログに漏れる恐れがある。
4. **CI にテストゲートがない** — `build-plugin.yml` は build → pack → release のみ。vitest (plugin / kintone-mcp) が一度も実行されない。

## ゴール

- 公開 Worker 経由でのクエリ改変・認可コード窃取・パストラバーサルの経路を塞ぐ
- 秘匿情報がログに出力されない状態にする
- ユニットテストが落ちる変更が main に入らない / リリースされない状態にする

## スコープ

- **A.** `build-query.ts`: フィールド名のバリデーション (`^[a-zA-Z0-9_.]+$` への適合チェック、不適合は reject) + 文字列値の `"` エスケープ。インジェクションペイロードを含むテストケース追加
- **B.** `oauth-callback.ts`: `postMessage` の targetOrigin を明示する。redirect URL のパラメータで呼び出し元オリジンを受け取り検証する方式、または許可ドメインパターン (cybozu.com 系) での検証
- **C.** `credentials-upsert.ts`: `encodeURIComponent` の適用。エラーメッセージのサニタイズヘルパー (`sanitizeError`) を新設し、credentials-upsert / skills-sync / files-download のログ出力に適用
- **D.** `.github/workflows/build-plugin.yml`: pack の前に plugin と kintone-mcp のユニットテスト実行ステップを追加

### スコープ外

- E2E (Playwright) の CI 組み込み (認証情報が必要なため別作業とする)
- anthropic-passthrough のパス allowlist / リクエストサイズ制限 (改善余地はあるが実害リスクが相対的に低く、Phase 1 では見送り。必要なら別ステアリングで扱う)
- レートリミット導入

## ユーザーストーリー

### US-1: プラグイン利用企業の管理者

> 私は自社の kintone に Cowork Agent プラグインを導入し、Anthropic API キーと kintone の認証情報を Worker 経由で利用している。**第三者が細工した入力でクエリを改変したり、OAuth 認可コードを横取りしたりできない**ことを前提に、業務データへのアクセスを許可したい。

### US-2: Worker を運用する開発者

> 私は Cloudflare ダッシュボードで Worker のログを確認することがある。**ログに API キーやトークンの断片が残らない**ことが保証されていれば、ログを安心して調査・共有できる。

### US-3: リポジトリのメンテナ

> 私は PR をマージしてタグを切るだけでリリースしている。**テストが落ちている状態の plugin.zip が作られない**よう、CI が pack の前にテストで止まってほしい。

## 受け入れ条件

### AC-1: クエリインジェクションが成立しない

- フィールド名に `^[a-zA-Z0-9_.]+$` 以外の文字 (`"`、空白、`(`、`)` 等) が含まれる場合、ツールはエラーを返しクエリを発行しない
- 文字列値に `"` が含まれる場合、`\"` にエスケープされてクエリが生成される
- `textContains` / `equals` / `inValues` / `notInValues` / `dateRange` / `numberRange` の全フィルタ種別にインジェクションペイロードのテストケースが存在し、green であること

### AC-2: postMessage が任意オリジンに飛ばない

- `oauth-callback.ts` の `postMessage` 呼び出しで targetOrigin に `'*'` が使われていない
- 許可されないオリジンに対しては code/state が送信されないテストが存在する
- 既存の OAuth フロー (kintone プラグインからの正常系) が引き続き動作する (既存テスト green + 手動確認)

### AC-3: URL パスインジェクションが成立しない + ログがサニタイズされる

- `credentials-upsert.ts` の Anthropic URL 構築で `vaultId` / `credentialId` が `encodeURIComponent` 適用済み
- `/` を含む `credentialId` を渡すテストで、パスが改変されないこと (encode されること) を検証
- `sanitizeError()` ヘルパーが存在し、`sk-ant-` 形式の API キーや Bearer トークン様の文字列をマスクする。credentials-upsert / skills-sync / files-download のログ出力がこれを経由する

### AC-4: CI がテストで止まる

- `build-plugin.yml` に `pnpm --filter @cowork-agent/plugin run test` および kintone-mcp のテスト実行ステップが pack より前に存在する
- テストを意図的に落とした状態で CI が fail することを確認 (確認後 revert)

## 制約事項

- Worker は本番利用者がいるため、**既存の正常系リクエスト/レスポンスの互換性を壊さない** (ツールの入出力スキーマ変更なし)
- kintone-mcp は production dependencies ゼロの方針を維持する (Zod 等の追加はしない。手動バリデーションで実装)
- 修正ごとに `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` を green に保つ
- Worker のデプロイはプラグイン config 画面経由で各利用者が行うアーキテクチャのため、`WORKER_BUNDLE_VERSION` のバンプとリリースノートでの周知が必要
