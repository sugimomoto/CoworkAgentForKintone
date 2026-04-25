# Session 取り扱い再設計 — 要求定義

## 背景

Phase 1a で `resolveUserSession` は kintoneUserCode + kintoneDomain で metadata 検索して
**最新の既存 Session を自動再利用** する設計だった。
画面を開くだけで前回会話が復元される一方、以下の問題がある:

- 「過去の会話文脈を意図せず引き継いでしまう」 — 新しい問い合わせをしたいのに前回の話題が残る
- 「Session が事実上 1 ユーザー 1 本」になり、用途別の会話分離ができない
- 履歴を切替・参照する UI が無い

Phase 1b (認証基盤 / 読取 / HITL) に進む前に、**Session を会話単位 (chat thread) として扱う**
設計に切り替える。

## 受け入れ条件

### 起動時の挙動
- AC-1: パネルを開いた直後 (新規ロード) では、**チャット履歴は空**で表示される
- AC-2: 起動時には Session は自動作成・自動再解決されない (Agent と Environment の解決は従来通り早期実施して良い)
- AC-3: Composer は起動直後から入力可能 (Session 不在を理由に disable しない)

### 新規 Session 作成
- AC-4: ユーザーが最初のメッセージを送信した時点で **新しい Session を作成** する
- AC-5: 同じパネルで連続メッセージを送る場合、AC-4 で作成された Session を継続利用する (1 メッセージごとに作り直さない)
- AC-6: 「新規会話」ボタン押下時はこれまで通り Session を破棄 (= 参照を切る) して、AC-4 の状態に戻る

### 履歴画面
- AC-7: パネル内から「履歴」を開ける UI 入口がある (Header に履歴アイコンを追加など)
- AC-8: 履歴画面では、当該ユーザーが過去に作成した Session 一覧が**新しい順**で表示される
- AC-9: 一覧の各エントリには以下が表示される:
  - 作成日時 (相対表現可)
  - 識別ラベル (最初のユーザー発言の冒頭 30 文字程度。取れない場合は `(無題)`)
- AC-10: エントリをクリックすると、その Session を現在の表示対象として復元 (sessionId 切替 + 履歴再構成) できる
- AC-11: 履歴画面はチャット画面に戻れる (×ボタン or 戻るボタン)

### 永続化・スコープ
- AC-12: Session 一覧は Managed Agents API から **その都度取得** する (localStorage 等への永続化はしない)
- AC-13: 一覧フィルタは metadata の `source = "cowork-agent-for-kintone"` + `kintoneUserCode` + `kintoneDomain` 一致で行う
- AC-14: 削除機能はスコープ外 (Phase 1b 以降で必要なら検討)

### 既存仕様の維持
- AC-15: パネル開閉トグル (`⌘K` / Header の閉じる / FAB) の挙動に影響しない
- AC-16: 既存の 「`agent.message` を `[object Object]` で表示しない」「ターン終了後も poller が継続する」などの修正は維持
- AC-17: Phase 1a の単体テスト 155 件 + E2E 13 件は本変更後も全て緑のまま (該当箇所は修正)

## 非機能要件

- NFR-1: 履歴一覧の取得は 1 ページ目だけで十分 (上限 100 件)。ページング UI は今回スコープ外
- NFR-2: Session 切替 (履歴復元) は 5 秒以内に画面更新が始まる (poller が初回イベント取得して描画)
- NFR-3: AC-4 のオンデマンド Session 作成中はユーザーが連投しても重複作成しないこと (1 つの Session に in-flight Promise で集約)

## 想定するユーザーストーリー

> kintone を使う担当者として、画面を開いたときに過去の会話に引きずられずクリーンな状態で
> 新しい問い合わせを始めたい。一方で、過去のやり取りを参照したいときは履歴から呼び出せる必要がある。

## スコープ外 (今回はやらない)

- Session の自動命名・タイトル編集
- Session の削除・アーカイブ
- Session タグやお気に入り
- 検索機能
- ページング (100 件超)
- 別端末との同期表示 (元々 metadata 経由で読めるので副次的に動くが、UX 最適化はしない)

## 影響範囲 (要件レベル)

- `core/bootstrap/resolveSession.ts`: 再利用ロジックを廃止 / オンデマンド作成関数を新設
- `desktop/hooks/useSession.ts`: 起動時の Session 解決を停止、Agent/Environment のみ解決
- `desktop/ChatPanel.tsx`: 初回送信時に `ensureSession` を挟む
- `desktop/components/Header.tsx`: 履歴ボタン追加
- `desktop/HistoryPanel.tsx` (新規): Session 一覧 + 切替
- `core/managed-agents/resources.ts`: Session list の API ラッパ追加 (既にある場合は再利用)
- `store/chatStore.ts`: 履歴画面表示 / 復元の状態追加
- E2E: 履歴開閉 / Session 切替 / 起動時クリーン状態のテスト追加
