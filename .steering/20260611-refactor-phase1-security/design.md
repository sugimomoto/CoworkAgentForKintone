# 設計: リファクタリング Phase 1 — セキュリティ修正 + CI テストゲート

## 概要

requirements.md の AC-1〜4 を満たす実装設計。4 つの独立した修正 (A〜D) からなり、A〜C は Worker (`packages/kintone-mcp`)、D は CI 定義の変更。A〜C で `WORKER_BUNDLE_VERSION` をバンプし、プラグインの config 画面から再デプロイすることで利用者環境に反映される。

## A. クエリインジェクション対策 (build-query.ts)

### 現状

`packages/kintone-mcp/src/tools/utils/build-query.ts:31-54` — 全フィルタ種別でフィールド名・文字列値を未エスケープのままテンプレートリテラルで連結:

```typescript
conditions.push(`${f.field} like "${f.value}"`);          // textContains
conditions.push(`${f.field} = "${f.value}"`);             // equals (string)
const values = f.values.map((v) => `"${v}"`).join(', ');  // inValues / notInValues
```

### 設計

同ファイルに 2 つの純関数を追加し、全条件生成で経由させる:

```typescript
const FIELD_CODE_RE = /^[^\s"'()<>=!,]+$/u;  // kintone フィールドコードとして妥当な形

/** フィールド名を検証。不正なら Error を throw (ツール層で 'Tool error:' として返る) */
function assertFieldCode(field: string): string {
  if (!FIELD_CODE_RE.test(field)) {
    throw new Error(`invalid field code in filter: ${JSON.stringify(field)}`);
  }
  return field;
}

/** 文字列値をクエリリテラル化。`"` と `\` をエスケープして両端を `"` で囲む */
function quoteValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
```

確定事項:

- **フィールド名は reject 方式** (エスケープではなくエラー)。kintone のフィールドコードに `"` 空白 `()` 等は入らないため、含まれる入力は攻撃または誤りであり、黙ってエスケープするより明示的に失敗させる
- requirements の `^[a-zA-Z0-9_.]+$` 案から変更: kintone のフィールドコードは**日本語を許容する**ため、ホワイトリストではなくクエリ構文を壊しうる文字 (空白 / 引用符 / 括弧 / 演算子文字 / カンマ) のブラックリスト + Unicode フラグで検証する
- 数値系 (`numberRange`, `equals` の number) は `Number.isFinite()` を検証してから埋め込む
- `orderBy` の `field` も同様に `assertFieldCode` を通す (見落としやすいので明記)

### テスト

`tests/tools/build-query.test.ts` に追加: `field: 'status") or (1 = "1'` / 値に `"` を含むケース / 日本語フィールドコードの正常系 / orderBy 経由のインジェクション。

## B. OAuth postMessage の targetOrigin 明示 (oauth-callback.ts)

### 現状と脅威モデル

`oauth-callback.ts:85` — `window.opener.postMessage(payload, '*')`。コメントには「Plugin の kintone ドメインが事前に分からないため `'*'`、state 検証で CSRF を防ぐ」とあるが、state 検証 (`popup.ts:69`) が防ぐのは**プラグイン側が偽 code を受け取る**ことのみ。**攻撃者のページが popup を開いた場合**、被害者の SSO セッションで発行された認可コードが攻撃者の opener に `'*'` で送信される経路は塞げていない。

### 設計

**state パラメータにオリジンを載せて往復させる** (OAuth の state は認可サーバーがそのまま redirect に付けて返すため、追加のパラメータ登録が不要):

1. **プラグイン側** `packages/plugin/src/core/oauth/pkce.ts:36` — state 生成を拡張:
   ```typescript
   // 旧: state = randomBase64Url(STATE_BYTES)
   // 新: state = `${randomBase64Url(STATE_BYTES)}.${base64UrlEncode(location.origin)}`
   ```
   `popup.ts` の検証は state 文字列全体の一致比較 (`data.state !== opts.expectedState`) なので**変更不要**。
2. **Worker 側** `oauth-callback.ts` — state の第 2 セグメントをデコードし、許可ドメインパターンで検証:
   ```typescript
   const KINTONE_ORIGIN_RE =
     /^https:\/\/[a-z0-9][a-z0-9-]*\.(cybozu\.com|kintone\.com|cybozu-dev\.com|cybozu\.cn)$/i;

   function targetOriginFromState(state: string): string | null {
     const dot = state.indexOf('.');
     if (dot === -1) return null;
     const origin = base64UrlDecode(state.slice(dot + 1));  // 失敗時 null
     return origin !== null && KINTONE_ORIGIN_RE.test(origin) ? origin : null;
   }
   ```
   - 有効なオリジンが取れた場合のみ `postMessage(payload, origin)` を実行
   - 取れない場合は **postMessage しない** (ページ上の code 可視表示 + コピーボタンは従来どおり残るため、検証スクリプト用の手動フローは維持される)
