# requirements.md — プリセットエージェント + ワンクリック実行 UX (Issue #45)

## 1. 目的

業務ユーザーが **「初回プロンプトを書かなくても価値が出る」** 状態を作る。
現状のチャットパネル起動直後はテキスト入力主体で、自由プロンプトを書けない/書きたくない業務ユーザーに刺さらない。これを **「並んでいるエージェントを選ぶ → クイックアクションのボタンを 1 つ押す → 成果が出る」** の 2 クリック導入に置き換える。

## 2. スコープ

### 2.1 含む

- チャットパネル起動時に **プリセットエージェント一覧 (カード/タイル UI)** を表示する
- 各プリセットエージェントに **クイックアクション 4〜5 個 (ワンクリック実行ボタン)** を並べる
- ボタン押下で **対応エージェントを選択 → 当該プロンプトで実行** を 1 アクションで行う
- 初回実行後は **既存のチャット画面に遷移** し、同一 session でフォローアップ対話を継続できる
- AgentRecord に **`quickActions: string[]`** を追加する (built-in / custom 共通)
- Built-in 3 variant (業務 / Customizer Opus / Customizer Sonnet) に既定のクイックアクションを 4〜5 個ずつ持たせる
- Custom Agent の admin 編集 UI (`AgentDetailModal`) でクイックアクションを編集できる
- 既存のフルチャット入力導線 (空入力からプロンプトを書いて送る) は **そのまま残す**

### 2.2 含まない

- プリセットの **GitHub 取り込み / マーケットプレイス的配布** → Issue #46
- 既存の Custom Agent 作成 UI の削除 / 整理
- 自由チャット入力の廃止
- アーティファクト出力フォーマットの強制 (Excel / PDF 固定化など) — system prompt 側で誘導はするが、ハードに強制しない
- スケジュール実行 / バッチ起動

## 3. ユーザーストーリー

### 3.1 業務ユーザー (端末でチャットパネルを開く一般ユーザー)

- AS A 業務ユーザー
- I WANT チャットパネルを開いた瞬間に **「何ができるのか」が一覧で見える**
- SO THAT 自分でプロンプトを考えなくても、ボタンを 1 つ押せば成果物が出る

### 3.2 業務ユーザー (続きで対話を深めたい)

- AS A 業務ユーザー
- I WANT ボタンで初回実行した後、**そのまま続きを自由に対話**できる
- SO THAT 出てきた成果物に「もう少し XX を足して」「別の切り口で」と修正・深掘りができる

### 3.3 admin (情シス / カスタマイザー)

- AS A admin
- I WANT 自社のエージェントに **業務に合ったクイックアクションを並べる**
- SO THAT エンドユーザーが自社の業務文脈に合ったボタンから入れる

### 3.4 admin (既存の自由チャットも使いたい)

- AS A admin
- I WANT プリセットを並べると同時に、**自由チャット入力もすぐ使える**
- SO THAT プロンプトを書ける層も従来通りすぐ作業できる

## 4. 受け入れ条件

### 4.1 起動時 UX

- [ ] AC-1: チャットパネル起動直後 (`messages.length === 0 && sessionId === null`) は、現状の `WelcomeMessage` の代わりに **プリセットエージェントの一覧画面 (アコーディオン形式)** が表示される
- [ ] AC-2: 一覧には **visibility === 'public'** のエージェントだけが並ぶ
- [ ] AC-3: 各アコーディオン行のヘッダーには **アイコン / 名前 / モデルバッジ (OPUS/SONNET) / 短い説明** が表示される
- [ ] AC-4: 展開された行の下に **クイックアクションのボタンが最大 5 個** 並ぶ (実数はエージェント側の定義に従う)
- [ ] AC-5: **既定エージェント (`isDefault: true`)** は一覧画面ロード時に **初期展開** されている (= 開いた瞬間からプロンプトが見え、1 クリックで実行できる)
- [ ] AC-6: 行ヘッダークリックで他の行を開閉できる。同時に開ける行は **1 つだけ** (排他)
- [ ] AC-7: 一覧画面と同時に、画面下部の **Composer (自由入力)** と ConversationUtilityBar (新しい会話 / 履歴) は引き続き表示される
- [ ] AC-8: 既存の OAuth 未連携時 (`ConnectKintoneButton`) の動作は壊さない (未連携時は従来通り Connect ボタンを優先)

### 4.1.1 エッジケース UX

