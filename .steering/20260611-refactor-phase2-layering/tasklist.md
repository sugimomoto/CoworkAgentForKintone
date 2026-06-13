# タスクリスト: リファクタリング Phase 2 — レイヤー是正 + 信頼性改善

requirements.md / design.md に基づく実装タスク。PR-1 → PR-2 → PR-3 の順に実施。

## T1. 型移動 (PR-1, design A)

- [ ] T1.1 `core/chat/types.ts` を新設し、`MessageList.tsx` からメッセージ系型 (`ChatMessage` / `ToolMessage` ほか union 一式) を移動
- [ ] T1.2 `MessageList.tsx` に core からの型再エクスポートを残す (既存 import を壊さない)
- [ ] T1.3 `core/skills/types.ts` を新設し、`SkillAddModal.tsx` から `CustomSkillInput` / `SkillFileEntry` を移動 + 再エクスポート
- [ ] T1.4 `eventInterpreter.ts:19` / `chatPanelSkillsSync.ts:14` の import を core 参照に変更
- [ ] T1.5 core 配下のテストファイルの import も core 参照に変更
- [ ] T1.6 `eslint.config.js` に `import/no-restricted-paths` を追加 (core → desktop / store を禁止)
- [ ] T1.7 検証: `grep -rn "from '.*desktop" packages/plugin/src/core/` が 0 件 / `pnpm lint` `pnpm typecheck` `pnpm -r run test` green

## T2. initializeSession 抽出 (PR-2, design B)

- [ ] T2.1 `core/bootstrap/initializeSession.ts` を新設 (Input / Result 型 + AbortSignal 対応)
- [ ] T2.2 `useSession.ts:62-195` のオーケストレーション (resolve 系 / ユーザーグループ取得 / ACL フィルタ / 初期 Agent 選択ロジック) を移動
  - localStorage 読み書きは hook 側に残し、`preferredAgentId` として渡す
- [ ] T2.3 `initializeSession.test.ts` を新設 (renderHook なしの純 async テスト)
  - 正常系: agents / initialAgentId / environmentId が解決される
  - built-in 解決失敗時のフォールバック
  - ACL フィルタで候補が絞られる / 全滅時の挙動
  - preferredAgentId が候補にない場合のフォールバック選択
  - signal abort で AbortError
- [ ] T2.4 `useSession.ts` を薄いラッパーに書き換え (AbortController + store 反映のみ、100 行未満)
- [ ] T2.5 `useSession` の既存テストを更新し green を確認
- [ ] T2.6 手動確認: 初回ロード / Agent 切替 / リロード後の前回 Agent 復元が従来どおり

## T3. リトライ戦略 (PR-3, design C)

- [ ] T3.1 `core/utils/retryWithBackoff.ts` を新設
- [ ] T3.2 `retryWithBackoff.test.ts` を新設 (fake timers)
  - 1 回目成功 / 3 回目成功 / maxAttempts 超過で reject
  - バックオフ間隔が 1s → 2s → 4s → 8s → 10s cap
  - signal abort で即中断
- [ ] T3.3 `useCustomToolResponder.ts` を再設計
  - POST 失敗: retryWithBackoff (max 5)
  - POST 成功後の echo back 待ち: 再 POST せず、60s タイムアウト
  - 上限/タイムアウト到達: `removePendingCustomToolUse` + ユーザー可視のエラーメッセージ追加
- [ ] T3.4 `useCustomToolResponder` のテストを新設/更新
  - POST 失敗 5 回で pending 除去 + エラーメッセージ
  - echo back 60s 未着で pending 除去 + エラーメッセージ
  - 正常系 (POST 成功 → echo back → remove) が従来どおり

## T4. 終了判定の単一ソース化 (PR-3, design D)

- [ ] T4.1 `core/managed-agents/sessionLifecycle.ts` を新設 (`isTerminated(signal)`)
- [ ] T4.2 `sessionLifecycle.test.ts` を新設
  - `archived_at !== null` / `status === 'terminated'` / `session.status_terminated` イベント / terminal event の各パターン
  - 非終了パターン (running 等) が false
- [ ] T4.3 `useEventPoller.ts` の 3 箇所の判定を `isTerminated()` 呼び出しに置換
- [ ] T4.4 `useEventPoller` 既存テストが green のまま (終了検知の挙動同一)

## T5. 仕上げ

- [ ] T5.1 `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green
- [ ] T5.2 E2E (smoke / live / session-history) をローカル実行
- [ ] T5.3 実環境確認: チャット送受信 / アーティファクト生成 / セッション終了表示
- [ ] T5.4 docs/ への影響確認 (`architecture.md` のレイヤー記述に「core は desktop に依存しない + ESLint 強制」を追記するか判断)

## 完了条件

- requirements.md の AC-1〜4 が全て満たされている
- 3 PR とも CI green でマージ済み
- core → desktop の import が ESLint で機械的に禁止されている