- ドメインパターンは `mcp.ts:48-53` の許可ドメイン群と同一にする (定数を共有ファイルに切り出すかは実装時判断。Worker は単一バンドルなので重複定義でも可だが、テストで両者の一致を検証する)

### 互換性

旧形式 state (オリジンセグメントなし) の場合は postMessage されなくなる = **旧プラグイン + 新 Worker の組合せでは popup フローが手動コピーにフォールバック**する。プラグインと Worker は同一リリースで配布され、Worker 再デプロイはプラグイン config 画面から行うため、実運用上は同時更新される。リリースノートに明記する。

## C. credentials-upsert の URL エンコード + ログサニタイズ

### C-1. encodeURIComponent

`credentials-upsert.ts:102-103`:

```typescript
// 旧
`${ANTHROPIC_BASE}/v1/vaults/${body.vaultId}/credentials/${body.credentialId}`
// 新
`${ANTHROPIC_BASE}/v1/vaults/${encodeURIComponent(body.vaultId)}/credentials/${encodeURIComponent(body.credentialId)}`
```

あわせて `vaultId` / `credentialId` のバリデーションに形式チェック (`/^[A-Za-z0-9_-]+$/`) を追加し、不正形式は 400 で reject する (encode は防御の 2 層目)。

### C-2. sanitizeError

`src/_http.ts` に追加 (maskToken と同居):

```typescript
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]+/g,        // Anthropic API key
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g, // Bearer token
  /eyJ[A-Za-z0-9._-]{20,}/g,       // JWT 様
];

export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  for (const re of SECRET_PATTERNS) msg = msg.replace(re, '[REDACTED]');
  return msg;
}
```

適用箇所: `credentials-upsert.ts` / `skills-sync.ts` / `files-download.ts` / `mcp.ts` の `console.log` / `console.error` / エラーレスポンス組立てで、上流 API 由来のメッセージを出す全箇所。grep (`err.message`, `String(err)`) で網羅を確認する。

## D. CI テストゲート

`.github/workflows/build-plugin.yml` の「Install dependencies」(L48-49) と「Build plugin assets」(L51-54) の間に追加:

```yaml
- name: Lint & typecheck
  run: |
    pnpm lint
    pnpm typecheck

- name: Run unit tests
  run: pnpm -r run test
```

確定事項:

- `pnpm -r run test` で plugin と kintone-mcp の vitest を両方実行する (`test` script を持つ package のみ走る)
- lint / typecheck も同時に追加する (現状ローカルフックのみで CI 未検証のため)
- E2E は requirements どおりスコープ外

## 変更ファイル一覧

| ファイル | 変更 |
|---|---|
| `packages/kintone-mcp/src/tools/utils/build-query.ts` | assertFieldCode / quoteValue 追加、全条件生成に適用 |
| `packages/kintone-mcp/tests/tools/build-query.test.ts` | インジェクションテスト追加 |
| `packages/kintone-mcp/src/oauth-callback.ts` | targetOriginFromState 追加、postMessage 条件化 |
| `packages/kintone-mcp/tests/oauth-callback.test.ts` | オリジン検証テスト追加 |
| `packages/kintone-mcp/src/credentials-upsert.ts` | encodeURIComponent + 形式チェック + sanitizeError 適用 |
| `packages/kintone-mcp/src/_http.ts` | sanitizeError 追加 |
| `packages/kintone-mcp/src/skills-sync.ts` `files-download.ts` `mcp.ts` | ログ出力を sanitizeError 経由に |
| `packages/kintone-mcp/tests/credentials-upsert.test.ts` ほか | パス改変・サニタイズのテスト追加 |
| `packages/plugin/src/core/oauth/pkce.ts` | state にオリジンセグメント追加 |
| `packages/plugin/src/core/oauth/pkce.test.ts` (相当) | state 形式のテスト更新 |
| `packages/plugin/scripts/build.mjs` または version 定義 | WORKER_BUNDLE_VERSION バンプ |
| `.github/workflows/build-plugin.yml` | lint / typecheck / test ステップ追加 |

## 影響範囲

- Worker のツール入出力スキーマ: 変更なし (不正入力がエラーになるのみ)
- OAuth フロー: 新プラグイン + 新 Worker で従来どおり。旧 state 形式は手動コピーにフォールバック
- kintone クエリ: 日本語フィールドコードを含む既存の正常系クエリは全て従来どおり生成される

## PR 分割

1. **PR-1**: A + C (Worker 内で完結、互換性影響なし) + D (CI)
2. **PR-2**: B (plugin と Worker をまたぐ state 形式変更。リリースノート必須)
