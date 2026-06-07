# tasklist.md — エージェント別 ACL (Issue #47)

> requirements.md / design.md に基づく実装タスク。チェックボックスは進捗管理用。
>
> **Phase 順序**:
> P1 = データモデル拡張 (AgentRecord + agentRecord + agentDetailApi) /
> P2 = accessControl.ts + filterAgentsByAccess.ts (純コア) /
> P3 = kintone REST API ラッパー (users.ts) /
> P4 = chatStore + useSession 拡張 (filter 適用) /
> P5 = AccessPicker.tsx 配置 + AgentDetailModal 組込 /
> P6 = AgentsListPane サマリ + 既存テスト補完 /
> P7 = 新規テスト (filter / accessControl / users / AccessPicker / agentRecord 追記) /
> P8 = typecheck + test + manifest bump

---

## P1. データモデル拡張

- [ ] **P1.1** `agentTypes.ts`: `AgentRecord` に `allowedUsers / allowedGroups / allowedOrganizations: readonly string[]` を追加
- [ ] **P1.2** `agentTypes.ts`: `META_KEY_ALLOWED_USERS / GROUPS / ORGANIZATIONS` 定数を export
- [ ] **P1.3** `agentRecord.ts`: `parseAccessCodes(raw)` ヘルパー追加 (silent fallback、空 / 不正 JSON / 配列内 non-string ガード)
- [ ] **P1.4** `agentRecord.ts`: `agentToRecord` の built-in / custom 両分岐に 3 配列復元を追加
  - built-in は **常に空配列** (spec カタログに ACL は持たない)
  - custom は `parseAccessCodes(meta[META_KEY_...])` で復元
- [ ] **P1.5** `useSession.ts` 内の `agentToRecord` (built-in 用 toAgentRecords ヘルパー) にも 3 配列空配列を埋める
- [ ] **P1.6** `agentDetailApi.ts`: `AgentEditDraft` に 3 フィールド追加
- [ ] **P1.7** `agentDetailApi.ts`: `mergeMetadataPatch` で 3 配列を JSON 化、空配列なら key 削除
- [ ] **P1.8** `agentDetailApi.ts`: `buildDraftFromAgent` / `buildDraftFromSpec` で 3 配列を初期化 (built-in / 雛形は空配列、edit モードは既存値継承)

## P2. accessControl.ts + filterAgentsByAccess.ts (純コア)

- [ ] **P2.1** 新規 ディレクトリ `packages/plugin/src/core/access/`
- [ ] **P2.2** ハンドオフ `accessControl.ts` をコピー (型 + サマリヘルパー 3 種 + `userLabel`)
- [ ] **P2.3** 新規 `filterAgentsByAccess.ts` を実装 (design.md §4 純関数)
- [ ] **P2.4** import の循環参照を確認 (agentTypes に依存、bootstrap や managed-agents には依存しない)

## P3. kintone REST API ラッパー (users.ts)

- [ ] **P3.1** 新規 `packages/plugin/src/core/kintone/users.ts`
- [ ] **P3.2** `fetchCurrentUserGroups(userCode): Promise<string[]>` — `/k/v1/user/groups.json?code=` を呼ぶ
- [ ] **P3.3** `fetchCurrentUserOrganizations(userCode): Promise<string[]>` — `/k/v1/user/organizations.json?code=`
- [ ] **P3.4** module-level cache (`AccessEntry[] | null`) + `fetchAllPages` (offset paging, size=100)
- [ ] **P3.5** `searchUsers / searchGroups / searchOrganizations(query, opts: { exclude })` を実装
  - キャッシュ済全件 → `name` / `code` substring 検索 → exclude 除外 → 上限 10 件
- [ ] **P3.6** `resolveAccessEntries(kind, codes)` — キャッシュから一致するものを返す (未知 code は除外)
- [ ] **P3.7** すべての関数で fetch エラー / kintone runtime 不在 (Vitest) は空配列フォールバック
- [ ] **P3.8** kintone REST 認証は cookie オリジン (追加ヘッダ不要、ただし `Content-Type: application/json` のみ)

## P4. chatStore + useSession 拡張

- [ ] **P4.1** `chatStore.ts`: `currentUserAccess: CurrentUserAccess | null` フィールド追加
- [ ] **P4.2** `chatStore.ts`: `isAdmin: boolean | null` フィールド追加
- [ ] **P4.3** `chatStore.ts`: `setCurrentUserAccess` / `setIsAdminResolved` setter
- [ ] **P4.4** `chatStore.ts`: `reset()` で 2 フィールド初期化 (null)
- [ ] **P4.5** `useSession.ts`: bootstrap の `Promise.all` に以下を追加:
  - `fetchCurrentUserGroups(kctx.kintoneUserCode).catch(() => [])`
  - `fetchCurrentUserOrganizations(kctx.kintoneUserCode).catch(() => [])`
  - `resolveIsAdmin().catch(() => false)`
