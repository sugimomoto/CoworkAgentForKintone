# 要求: 進行インジケータ + 応答遅延バナー廃止 (Issue #53)

## 背景

Cowork Agent for kintone のチャットパネルで、Agent ターンが長く続くと以下の問題が発生している:

1. **応答遅延バナーが進行中ターンでも誤発火する** — `ChatPanel.tsx:86-88` が `useElapsedSeconds(isAgentRunning)` でターン開始時刻から測っており、途中で event を受け取ってもリセットされない。30 秒経つと「応答に時間がかかっています (34秒経過)」が出るが、実際は Agent が順調に思考・ツール実行を進めている。
2. **思考・ツール実行中のローディング表示が薄い** — 複数ツールを呼ぶ長いターンで、ToolCard はスクロールで流れ、ThinkingDots は初回 1 行きり。「AI が止まっているように見える」フィードバックがユーザーから来ている。
3. **`agent.thinking` メッセージのアニメが永続化する** — `agent.thinking` を受け取るたびにリストに `{ kind: 'thinking' }` を追加し、ターン終了後も `…` のドットアニメが残り続ける。違和感の原因。

実セッション (sesn_01DBCngSEghmYJYbh74vooYY) の event 履歴を取得した結果、Anthropic LLM が **イベント 1 つ送らずに 61 秒間正常処理を続けるケース** が観測された (`agent.tool_result` → 次の `span.model_request_start` までの間)。つまり「最後の event から N 秒」のしきい値判定では誤発火を完全には防げない。

しかし `retrieveSession()` で取れる `session.status === 'running'` は Anthropic 公式の「生きているか」の真実なので、これを使えば「正常に動いているのに警告が出る」誤発火は完全に防げる。

## ゴール

「ちゃんと反応していることが画面上から伝われば、(遅延バナーを) 表示する必要が無い」「アニメーションがあると、人間はちゃんと進行しているんだ、と認識して退屈を感じにくくなる」というユーザー意向に沿って、以下を達成する:

- ターン進行中、ユーザーが「**今 Agent が何をしているか**」を**常時可視**で確認できる
- ターン進行中、**アニメーションが視界の決まった場所に流れ続ける** (= 退屈・心配を和らげる)
- ターン終了後はインジケータが消え、リストに残るのは**静的な履歴**のみ (アニメは引きずらない)
- 60 秒以上 LLM が応答しなくても、`session.status === 'running'` である限り正常進行として扱う (= 時間ベースの warning バナー廃止)

## スコープ

Issue #53 の 3 問題 (背景 1-3) を 1 PR で同時解決する:

- **A.** 応答遅延バナー (`ChatPanel.tsx:371-380`) を完全廃止
- **B.** 進行インジケータ (左下フロート / アニメあり) を追加
- **C.** メッセージリスト内の `agent.thinking` 由来表示を**静的化** (アニメをやめ「考え中…」テキストに)

## ユーザーストーリー

### US-1: 業務ユーザー (チャット利用者)

> 私は kintone でレコード一覧を開き、サイドパネルの Cowork Agent に「今月の受注を分析して」と依頼する。Agent が複数の kintone API を呼び、最終的にダッシュボードを生成するまでの 1〜2 分間、**画面の決まった場所 (左下) で何かが動き続けている**ことで「ちゃんと進んでいる」と分かって安心して待てる。さらにテキストが「思考中…」「ツール実行中: kintone-get-records」「結果を読んでいます…」のように変わってくれれば、何が起きているかも把握できる。

### US-2: 業務ユーザー (履歴を振り返る)

> ターン終了後にスクロールバックしたとき、過去の thinking ステップが**永続アニメ**で残っているのは混乱する。**静的な「考え中…」テキスト** として残ってくれれば「あの時点で考えてたんだな」と分かるが今は終わっていることが明らか。

### US-3: 管理者 (UX 品質)

> 「フリーズしている」と業務ユーザーから問い合わせが来るのを減らしたい。**60 秒 LLM が無音でも、Anthropic 側が `running` を返している限り正常**として表示し、warning バナーを出さないでほしい。

## 受け入れ条件

### AC-1: 進行インジケータが `phase === 'running'` 中に左下に常時表示される

- 表示位置: **チャットエリア (MessageList が描画されている領域) の左下にフロート** (絶対配置 / 角丸 chip 風)
- 表示条件: `phase === 'running'` のときのみ。`idle` / `awaiting-confirm` 時は非表示
- 横幅: 内容に応じて可変 (max 280px 程度)、画面圧迫しない
- 重ね順: MessageList の上、Composer の下に重なる
- 出現/消失: 軽くフェードイン/フェードアウト (~150ms)

### AC-2: インジケータには「常時動くアニメ」が含まれる

- 何かしらのアニメーション要素 (現 `ThinkingDots` のドット 3 点 / マスコット呼吸感 など — 詳細は design.md)
- アニメは event の有無に関わらず**常時動き続ける** (= 視覚的な「生きてる」感)
- 60 秒経過しても色変化・トーン変化なし (= 警告にしない)

