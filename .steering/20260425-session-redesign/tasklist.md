# Session 取り扱い再設計 — タスクリスト

要件: [requirements.md](./requirements.md)
設計: [design.md](./design.md)

凡例: 🟥 失敗するテスト先行 / 🟩 実装 / 🔵 リファクタ / ⬜ 設定・ドキュメント等

## S1. Store 層 (chatStore)

- [ ] 🟥 `chatStore.test.ts` 拡張 — `view` 初期値 `'chat'`、`setView` で切替できる
- [ ] 🟥 `chatStore.test.ts` 拡張 — `startNewConversation()` で `messages` が空、`sessionId` が `null` になる (`view` は変更しない)
- [ ] 🟩 `chatStore.ts` に `view` / `setView` / `startNewConversation` を追加

## S2. Bootstrap 層 (Session API)

- [ ] 🟥 `resolveSession.test.ts` 書換 — `createUserSession(ctx)` が `createSession` を呼び、metadata に source/kintoneDomain/kintoneUserCode/agentId を含む
- [ ] 🟥 `resolveSession.test.ts` 追加 — `listUserSessions(ctx)` が `agent_id` 指定 + `order: 'desc'` で listSessions を呼び、metadata で絞り込んだ Session を返す
- [ ] 🟥 `resolveSession.test.ts` 追加 — `listUserSessions` が他ユーザー / 他 source を除外する
- [ ] 🟩 `resolveSession.ts` に `createUserSession` / `listUserSessions` を追加 (既存 `resolveUserSession` は次ステップで削除)

## S3. Hook 層 (useSession の責務縮小)

- [ ] 🟥 `useSession.test.ts` 書換 — マウント時に `resolveDefaultAgent` と `resolveBootstrapEnvironment` だけ呼ばれ、Session API は呼ばれない
- [ ] 🟥 `useSession.test.ts` 追加 — `ensureSession()` 初回呼出で `createUserSession` が 1 回呼ばれ、`sessionId` が store に保存される
- [ ] 🟥 `useSession.test.ts` 追加 — `ensureSession()` を 2 回連続呼んでも `createUserSession` は 1 回しか走らない (in-flight 保護)
- [ ] 🟥 `useSession.test.ts` 追加 — 既存 `sessionId` がある状態で `ensureSession()` を呼ぶとそれを返す (再作成しない)
- [ ] 🟥 `useSession.test.ts` 追加 — `selectSession(id)` で sessionId 切替 + messages クリアされる
- [ ] 🟥 `useSession.test.ts` 追加 — `startNewConversation()` で sessionId が null、messages が空になる
- [ ] 🟩 `useSession.ts` を新仕様に書換 (Agent/Env のみ resolve、`ensureSession` / `selectSession` / `startNewConversation` を返す)

## S4. ChatPanel (送信時 ensureSession)

- [ ] 🟥 `ChatPanel.test.tsx` 修正 — `status === 'ready'` かつ `sessionId === null` で Composer が enabled
- [ ] 🟥 `ChatPanel.test.tsx` 追加 — `sessionId === null` で送信すると `ensureSession` が呼ばれ、続けて `postUserMessage` が呼ばれる
- [ ] 🟥 `ChatPanel.test.tsx` 追加 — `sessionId` 既存時は `ensureSession` が呼ばれない (再作成しない)
- [ ] 🟩 `ChatPanel.tsx` の `handleSubmit` を ensureSession 経由に修正 / disabled 条件緩和

## S5. Header に履歴ボタン + 新規会話ボタン

- [ ] 🟥 `Header.test.tsx` 追加 — `onHistoryClick` を渡すと履歴アイコンが描画され、押下で呼ばれる
- [ ] 🟥 `Header.test.tsx` 追加 — `onNewConversationClick` を渡すと新規会話アイコンが描画され、押下で呼ばれる
- [ ] 🟥 `Header.test.tsx` 追加 — prop 未指定なら各ボタンが描画されない
- [ ] 🟩 `Header.tsx` に履歴 / 新規会話ボタンを追加 (SVG アイコン含む)

