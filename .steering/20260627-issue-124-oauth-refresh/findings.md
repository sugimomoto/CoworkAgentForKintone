# findings.md — Issue #124 診断結果（2026-06-27 実行）

## 診断ツール
`scripts/diagnose-oauth-refresh.mjs`（読み取り専用）で本プラグイン由来の Vault Credential を列挙し、
各 credential を `GET`（refresh 設定構造 + expires_at）+ `mcp_oauth_validate` で検査。

## 検出した credential（cybozu サブドメイン 2kzzfr8gc3l6）
| vault / cred | type | status | has_refresh_token | refresh_config | access_expires_at |
|---|---|---|---|---|---|
| vlt_…CcE4n / vcrd_…D8Z6Q3 | static_bearer | (n/a) | (n/a) | null | — |
| vlt_…CcE4n / vcrd_…RuZBEF | static_bearer | (n/a) | (n/a) | null | — |
| vlt_…CboPM / vcrd_…FruCb9 (user=sugimo.moto) | **mcp_oauth** | **valid** | **true** | token_endpoint=有 / client_secret_basic / scope=有 | 2026-06-07（**期限切れ ~20日前**） |
| vlt_…CaZPm / vcrd_…wkENQ (user=sugi.momoto) | **mcp_oauth** | **valid** | **true** | token_endpoint=有 / client_secret_basic / scope=有 | 2026-06-24（**期限切れ ~3日前**） |

※ static_bearer 2件は #13 通知用（mcp_oauth ではないため validate は invalid_request_error。無関係）。

## 仮説の判定
| 仮説 | 判定 | 根拠 |
|---|---|---|
| A: refresh_token 不在 | ❌ 反証 | mcp_oauth 2件とも has_refresh_token=true |
| B: ローテーション破綻 | ❌ ほぼ反証 | cybozu.com 公式: refresh_token は**無期限・ローテーションなし**（[cybozu.dev](https://cybozu.dev/ja/common/docs/oauth-client/add-client/)） |
| C: 旧トークン上書き | ❌ 反証 | `upsertKintoneCredential` 非テスト呼出は connect() のみ。自動再 push 経路なし |
| D: refresh 設定不全 | ❌ 反証 | refresh_config が完全（token_endpoint + client_secret_basic + scope） |

## 新たな決定的観測
- access_token の **expires_at が大きく過去**（20日 / 3日前）なのに validate=valid。
- → **Anthropic 側で実リフレッシュがまだ実行されていない**（実行されれば expires_at が更新されるはず）。
- → `mcp_oauth_validate` は「refresh 可能か（構造）」を見るだけで、**cybozu への実リフレッシュ HTTP を実行しない**（mcp_probe=null）。
- 結論: **構造はすべて正しい。問題は「実リフレッシュ実行の瞬間」にしか現れない**。validate では検出不能。

## 残る唯一の検証 = 実リフレッシュの強制実行
既存 credential を使って env+agent+session を作り、kintone ツールを 1 回呼ぶ。
access_token は既に失効しているので、Anthropic は必ず cybozu /oauth2/token へ refresh を試みる。
- 成功 → 自動リフレッシュは機能している（= 報告された不具合は現状再現せず / 既に解消の可能性）。
- 401 / invalid_grant 等で失敗 → **実リフレッシュ実行の失敗が確定**。エラー本文で cybozu 側の
  正確な原因（client_secret 不一致 / grant 無効 / scope 等）を捕捉できる。

→ 次手: `scripts/probe-oauth-refresh.mjs`（verify-mcp-oauth.mjs の派生、既存 credential 再利用版）を作って実行。
  agent/env/session は実行後に archive。billable（モデル呼び出し1回）なので実行前に承認を取る。

## probe 実行結果（2026-06-27, vcrd_011wkENQ / vlt_011CaZPm）= 決定的
- 失効済（3日前）の access_token に対し kintone-get-apps を実行 → **成功**（活動履歴/顧客管理/案件管理 を取得）。
- **access_expires_at: before=2026-06-24T03:17:08Z → after=2026-06-27T04:08:02Z**
  = Anthropic が cybozu /oauth2/token へ refresh を実行し新 access_token を取得・保存したことの直接証拠。
- ※ スクリプトの verdict ラベルは "unknown"（成功 result イベントの分類漏れ）。実体は **refresh_ok**。

### 結論: 実リフレッシュ配管は健全（候補1を反証）
- 無期限 refresh_token + 完全な refresh 設定 → 定常運用で再認可は本来ほぼ不要。実測でもそのとおり動く。
- よって #124 の「再認可を求められる」症状が現存するなら、原因は **plumbing ではなく検知側 or 外部失効**:
  - **候補2（本命）**: `isOAuthFailureText`（[useEventPoller.ts:31-47](packages/plugin/src/desktop/hooks/useEventPoller.ts#L31-L47)）が
    401/unauthorized/CB_OA01 等の広いパターンで bindingStatus を error に倒し、再認可バナーを過剰発火。
    リフレッシュ中の一瞬の 401 / OAuth 無関係の kintone エラーでも発火しうる。
  - 候補3: パスワード変更 / OAuth client secret 再生成 / 管理者失効による正当な失効（区別したい）。
  - 候補4: 報告が設定修正前の過去状態（既に解消の可能性）。

### 次タスクの重心
plumbing 修正は不要。**再認可検知の精度向上**（誤発火抑制 / 一過性 401 と本物の grant 失効の区別 /
できれば `vault_credential.refresh_failed` Webhook で能動確定）へ。
