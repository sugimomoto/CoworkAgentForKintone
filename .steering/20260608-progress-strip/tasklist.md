# タスクリスト: 進行インジケータ + 応答遅延バナー廃止 (Issue #53)

requirements.md / design.md に基づく実装タスク。上から順に実施。

## T1. 共通基盤 (型 + 純関数)

- [ ] T1.1 `core/managed-agents/progressEvent.ts` を新規作成
  - `ProgressEventKind` 型 export
  - `mapEventToProgressKind(e: SessionEvent): { kind, toolName? } | null` 純関数
- [ ] T1.2 `core/managed-agents/progressEvent.test.ts` を新規作成
  - 各 event type → kind マッピング検証
  - tool_use 系で toolName が拾えること
  - 未対応 event は null

- [ ] T1.3 `core/managed-agents/progressLabel.ts` を新規作成
  - `progressLabelOf(kind, toolName): string` 純関数
- [ ] T1.4 `core/managed-agents/progressLabel.test.ts` を新規作成
  - 各 kind の文言検証
  - tool_use + null toolName で「ツール実行中…」
  - tool_use + 名前ありで「ツール実行中: <name>」

## T2. chatStore 拡張

- [ ] T2.1 `store/chatStore.ts` に 3 field + setter 追加
  - `lastEventAt: number | null`
  - `lastEventKind: ProgressEventKind | null`
  - `lastToolName: string | null`
  - `setLastEvent(at, kind, toolName?)`
  - `clearLastEvent()`
- [ ] T2.2 `setAgentRunning(false)` のときに lastEvent 系もクリアするよう修正
- [ ] T2.3 `store/chatStore.test.ts` に新規ケース追加
  - `setLastEvent` で 3 field が更新される
  - `clearLastEvent` で null に戻る
  - `setAgentRunning(false)` で lastEvent もクリア

## T3. useEventPoller 連携

- [ ] T3.1 `desktop/hooks/useEventPoller.ts` の poll 内 event ループで `mapEventToProgressKind` を呼び、`setLastEvent` 経由で store 更新
- [ ] T3.2 useEventPoller の既存テストを確認、必要なら新規追加 (event 受信で setLastEvent が呼ばれること)

## T4. 経過秒 hook

- [ ] T4.1 `desktop/hooks/useElapsedSinceEvent.ts` を新規作成
- [ ] T4.2 `desktop/hooks/useElapsedSinceEvent.test.ts` を新規作成
  - null で 0
  - 数値で開始時点 0、1s 経過で 1 (fake timers)
  - lastEventAt 変更で 0 にリセット

## T5. ProgressIndicator component

- [ ] T5.1 `desktop/components/ProgressIndicator.tsx` を新規作成
  - phase !== 'running' で null
  - dot アニメ + ラベル + 経過秒
  - tailwind class で absolute bottom-left + 角丸 chip スタイル
  - aria-live="polite", role="status", data-testid
- [ ] T5.2 `desktop/components/ProgressIndicator.test.tsx` を新規作成
  - phase=idle で何も描画されない
  - phase=running + 各 kind でラベル正しい
  - elapsed が表示される
  - aria 属性

## T6. 静的 thinking 表示

- [ ] T6.1 `desktop/components/MessageItem/ThinkingStatic.tsx` を新規作成
  - AgentAvatar + 「考え中…」テキスト (muted 色, アニメなし)
- [ ] T6.2 `desktop/components/MessageItem/ThinkingStatic.test.tsx` を新規作成
  - スナップショット

## T7. MessageList 統合

- [ ] T7.1 `desktop/components/MessageList.tsx` の thinking 描画を `ThinkingStatic` に差し替え
- [ ] T7.2 MessageList 外側に `relative` wrapper を追加し `<ProgressIndicator />` を sibling として overlay 配置
- [ ] T7.3 既存 `MessageList.test.tsx` を確認、ThinkingDots アニメ前提のテストがあれば調整

## T8. CSS / アニメ

- [ ] T8.1 `styles/global.css` (もしくは tailwind 設定) に `@keyframes fade-in` を追加
- [ ] T8.2 ProgressIndicator が fade-in する動作確認 (テスト不要)

## T9. ChatPanel から旧バナー削除

- [ ] T9.1 `ChatPanel.tsx` から `useElapsedSeconds` import を削除 (ToolCard 等の他 import は残す)
- [ ] T9.2 `elapsedSeconds` / `SLOW_THRESHOLD_S` / `isSlow` 変数とその Banner 描画を削除
- [ ] T9.3 `ChatPanel.test.tsx` の `slow-response` バナーテストがあれば削除

## T10. 品質保証

- [ ] T10.1 `pnpm --filter @cowork-agent/plugin test` で全 test green
- [ ] T10.2 `pnpm --filter @cowork-agent/plugin typecheck` で error TS 数が増えていない
- [ ] T10.3 `pnpm --filter @cowork-agent/plugin build` で plugin ビルド成功

## T11. 結合検証

- [ ] T11.1 ブラウザでチャット起動 (`pnpm plugin:deploy` 後 kintone で確認)
- [ ] T11.2 「案件管理のデータを取得して、顧客ごとの売上を分析してください」 (= sesn_01DBCngSEghmYJYbh74vooYY 再現) を流して以下を目視確認:
  - 61s ギャップでも ProgressIndicator が消えない
  - ラベルが event に応じて変わる
  - 経過秒が 1s 刻みで進む
  - 応答遅延バナーが出ない
  - メッセージリスト末尾の thinking 表示が静的
  - ターン完了で ProgressIndicator が消える
  - スクロールしても ProgressIndicator は左下に留まる
- [ ] T11.3 中断 (Composer 側) で ProgressIndicator が消えること

## T12. コミット & PR

- [ ] T12.1 ブランチ `feat/progress-indicator` を切る
- [ ] T12.2 まとまった単位でコミット (T1 / T2-T4 / T5-T6 / T7-T8 / T9 / テスト)
- [ ] T12.3 push + PR 作成 (#53 を Close する body)

## 完了定義

- [ ] requirements.md の AC-1 〜 AC-9 全て満たす
- [ ] 全 887+ test green
- [ ] typecheck error 数が pre-existing 18 件のまま
- [ ] PR 作成 (Issue #53 に Close リンク)