- [ ] AC-9: 公開エージェントが **1 個だけ** の場合、アコーディオン chrome を省き **そのエージェントとプロンプトを中央寄せで直接提示** する
- [ ] AC-10: 公開エージェントが **6 個を超える** 場合、一覧上部に **検索ボックス** を自動表示する (名前・説明に対する case-insensitive 部分一致)
- [ ] AC-11: クイックアクションが **0 個** のエージェントを展開した場合、「このエージェントにはまだクイックアクションがありません。」+ 「自由入力で話しかける」CTA を表示する
- [ ] AC-12: パネル幅 360px でも横スクロールなしで成立する (1 カラム固定、左右 paddings ≦ 12px)

### 4.2 ワンクリック実行

- [ ] AC-13: クイックアクションボタンを押すと、以下が 1 アクションで行われる:
  - 対応エージェントが現在の選択エージェントと異なれば **エージェント切替** (`selectAgent` 経由) が実行される
  - そのプロンプト文字列を **`handleSubmit` 同等の経路で送信** する (= user message として残り、agent が応答する)
- [ ] AC-14: 送信後は **既存のチャット画面 (MessageList) に遷移** する (= プリセット一覧は消える)
- [ ] AC-15: 送信されたクイックアクションは **通常の user message として履歴に残る** (hidden ではない)
- [ ] AC-16: 既存のセッション継続フックが働き、同一 session 上で続けて自由入力できる
- [ ] AC-17: 未バインド (OAuth 未連携) 状態でボタンを押した場合は、既存の handleSubmit と同じく `pendingText` に保留 → connect 後に送信される
- [ ] AC-18: 「自由入力で話しかける」CTA を押した場合 (クイックアクション 0 個の行) は、エージェントだけ切替えて **Composer にフォーカス** を移し、送信は行わない

### 4.3 マイクロインタラクション

- [ ] AC-19: 一覧 → チャット画面の遷移は **即切替 + 160ms 程度の軽いフェード** (派手なモーフィングはしない)
- [ ] AC-20: プロンプトボタンの押下中は `active:scale-[0.99]` + accent 塗り + 影でフィードバック
- [ ] AC-21: アコーディオン行の chevron は開閉に合わせて 180° 回転 (transition ~200ms)

### 4.4 プリセット定義 (built-in)

- [ ] AC-22: `BUILTIN_AGENT_SPECS` (`packages/plugin/src/core/bootstrap/builtInAgents.ts`) に **`quickActions: readonly string[]`** が追加されている
- [ ] AC-23: 業務 / Customizer Opus / Customizer Sonnet の 3 variant に既定クイックアクションが **各 4〜5 個** 入っている
- [ ] AC-24: 既定クイックアクションの初期文言は本書 §6 で定義する (ハンドオフ準拠)
- [ ] AC-25: Built-in の quickActions は **spec カタログを source-of-truth** とし、Anthropic 側 metadata には書き込まない (= Plugin 再起動時に常に最新文言が反映される)

### 4.5 プリセット定義 (custom)

- [ ] AC-26: `AgentRecord` に **`quickActions: readonly string[]`** が追加されている (空配列許容)
- [ ] AC-27: Custom Agent については Anthropic Agent.metadata.quickActions に **JSON 配列文字列** として保存され、再 list 時に正しく復元される
- [ ] AC-28: `AgentDetailModal` (Custom Agent 編集 UI) に **クイックアクション編集セクション** が追加されている
  - 1 行 1 プロンプト形式の textarea (空行は無視)
  - 最大 5 個までに制限
  - 1 個あたりの長さ上限 (推奨 200 文字) を超えるとバリデーションエラー
- [ ] AC-29: 保存すると Anthropic 側 metadata が更新され、次回起動時にも反映される

### 4.6 既存導線の維持

- [ ] AC-30: Header の Agent プルダウン (admin 向け切替) は従来通り動作する
- [ ] AC-31: 履歴 / 新規会話 / Settings の各導線は壊れていない
- [ ] AC-32: 既存ユニットテスト (ChatPanel / WelcomeMessage / AgentsListPane / AgentDetailModal 等) が pass する (新スキーマに合わせて必要最小限の更新は許可)

## 5. 制約事項

- C-1: Anthropic Agent.metadata の string 値上限 (1KB 程度) を考慮し、quickActions は **JSON.stringify した値で 1 つのキーに格納** する (例: `metadata.quickActions = '["...","..."]'`)。1KB を超えそうな場合はクライアント側でバリデーションする
- C-2: Built-in Agent の quickActions は spec カタログ側 (`BUILTIN_AGENT_SPECS`) を **source of truth** とし、Anthropic 側 metadata には書き込まない (= Plugin が読み込み時に spec から注入する)
- C-3: Custom Agent の quickActions は **Anthropic Agent.metadata が source of truth** (admin が編集する)
- C-4: 既存 i18n やテキスト国際化基盤は未導入のため、日本語固定で構わない
- C-5: モバイル対応は当面スコープ外 (デスクトップのみ)
- C-6: **アイコンレンダリングは既存 `AgentIcon` コンポーネント** (`packages/plugin/src/desktop/components/AgentIcon.tsx`) を再利用する。ハンドオフバンドルの `AgentGlyph.tsx` は重複なので持ち込まない
- C-7: **モデルバッジは既存 `ModelBadge`** (`packages/plugin/src/desktop/components/ModelBadge.tsx`) を再利用する
- C-8: スタイルは既存 Tailwind デザイントークン (`bg-card` / `text-text` / `border-border` / `bg-accent` / `bg-accent-soft` 等) を使う。ハンドオフの `teal-600` ハードコードは置き換える

