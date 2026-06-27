# tasklist.md — Issue #124

## フェーズ1: 原因特定（診断）
- [x] requirements.md 作成・承認
- [x] design.md 作成
- [x] 診断スクリプト `scripts/diagnose-oauth-refresh.mjs` 作成
- [x] 診断スクリプト実行（user 環境 / `.env` の ANTHROPIC_API_KEY）→ findings.md 参照
- [x] A/B/C/D を構造面で全て反証（refresh_token 有・config 完全・自動再push 無・cybozu 無期限/非ローテーション）
- [x] **実リフレッシュ強制実行で最終確定**（probe-oauth-refresh.mjs）
  - 結果: **refresh_ok**。失効済 access_token が自動リフレッシュされツール成功。expires_at 更新を確認。
  - → 配管は健全。原因は検知側（候補2）or 外部失効（候補3）or 既解消（候補4）に確定。

## フェーズ1.5: 観測計装（再現時に証拠を掴む機構）✅ 実装完了
理由: 現状 debug() は揮発 console のみ。再認可バナーが出ても「何が引き金か/その時 grant は生きていたか」が残らず、推測しかできなかった。挙動は変えず観測専用で永続記録する。
- [x] `core/managed-agents/resources.ts` に `validateMcpOAuth()` 追加 + 型 `McpOAuthValidation`
- [x] `core/oauth/authDiagnostics.ts` 新規: localStorage リングバッファ(50件) + `captureAuthFailure()` + `window.__coworkAuthLog()` 露出
- [x] `useEventPoller.ts` 発火点に観測フック挿入（挙動不変・fire-and-forget）
- [x] テスト: authDiagnostics.test.ts (7) / 既存 useEventPoller(37) 含む全 1072 通過 / lint クリーン
- [ ] デプロイ後、再認可が起きたら `window.__coworkAuthLog()` で証拠を収集
  - validate.status='valid' → 誤検知/一過性（候補2 確定）
  - validate.status='invalid' → 本物の grant 喪失（候補3 確定）

## フェーズ2: 恒久修正（観測で原因確定後に詳細化）
- [ ] 【A の場合】token 交換レスポンスの refresh_token 有無を実地確認
- [ ] 【A の場合】cybozu.com OAuth クライアント設定 / scope の発行可否を確認・ドキュメント化
- [ ] 【A の場合】refresh_token 欠落時のユーザー警告導線（useUserBinding.ts）
- [ ] 【B の場合】再 upsert で refresh_token を上書きしない運用に統一
- [ ] 【C の場合】connect() 再実行時に既存 refresh を温存
- [ ] ≥1h 放置後の継続動作を検証

## フェーズ3: 検知導線改善（できれば / 最小）
- [ ] `vault_credential.refresh_failed` Webhook 購読の設計メモ
- [ ] 別 Issue 切り出し判断（#93/#114 と関連）

## 完了条件（Issue 受け入れ条件）
- [ ] 原因が特定されている
- [ ] ≥1h 経過後もユーザー操作なしで連携継続
- [ ] refresh_token ローテーションが保持される
- [ ] リフレッシュ失敗の検知/再連携導線が機能
