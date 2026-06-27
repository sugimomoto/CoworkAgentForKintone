# requirements.md — Issue #124 kintone OAuth 自動リフレッシュ不全の調査・解消

## 対象 Issue
- #124 (bug, priority: P1, size: M, target:shared, tier:2-foundation)
- タイトル: kintone OAuth: 時間経過で access_token が自動リフレッシュされず再認可を求められる問題の調査・解消

## 背景・症状
- kintone access_token TTL ≒ 1時間。放置すると再認可（OAuth 同意やり直し）を求められる。
- 期待: Anthropic Vault Credential (`mcp_oauth`) の `refresh` ブロックにより、refresh_token で
  自動リフレッシュされ、ユーザー操作なしに連携が継続する。

## コード事前調査の結論（本ステアリング着手時点）
受け渡し経路（token 交換 → upsert → Worker → Anthropic ネスト body）は構造的に正しいことを確認済み。
原因仮説を 3 つに整理し、コード観点で評価した:

| 仮説 | 内容 | コード評価 |
|---|---|---|
| **A** | Vault に refresh_token が存在しない（kintone が未発行 or 経路欠落） | **本命**。refresh は全経路で「あれば付与」の条件付き。未発行なら refresh 無し credential になり症状と一致 |
| **B** | ローテーション破綻（kintone がリフレッシュ毎に refresh_token を回し、Anthropic 側で保持できない） | Anthropic 側挙動。コードから検証不能。A を潰した後の残件 |
| **C** | 再 upsert で初回 refresh_token を再 push し、ローテーション後の新トークンを上書き | **可能性低**。起動時チェックは list のみで再 upsert しない。再 push する `connect()` は手動/未バインド時のみで、放置失効と噛み合わない |

## 要求内容（やること）
1. **原因特定（最優先）**: 実際に失効したユーザーの `vault_id` / `credential_id` に対して
   `mcp_oauth_validate` を実行し、`has_refresh_token` / `refresh.status` / `mcp_probe` で A/B/C
   （または別要因）を確定する。
   - 単独実行できる **診断スクリプト**（既存ユーザー credential を metadata で列挙 → 各 credential を
     `mcp_oauth_validate`）を用意し、`.env` の `ANTHROPIC_API_KEY` で user がライブ実行できるようにする。
2. **恒久修正**: 特定された原因に応じて修正する。
   - A の場合: token 交換レスポンスの refresh_token 有無を確認。kintone OAuth クライアント設定／scope が
     refresh_token 発行に足りているかを確認し、足りなければ設定手順をドキュメント化＋（必要なら）
     refresh_token 欠落時にユーザーへ明示する導線を追加。
   - B の場合: Anthropic 側の正しい運用（再 upsert しない等）に揃える。
   - C の場合: 再 upsert 時に refresh_token を push しない／access_token のみ更新する経路に修正。
3. **検知導線の改善（できれば）**: 現状の MCP エラー文字列での事後検知に加え、
   `vault_credential.refresh_failed` Webhook 購読による能動検知へ移行検討。

## 受け入れ条件（Issue 準拠）
- [ ] `mcp_oauth_validate` で原因が A / B / C（または別要因）に特定されている
- [ ] access_token 失効（≥1h 経過）後も、ユーザー操作なしで kintone 連携が継続する
- [ ] refresh_token のローテーションが正しく保持され、連続したリフレッシュが成立する
- [ ] リフレッシュ失敗時の検知/再連携導線が機能する（できれば `vault_credential.refresh_failed` Webhook 化）

## 制約・前提
- 診断には実環境の ANTHROPIC_API_KEY と、失効を再現した実 credential が必要（user 環境で実行）。
- Worker はシークレットを静的保持しない原則を維持する（[[no-anthropic-key-in-cloudflare]]）。
- 既存 e2e 検証スクリプト `scripts/verify-mcp-oauth.mjs` の構造・ヘッダ規約を踏襲する。

## スコープ外
- リフレッシュ周りと無関係な OAuth 機能改修。
- Webhook 化（#93/#114 と関連）は本 Issue では「検討・最小導線」までとし、フル実装は別 Issue 候補。