## 6. プリセットの初期文言 (built-in)

以下を Phase 1 のデフォルトとする。実装中に文言調整は自由。

> ハンドオフバンドル (`agents.ts` / `handoff/README.md`) の文言で確定。

### 6.1 業務エージェント (business)

1. 「kintone アプリ一覧を見せて」
2. 「先週追加された案件レコードを集計して」
3. 「未対応の問い合わせを一覧化して、優先度を提案して」
4. 「今月の売上をアプリから取得して、グラフ付きの Excel レポートにまとめて」
5. 「議事録の PDF からタスクを抽出して、タスク管理アプリに登録案を作って」

### 6.2 カスタマイザーエージェント (Opus / Sonnet 共通)

1. 「特定フィールドが空のとき保存できないようにする JS を作って」
2. 「一覧画面でステータスフィールドの色分けをする JS を作って」
3. 「保存時に別アプリのマスタを参照して値を自動入力する JS を作って」
4. 「フォーム読込時にカスタムボタンを追加して特定 URL を新規タブで開く JS を作って」
5. 「現在のアプリの fields 定義からサンプルレコード生成 JS を作って」

> Opus と Sonnet は同じ文言で出す (= 中身は同じ、モデル差だけ)。

## 7. ハンドオフバンドル参照

デザイン側の確定アウトプット (`.design-handoff` / 本リポジトリ外):

- **プロトタイプ HTML**: `Preset Agent Panel - Prototype.html` (アコーディオン案 = 案 A)
- **実装ハンドオフ**: `handoff/PresetAgentLanding.tsx`, `handoff/AgentGlyph.tsx`, `handoff/agents.ts`, `handoff/README.md`
- **採用案**: 案 A (アコーディオン)。プロトタイプ内の他案 (タブ/2列グリッド/横スクロール) は採用しない
- **マイクロインタラクション**: 「即切替 + 軽いフェード (160ms)」「`active:scale-[0.99]` + accent 塗り」
- **エッジケース処理**: 1 エージェントのみ / 6 個超 (検索ボックス自動表示) / プロンプト 0 個 — すべてハンドオフ側で挙動を確定済み

## 8. 残るオープン論点 (design.md で決める)

- Q-1: AgentDetailModal の quickActions 編集 UI の細部 — textarea のプレースホルダ / バリデーション文言 / 改行コードの扱い
- Q-2: 「自由入力で話しかける」CTA で Composer にフォーカスを移す具体的な仕組み — Composer に `ref` + `focus()` メソッドを公開するか、グローバルイベントで通知するか
- Q-3: 一覧 → チャット遷移時のフェードアニメーションの実装方法 — CSS animation 単独で十分か、React Transition Group のような状態管理が要るか
- Q-4: PresetAgentLanding をどのディレクトリに置くか (`packages/plugin/src/desktop/components/` 直下 or `desktop/landing/` を新設)

## 9. 関連

- Issue: #45 (本要件), #46 (配布方式)
- 影響ファイル予定:
  - `packages/plugin/src/desktop/ChatPanel.tsx` (起動時画面切替)
  - `packages/plugin/src/desktop/components/PresetAgentLanding.tsx` (新規・本要件のメイン UI)
  - `packages/plugin/src/desktop/components/WelcomeMessage.tsx` (フォールバック用に残すか削除するかは design.md で判断)
  - `packages/plugin/src/core/bootstrap/agentTypes.ts` (AgentRecord に quickActions 追加)
  - `packages/plugin/src/core/bootstrap/builtInAgents.ts` (BUILTIN_AGENT_SPECS に quickActions + デフォルト文言)
  - `packages/plugin/src/core/bootstrap/agentRecord.ts` (metadata ↔ quickActions 変換)
  - `packages/plugin/src/desktop/hooks/useSession.ts` (toAgentRecords への quickActions 反映)
  - `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` (Custom 編集 UI 追加)
  - 各 `*.test.ts(x)` で `AgentRecord` リテラルを作っているテストの `quickActions: []` 補完 (7 ファイル想定)
