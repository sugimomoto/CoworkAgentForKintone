# タスクリスト: リファクタリング Phase 1 — セキュリティ修正 + CI テストゲート

requirements.md / design.md に基づく実装タスク。PR-1 (T1〜T4) → PR-2 (T5) の順に実施。

## T1. クエリインジェクション対策 (design A)

- [x] T1.1 `build-query.ts` に `assertFieldCode()` / `quoteValue()` を追加
- [x] T1.2 textContains / equals / dateRange / numberRange / inValues / notInValues の全条件生成を新ヘルパー経由に変更
- [x] T1.3 orderBy のフィールド名にも `assertFieldCode` を適用
- [x] T1.4 数値値の `Number.isFinite()` 検証を追加
- [x] T1.5 `build-query.test.ts` にテスト追加
  - フィールド名インジェクション (`status") or (1 = "1` 等) が throw する
  - 値の `"` / `\` がエスケープされる
  - 日本語フィールドコードが通る (正常系)
  - orderBy 経由のインジェクションが throw する
  - 既存テストが全て green のまま

## T2. credentials-upsert 強化 (design C-1)

- [x] T2.1 `vaultId` / `credentialId` の形式チェック (`/^[A-Za-z0-9_-]+$/`) を追加、不正は 400
- [x] T2.2 Anthropic URL 構築に `encodeURIComponent` を適用
- [x] T2.3 `credentials-upsert.test.ts` に追加
  - `/` を含む credentialId が 400 で reject される
  - 正常系の URL が従来と同一

## T3. ログサニタイズ (design C-2)

- [x] T3.1 `_http.ts` に `sanitizeError()` を追加 + ユニットテスト (sk-ant- / Bearer / JWT 様のマスク)
- [x] T3.2 `credentials-upsert.ts` / `skills-sync.ts` / `files-download.ts` / `mcp.ts` のログ・エラーレスポンス組立てを `sanitizeError` 経由に変更
  - `grep -n "err.message\|String(err)" src/` で適用漏れがないことを確認
- [x] T3.3 サニタイズ済みメッセージがログに出るテストを 1 ハンドラ分追加

## T4. CI テストゲート (design D)

- [x] T4.1 `build-plugin.yml` に Lint & typecheck / Run unit tests ステップを追加 (Install dependencies の直後)
- [x] T4.2 PR を出して CI が test ステップを実行し green になることを確認
- [x] T4.3 (検証) テストを意図的に落とした commit で CI が fail することを確認 → revert

## T5. OAuth postMessage targetOrigin (design B) — PR-2

- [x] T5.1 `packages/plugin/src/core/oauth/pkce.ts` の state 生成を `<random>.<base64url(origin)>` 形式に変更
- [x] T5.2 pkce のテストを新形式に更新 (random 部の長さ / origin セグメントのデコード)
- [x] T5.3 `oauth-callback.ts` に `targetOriginFromState()` を追加し、`postMessage(payload, '*')` を「検証済みオリジンへのみ送信、無効なら送信しない」に変更
- [x] T5.4 `oauth-callback.test.ts` に追加
  - 有効な cybozu.com 系オリジンを含む state → そのオリジンに postMessage
  - オリジンセグメントなし / 不正オリジン (`https://evil.example`) → postMessage が呼ばれない
  - HTML 上の code 可視表示は従来どおり (手動フロー維持)
- [x] T5.5 mcp.ts の許可ドメインと oauth-callback の許可ドメインが一致することを検証するテスト
- [x] T5.6 popup.ts のフロー (origin / source / state の 3 段検証) が無変更で通ることを既存テストで確認

## T6. リリース

- [x] T6.1 `WORKER_BUNDLE_VERSION` をバンプ
- [x] T6.2 `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green を確認
- [x] T6.3 ローカル環境で E2E (live-with-mcp / config) を実行
- [x] T6.4 実環境で確認: OAuth popup フロー / kintone レコード検索ツール (日本語フィールド含む)
- [x] T6.5 リリースノートに「Worker 再デプロイが必要」「旧プラグイン + 新 Worker では OAuth popup が手動コピーにフォールバック」を明記

## 完了条件

- requirements.md の AC-1〜4 が全て満たされている
- 2 PR とも CI green でマージ済み
- 実環境で OAuth バインドとレコード検索が動作確認済み