- [ ] **P4.6** `useSession.ts`: 取得結果を `setCurrentUserAccess` + `setIsAdminResolved` に反映
- [ ] **P4.7** `useSession.ts`: `setBuiltInAgents` 呼出前に `filterAgentsByAccess(allRecords, ctx, isAdmin)` を適用

## P5. AccessPicker.tsx + AgentDetailModal 組込

- [ ] **P5.1** ハンドオフ `AccessPicker.tsx` を `packages/plugin/src/desktop/settings/AccessPicker.tsx` にコピー
- [ ] **P5.2** import path を修正 (`./accessControl` → `../../core/access/accessControl`)
- [ ] **P5.3** トークン置換 (design.md §6.2):
  - `text-on-accent` → `text-white`
  - `var(--color-accent, #0d9488)` → `var(--cw-accent)`
  - `var(--color-warn, #b45309)` → `var(--cw-warn)`
- [ ] **P5.4** `AgentDetailModal.tsx`: クイックアクションと Skills の間に `<AccessPicker ... />` を挿入
- [ ] **P5.5** `AgentDetailModal.tsx`: `update` callback で 3 配列を同期更新するヘルパー `handleAccessChange`
- [ ] **P5.6** `AgentDetailModal.tsx`: `AccessPicker` に kintone API ラッパー (`searchUsers / searchGroups / searchOrganizations / resolveAccessEntries`) を渡す

## P6. AgentsListPane サマリ + 既存テスト補完

- [ ] **P6.1** `AgentsListPane.tsx`: 各 Agent 行に `formatAccessSummary(...)` のサマリ表示を追加
- [ ] **P6.2** 「全員」表示時のみ globe アイコンを併記 (text-muted)
- [ ] **P6.3** 既存テストの `AgentRecord` リテラル / `makeAgent` ヘルパーに `allowedUsers: [], allowedGroups: [], allowedOrganizations: []` を補完:
  - chatStore.test.ts
  - Header.test.tsx
  - useCurrentAgentPurpose.test.ts
  - SettingsViewBound.test.tsx
  - AgentsListPane.test.tsx
  - AgentDetailModal.test.tsx
  - agentDetailApi.test.ts
  - agentRecord.test.ts
  - PresetAgentLanding.test.tsx

## P7. 新規テスト

- [ ] **P7.1** `filterAgentsByAccess.test.ts`:
  - admin (true) → 全 Agent 通す (private 含む)
  - admin null → 全 Agent 通す (一時的、private 含む)
  - admin false + ctx null → public + 3 配列空 のみ通す
  - admin false + visibility private → 除外
  - admin false + 3 配列空 → 全員 OK
  - admin false + allowedUsers 一致 → OK
  - admin false + allowedGroups 1 つ一致 → OK
  - admin false + allowedOrganizations 1 つ一致 → OK
  - admin false + どれも一致しない → 除外
- [ ] **P7.2** `accessControl.test.ts`:
  - `accessCounts({...})` 各パターン
  - `formatAccessSummary` (空 / 1 軸のみ / 複数軸混在)
  - `formatAccessFull` / `accessSummaryParts`
  - `userLabel({ code: 'sato', name: '佐藤太郎' })` → 「佐藤太郎（sato）」
- [ ] **P7.3** `users.test.ts`:
  - `fetchCurrentUserGroups` 200 → string[] 抽出
  - `fetchCurrentUserGroups` 404 / kintone runtime 不在 → []
  - `searchUsers` キャッシュ動作 (2 回目は fetch 呼ばれない)
  - `searchUsers` substring filter + exclude
  - `resolveAccessEntries` 未知 code は除外
- [ ] **P7.4** `AccessPicker.test.tsx`:
  - 全員バナー表示
  - 指定モードバナー表示 + 合計件数
  - 検索 input に文字 → debounce 300ms 後に searchXxx 呼出
  - 候補クリックでチップ追加 + 入力クリア
  - チップ × でチップ削除 + onChange 呼出
  - exclude 渡し (重複防止)
  - resolveEntries で初期 code を name 表示に解決
  - API エラー時に「再試行」ボタン表示 → クリックで再 fetch

## P8. typecheck + test + manifest bump

- [ ] **P8.1** `pnpm --filter @cowork-agent/plugin typecheck` で本変更による新規エラー 0 件を確認
- [ ] **P8.2** `pnpm --filter @cowork-agent/plugin test` で全 pass (新規 + 既存 835 件)
- [ ] **P8.3** `packages/plugin/plugin/manifest.json` の version を bump
- [ ] **P8.4** auto-deploy hook 経由で kintone への反映確認 (任意)

---

## 完了の定義

- requirements.md AC-1〜AC-34 が満たされている
- P1〜P8 が全てチェック
- 既存 835 件 + 新規テストが全部 green
- manifest version bump → auto-deploy 成功
