# tasklist.md — Memory Stores 統合（#15 Step 1 + Step 2）

design.md に基づく実装タスク。Step 1（基盤）→ 動作確認 → Step 2（Settings 統合 UI）の順。

## Step 1 — 基盤（メモリを attach して agent が自律読み書き）

### M0. Memory API クライアント + 型
- [ ] `core/managed-agents/types.ts`: `MemoryStore` / `Memory` / `MemoryPrefix` 型追加
- [ ] `core/managed-agents/memory.ts` 新設: store CRUD（create/list/retrieve/update/archive）+ memory CRUD（list/create/retrieve/update(precondition)/delete）。全呼出で beta を `agent-memory-2026-07-22` に置換（extraHeaders）
- [ ] `memory.test.ts`: 各呼出の path / beta ヘッダ / body を検証（fetch mock）

### M1. store 解決 + seed
- [ ] `core/bootstrap/resolveMemoryStore.ts` 新設: `resolveUserPreferencesStore` / `resolveAgentContextStore`（name 一意キーで find-or-create、in-flight 保護、seed）
- [ ] seed: 存在チェック → 無ければ create、409 は無視（冪等）
- [ ] 失敗時 null フォールバック
- [ ] `resolveMemoryStore.test.ts`

### M2. Session attach + トグル
- [ ] `resolveSession.ts`: `SessionContext.memoryResources` → `createSession.resources`
- [ ] `useSession.ensureSession`: memoryEnabled=true のとき 2 store を並列解決 → resources 構築（失敗は catch→null）
- [ ] `memoryEnabled` を per-user localStorage 永続化（既定 ON）。`MemoryToggle` を enabled 化 + ChatPanel/Header 配線
- [ ] トグル/attach の単体 + 結線テスト

### M3. システムプロンプト
- [ ] `builtInAgents.ts` COMMON_GUARDRAILS + `resolveAgent.ts` に「メモリ」ブロック追記
- [ ] Default Agent promptVersion bump（v20→v21）。built-in の版反映方針を確認（tools 非変更）

### M4. Step 1 検証
- [ ] tsc / lint / vitest / build 緑
- [ ] （手動）トグル ON で「ですます調が好み」→ 新規会話で継承（US-1）

## Step 2 — Settings 統合 UI（閲覧/編集）

### M5. SettingsView 骨格への差し込み
- [ ] 既存 SettingsView プリミティブ（PaneHeading / SectionLabel / SectionCard / panePadding / ghostBtn）の実体を確認・不足は追加
- [ ] `SettingsNav.tsx`: `memory` 項目追加（perUser=非 adminOnly）+ `SettingsSection` 型に `'memory'`
- [ ] `Header.tsx`: ⚙️ gear を全ユーザーに開放（非 admin は memory/定期実行のみ）
- [ ] SettingsView subtitle 微調整

### M6. MemorySection 移植 + CRUD 配線
- [ ] `desktop/settings/MemorySection.tsx`: ハンドオフ参照実装を既存プリミティブ/アイコン/Markdown/Banner/ConfirmDialog に読み替えて移植
- [ ] `core/chat` or `core/managed-agents` に `memoryStore.ts` ヘルパー移植（basename/byteLabel/relativeTime/isStoreEmpty/resolveSelection ほか）
- [ ] `desktop/settings/MemorySectionBound.tsx`: store 解決 + listMemories + retrieve(view=full) + save(precondition,409→conflict) + delete
- [ ] SettingsView detail ルータに `section==='memory'` を追加

### M7. Step 2 検証
- [ ] `MemorySection` / `MemorySectionBound` / `SettingsNav` / `Header` テスト
- [ ] tsc / lint / vitest / build 緑

## 横断
- [ ] docs/functional-design.md §0.14 追記
- [ ] （手動 or E2E）設定→メモリでツリー/閲覧/編集/削除
- [ ] PR