### AC-3: インジケータのラベルが直近 event 種別に応じて切り替わる

最低限以下のマッピングを実装:

| 直近 event | ラベル |
|---|---|
| event 未受信 (`session.status_running` のみ) | 「思考中…」 |
| `agent.thinking` | 「思考中…」 |
| `agent.tool_use` / `mcp_tool_use` | 「ツール実行中: `<name>`」 |
| `agent.tool_result` / `mcp_tool_result` | 「結果を読んでいます…」 |
| `agent.custom_tool_use` | 「アーティファクト処理中」 |
| `agent.message` (直後 `tool_use` 無しの単独) | 「応答を組み立てています…」 |

### AC-4: 経過秒は「最後の event から」で測り、ラベル右側に表示

- 例: `🟢 ツール実行中: kintone-get-records · 12s`
- 1s 刻みで更新
- event 受信のたびに 0 にリセット
- 60 秒超でも色・トーンは変化させない

### AC-5: 中断ボタンは含めない (= 既存 Composer の中断トグルでカバー)

- 進行インジケータには中断 UI を**置かない** (= シンプルに保つ)
- 中断は引き続き Composer の送信→中断トグルから行う (既存挙動)

### AC-6: 応答遅延バナーが完全に削除される

- ChatPanel から `isSlow` / `SLOW_THRESHOLD_S` / `useElapsedSeconds(isAgentRunning)` 関連コードを削除
- `slow-response` の Banner も削除
- バナー削除に伴いテストも更新

### AC-7: `agent.thinking` 由来のメッセージを**静的化**する

- `eventInterpreter.ts` で `agent.thinking` を `{ kind: 'thinking' }` メッセージとして add する処理は維持するが、レンダリングは **アニメなしの静的「考え中…」表示** に変更
- MessageList 上でターン終了後も視覚的に静かなまま残る
- 既存の `pending-thinking-${Date.now()}` (`ChatPanel.tsx:112,250` 楽観的追加) は `ChatPanel.tsx:225-230` の既存ロジックで除去されるので影響なし
- もしくは: `agent.thinking` を**メッセージ化しない**選択肢もあるが、本要求では**静的に痕跡を残す** (US-3) を採る

### AC-8: フリーズ判定は既存 safety net で完結

- `session.status === 'idle' && stop_reason !== 'requires_action'` 時に `setAgentRunning(false)` する既存ロジック ([useEventPoller.ts:97-126](packages/plugin/src/desktop/hooks/useEventPoller.ts#L97)) はそのまま
- 新たな時間ベースのフリーズ判定は **入れない**
- 結果的に「Anthropic backend が止まっていないなら表示し続ける」UX になる

### AC-9: 既存テストは green を維持、新規ユニットテスト追加

- ChatPanel から削除した `slow-response` バナーのテストは消す
- 新規: 進行インジケータ component のスナップショット
- 新規: event 種別 → ラベル変換 (純関数) のユニット
- ThinkingDots → 静的版に変えたことで関連テスト調整
- 全 887+ test green

## 非ゴール (今回やらないこと)

- バナーをモーダル化する / 通知音を鳴らす など UX 拡張
- LLM extended thinking テキストの表示
- ツール実行履歴の別ペイン
- 進行インジケータを Header に統合する (= Header は別 issue)
- 進行インジケータに過去の event 履歴を残す (リストには残るので二重不要)
- マスコット (PebbleSprout) の復活 (= 別検討。今回はシンプルなドットで十分)

## 制約

- 既存 `useElapsedSeconds` 自体は ToolCard 側で残るので削除しない
- `useEventPoller` 内ですでに毎ポーリングで `retrieveSession()` を叩いているので、新規 API call は発生させない
- 進行インジケータは MessageList 領域の最下部スクロール挙動を妨げないこと (= MessageList の overflow に影響しない absolute positioning)

## 検討項目 (design.md で確定する)

- Q1: 進行インジケータの component 構造 — 単独 component / Composer の prop 拡張 / MessageList の overlay
- Q2: `lastEventAt` / `lastEventKind` / `lastToolName` を chatStore に置くか useEventPoller の ref に置くか (re-render 抑制)
- Q3: 経過秒 1s 更新を indicator 自身でやるか別 hook に切り出すか
- Q4: アニメ要素のデザイン — 既存 ThinkingDots 再利用 / マスコット風 / spinner
- Q5: ツール名表示 — そのまま (`kintone-get-records`) / ユーザー向け辞書マッピング (例: 「レコード検索中」) / 後者なら別 issue 化
- Q6: 静的「考え中…」の見た目 — `ThinkingDots` をアニメ無しモードに / 別 component を作る
- Q7: 90 秒超のテキスト緩和は入れるか (例: 「思考中…」→「もう少しお待ちください…」)
