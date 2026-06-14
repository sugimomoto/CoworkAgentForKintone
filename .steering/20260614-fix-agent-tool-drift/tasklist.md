# タスクリスト: ツールドリフト修復 (#86)

## T1. 実装 (resolveBuiltInAgents.ts)
- [x] T1.1 `djb2` ハッシュ + `computeToolsVersion(purpose, spec)` + `builtInToolsVersion(purpose)` を追加 (export)
- [x] T1.2 `doResolveBuiltIn`: `toolsVersion` を算出し `fullMetadata` に追加
- [x] T1.3 再利用パスを `reconcileBuiltInAgentTools(...)` 経由に変更
- [x] T1.4 `reconcileBuiltInAgentTools`: 一致 → no-op / 不一致 → updateAgent パッチ / 409 → retrieve 再試行 (最大3回)
- [x] T1.5 `retrieveAgent` / `updateAgent` / `ApiError` の import を追加

## T2. テスト (resolveBuiltInAgents.test.ts)
- [x] T2.1 既存「再利用 (POST 0 回)」の fixtures に正しい `toolsVersion` を付与し no-op を維持
- [x] T2.2 追加: drift (toolsVersion 未設定) → `/v1/agents/{id}` updateAgent が呼ばれ tools に propose_agent が含まれる
- [x] T2.3 追加: 409 → retrieve で別タブ修復済みなら再試行しない
- [x] T2.4 `builtInToolsVersion` の決定性 (同入力で同値) を軽く検証

## T3. 検証
- [x] T3.1 `pnpm lint` / `pnpm typecheck` / `pnpm -r run test` green
- [x] T3.2 `pnpm --filter @cowork-agent/plugin run build` green
- [ ] T3.3 (任意) ローカル kintone で実機確認: デザイナーに設計依頼 → 作成モーダルが開く

## T4. 仕上げ
- [ ] T4.1 commit (Conventional / 日本語)
- [ ] T4.2 PR 作成 (closes #86) → CI green → squash merge