## S6. HistoryView 本体

- [ ] 🟥 `HistoryView.test.tsx` — マウント時に loading 表示 → fetch 解決後に Session 一覧が表示される
- [ ] 🟥 `HistoryView.test.tsx` — Session が空なら "まだ会話がありません" が表示される
- [ ] 🟥 `HistoryView.test.tsx` — fetch 失敗時にエラーメッセージと再試行ボタンが表示される
- [ ] 🟥 `HistoryView.test.tsx` — エントリクリックで `onSelect(sessionId)` が呼ばれる
- [ ] 🟥 `HistoryView.test.tsx` — エントリは `session.title` または `(無題)` のラベルと `created_at` の相対表現を表示
- [ ] 🟩 `HistoryView.tsx` 実装 (loading / empty / error / list の 4 状態)
- [ ] 🟩 相対日時ヘルパ `formatRelative(iso)` を `core/format.ts` あたりに追加 (今 / 数分前 / 今日 / 昨日 / 日付)

## S7. ChatPanel と HistoryView の view 切替

- [ ] 🟥 `ChatPanel.test.tsx` 追加 — `view === 'history'` のとき HistoryView がレンダリングされ MessageList/Composer は描画されない
- [ ] 🟥 `ChatPanel.test.tsx` 追加 — Header の履歴ボタンで view が切り替わる (chat ⇄ history)
- [ ] 🟥 `ChatPanel.test.tsx` 追加 — Header の新規会話ボタンで `startNewConversation` が呼ばれ、view は chat に戻る
- [ ] 🟥 `ChatPanel.test.tsx` 追加 — HistoryView の `onSelect` で `selectSession` が呼ばれ、view が chat に戻る
- [ ] 🟩 `ChatPanel.tsx` を view 切替対応に修正

## S8. 旧 API 削除 + クリーンアップ

- [ ] 🔵 `resolveUserSession` を削除 (S2 完了後の依存を見て安全に)
- [ ] 🔵 旧 `useSession` のオプション (`forceNew` など) 関連の参照を全削除
- [ ] 🔵 `desktop/index.tsx` 等で startNewConversation の hook 参照を新仕様に追従
- [ ] ⬜ unused import / 未使用 export の整理

## S9. E2E

- [ ] ⬜ `e2e/live.spec.ts` 既存「リロード後にユーザー発言が復元される (Session 再解決)」を「リロード後は履歴がクリアされる」に書換
- [ ] ⬜ `e2e/session-history.spec.ts` 新規 — 起動直後はチャット空、メッセージ送信で sessionId が確立、応答が来る
- [ ] ⬜ `e2e/session-history.spec.ts` — 履歴ボタンで HistoryView が開き、現在の会話が一覧に出る
- [ ] ⬜ `e2e/session-history.spec.ts` — 履歴エントリ選択でその Session の会話が画面に復元される
- [ ] ⬜ `e2e/session-history.spec.ts` — 新規会話ボタンで messages が空になり、再送信で別 sessionId の会話が始まる

## S10. 動作検証 (deploy + 手動)

- [ ] ⬜ `pnpm run deploy` + `pnpm app-deploy` で配信
- [ ] ⬜ 全 unit テスト緑
- [ ] ⬜ 全 E2E テスト緑
- [ ] ⬜ 手動: ブラウザでパネル開→空、送信→新規 Session 作成、履歴で過去 Session 復元、新規会話でクリーン状態

## 完了条件

- requirements.md の AC-1〜17 と NFR-1〜3 が全て満たされる
- Phase 1a tasklist は本変更で破壊しない (パネル開閉 / 設定画面 / API Key 保存 / smoke 全て継続して緑)
- 元 [.steering/20260425-initial-implementation/tasklist.md](../20260425-initial-implementation/tasklist.md) は変更しない (Phase 1a 履歴として残す)
