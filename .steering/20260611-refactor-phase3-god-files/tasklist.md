# タスクリスト: リファクタリング Phase 3 — God ファイル分割

requirements.md / design.md に基づく実装タスク。PR-A / PR-B は並行可。PR-C → PR-D の順。各 PR 内では「移動 commit」→「ロジック変更 commit」を分ける。

## T1. resolveAgent.ts 分割 (PR-A)

- [x] T1.1 `core/bootstrap/findResourceByMetadata.ts` を新設 + ユニットテスト (ページング / 見つからない / 複数ページ目でヒット)
- [x] T1.2 `resolveEnvironment.ts` / `resolveVault.ts` / `resolveAgent.ts` のメタデータ探索を `findResourceByMetadata` 経由に置換 (既存テスト green を確認)
- [x] T1.3 `core/bootstrap/buildAgentTools.ts` を新設し、Default / Built-in のツール定義構築 (現 resolveAgent.ts L313-346, L657-695) を移動・共通化
- [x] T1.4 `core/bootstrap/resolveBuiltInAgents.ts` を新設し、`resolveBuiltInAgents()` / `resolveBuiltInOne()` + in-flight キャッシュ (現 L539-695) を移動
- [x] T1.5 `resolveAgent.ts` に `resolveDefaultAgent()` 系のみ残し、未使用 export (`DEFAULT_AGENT_SKILLS` 等) を削除
- [x] T1.6 `resolveAgent.test.ts` を `resolveBuiltInAgents.test.ts` / `buildAgentTools.test.ts` に分割・移行
- [x] T1.7 `useSession.ts` (Phase 2 後は `initializeSession.ts`) の import を更新
- [x] T1.8 検証: 各ファイル 450 行以下 / `pnpm -r run test` green

## T2. chatStore スライス化 (PR-B)

- [x] T2.1 `store/utils.ts` に `upsertInArray<T>` を新設 + ユニットテスト
- [x] T2.2 `store/slices/` に 6 スライスを新設 (message / session / artifact / binding / file / agent) — 既存ロジックの移動のみ、フィールド名・関数名は不変
- [x] T2.3 `chatStore.ts` をスライス合成 + 跨り操作 (`startNewConversation` / reset) のみに縮小
- [x] T2.4 配列 upsert 系 (`upsertAgent` / `updateAttachedFile` / `saveWorkflowSnapshot`) を `upsertInArray` 経由に統一
- [x] T2.5 テストをスライス単位に分割 (`artifactSlice.test.ts` 等)。`chatStore.test.ts` は跨り操作テストとして整理
- [x] T2.6 追加テスト: `startNewConversation()` が pendingCustomToolUseIds / artifacts / attachedFiles を全てリセットする (現状の挙動を固定)
- [x] T2.7 検証: 利用側 20+ 箇所の diff がゼロ / 全テスト green

## T3. AgentDetailModal 分解 (PR-C)

- [x] T3.1 `desktop/components/ConfirmDialog.tsx` を新設 (現 ConfirmDeleteOverlay L657-705 を汎用化、見た目同一) + テスト
- [x] T3.2 `desktop/settings/agent-detail/useAgentModalMode.ts` を新設 (localMode / templateId / sourceAgent 算出 L106-146 を移動) + テスト
- [x] T3.3 フェッチ effect の依存配列から `localMode` を外し、mode 切替のみでは再フェッチしないことをテストで検証 (AC-4)
- [x] T3.4 `agent-detail/DraftForm.tsx` を独立 (L420-653)。`SkillsSection.tsx` / `ToolsSection.tsx` を抽出、`QuickActionsSection` を同ディレクトリへ移動
- [x] T3.5 `AgentDetailModal.tsx` を組み立てのみに縮小 (~350 行)
- [x] T3.6 `AgentDetailModal.test.tsx` (397 行) が無変更 (import 以外) で green / DraftForm 単体テストを新設
- [x] T3.7 手動確認: Agent 編集 / 雛形から作成 / 提案から作成 / 削除 / 初期値に戻す

## T4. SkillAddModal 分解 (PR-D)

- [x] T4.1 `desktop/settings/skill-add/parseSkillFile.ts` を新設 — JSZip 展開 / frontmatter パース / サイズ・拡張子バリデーションを React 非依存の純関数に
- [x] T4.2 `parseSkillFile.test.ts` を新設 (正常 zip / SKILL.md 欠落 / サイズ超過 / 不正 frontmatter / 単体 .md)
- [x] T4.3 `useSkillFileUpload.ts` を新設 (drag-drop 状態 + parseSkillFile 呼び出し)
- [x] T4.4 `SkillFileTab.tsx` / `SkillTextTab.tsx` を独立コンポーネント化
- [x] T4.5 `SkillAddModal.tsx` を ~250 行に縮小、既存テスト green
- [x] T4.6 手動確認: zip ドロップ / .md ドロップ / テキスト入力での追加

## T5. ConfigScreen 分解 (PR-E)

- [x] T5.1 `config/buildProxySteps.ts` を新設 (現 handleSave 内 L191-228) + ユニットテスト (OAuth のみ / API キーのみ / 両方 / どちらもなし)
- [x] T5.2 `config/hooks/useCloudflareDeployment.ts` を新設 (現 L121-171)。バージョンポーリングに cancelled フラグ + クリーンアップを実装 (AC-4)
- [x] T5.3 unmount 後に setState されないことをテストで検証
- [x] T5.4 `ConfigScreen.tsx` を ~300 行に縮小、既存テスト green
- [x] T5.5 手動確認: config 画面での Worker デプロイ → 保存 → desktop 側の動作

## T6. 仕上げ

- [x] T6.1 Phase 2 で残した型再エクスポート (MessageList / SkillAddModal) を削除し、import を一斉更新
- [x] T6.2 対象 5 ファイルが全て 450 行以下であることを確認
- [x] T6.3 `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green
- [x] T6.4 E2E 全スイート (smoke / config / session-history / live / artifact-foundation / customizer-wedge) ローカル実行
- [x] T6.5 `docs/repository-structure.md` に新ディレクトリ構成 (store/slices, agent-detail, skill-add 等) を反映

## 完了条件

- requirements.md の AC-1〜4 が全て満たされている
- 5 PR とも CI green でマージ済み
- 実環境で主要フロー (チャット / Agent 管理 / スキル追加 / config) の動作確認済み
