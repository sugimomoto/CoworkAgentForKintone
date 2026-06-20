# Handoff: Agent 通知先 Webhook 設定（#13）

Cowork Agent for kintone — `AgentDetailModal` に追加する **「通知」セクション** の実装ハンドオフ。
このフォルダだけで実装に着手できるよう、設計意図・採寸・トークン・参照実装をまとめています。

---

## Overview

admin が、Agent ごとに **処理結果の通知先（Slack / Microsoft Teams の Incoming Webhook）を1本** 登録するための新規セクション。

- **通知先は Agent ごとに1本**（Slack または Teams の Webhook URL を1つ）。
- 設定するのは **admin**。Agent 設定の一部として登録する。
- **platform は URL のホストで自動判定**して表示する（ユーザーに種別を選ばせない）。
  - `hooks.slack.com` → Slack / `*.webhook.office.com`・`outlook.office.com` 等 → Teams。
- **セキュリティ最重要**: Webhook URL は秘匿情報。保存後は**伏字**で、生 URL は二度と表示しない（パスワード入力と同じ扱い）。
- 「いつ送るか」はエージェントへの指示（依頼文・定期実行の文面）が決めるため、**この画面は「宛先の登録」だけ**。送信ポリシー UI は持たない。

保存される値はおおよそ次の形：

```ts
interface WebhookConfig {
  platform: 'slack' | 'teams';
  url?: string; // 新規/上書き保存時のみ送る。保存後サーバは url を返さない（伏字運用）。
}
// Agent.webhook: WebhookConfig | null  （null = 通知先 未設定）
```

---

## About the Design Files

このバンドルの HTML / JSX は **HTML で作った設計リファレンス**（見た目と挙動を示すプロトタイプ）であり、
そのままプロダクションに貼るものではありません。タスクは **これらの設計を対象コードベースの既存環境
（React + Tailwind + 既存トークン）で再現すること**です。環境が未確立なら、最適なフレームワークを選んで再現してください。

- `NotifySection.tsx` / `webhookPlatform.ts` は **そのまま流用できる React (TSX) + TS 参照実装**。
  CSS 変数トークン（`--cw-*`）に依存して書いてあるので、トークン定義さえ合っていれば最小修正で組み込めます。
- `prototype/` は触って確認するためのスタンドアロン版（vanilla React + Babel）。
  ブラウザで `Webhook Notify - UX Exploration.html` を開くと、全状態・kintone 文脈・IA 提案・UI コピーを実際に操作できます。
  **実装は `prototype/` のインライン style ではなく、ルートの TSX（`--cw-*` トークン）を正とすること。**

---

## Fidelity

**High-fidelity（hifi）**。配色・タイポ・余白・角丸・インタラクションまで確定済み。
既存 Settings / AgentDetailModal（`wedge-settings` 系）と同一トーンになるよう設計しているので、
既存コンポーネント/トークンを使ってピクセル単位で再現してください。

---

## Screens / Views

すべて **AgentDetailModal 内の「通知」セクション**（中央オーバーレイ・幅 560px・body は `overflow-y:auto`）。
配置は **「公開先(ACL)」セクションの直後・フッタ直前**（出口側＝配信の関心事としてまとめる）。

### セクションの骨格

1. **見出し**（`SectionLabel`）: ベルアイコン(13px, accent) + 「通知」 + 補足「処理結果を Slack / Teams に送信」(10px subtle) +
   右端に「宛先1本 / Agent」バッジ（鍵 9px、`bg:var(--cw-card-hi)`、`border:1px var(--cw-border)`、9px、角丸 3px）。
   `font-size:10.5px/700/uppercase/letter-spacing:0.6px`、`text:var(--cw-muted)`、`margin:0 0 9px 2px`。
2. **カード**: `bg:var(--cw-card); border:1px var(--cw-card-border); border-radius:12px; padding:14px 16px`。
3. カード内に **フィールド**（ラベル 11.5px/600 + 入力 + hint 10.5px/muted）= 既存モーダルの DField と同形。

### 1. 未設定（状態 1）
- ラベル「通知先 Webhook URL」。
- 空の秘匿入力（`font-mono` 12px、`border:1px var(--cw-border)`、角丸 7px、`padding:8px 11px`）。右端に **表示/隠す**（eye）トグル(14px subtle)。
- placeholder: `https://hooks.slack.com/services/T000/B000/XXXXXXXX`。
- hint（muted）「Slack または Teams の Incoming Webhook URL を貼り付けると、このエージェントが結果を通知できます。」
- **プラットフォームバッジは無し**。

### 2. 入力中・有効（状態 2）
- URL を入れると **ホストで Slack / Teams を自動判定**。
- 入力欄の **右脇に小バッジ**（eye トグルの左）を表示。同時に入力枠線を `var(--cw-accent)` に。
- hint は accent + チェックで「Slack の Incoming Webhook を検出しました。」/「Microsoft Teams の Incoming Webhook を検出しました。」
- 保存活性（モーダルフッタの「保存」ボタンが有効）。

### 3. 入力中・判定不能（状態 3）
- Slack/Teams どちらでもないホスト → バッジ無し。入力枠線 `var(--cw-warn)`。
- hint は warn + 警告三角で「対応していない Webhook です（Slack / Teams のみ対応）。」
- 保存不可。
- （URL として壊れている場合は subtle hint「URL の形式を確認してください。」）

### 4. 登録済み・伏字（状態 4）
- **伏字フィールド**: `bg:var(--cw-card-hi); border:1px var(--cw-border); border-radius:7px; padding:8px 11px`。
  左に 鍵(13px subtle) + `●●●●●●●●●●●●●●`（`font-mono` 12px、`letter-spacing:2px`、`var(--cw-muted)`、`user-select:none`）+ 右にプラットフォームバッジ。
  **eye トグルは出さない**（生 URL は二度と表示しない）。
- ステータス行（`margin-top:11px`）: 緑ドット(7px `#22c55e`) + 「{Slack|Teams} に設定済み」(12px/500) + spacer +
  「再入力で更新」（accent 11px/600）+ 区切り(1×11px) + 「解除」（warn 11px/600 + unlink アイコン）。
- 注記（subtle 10.5px、盾アイコン）「保存後の URL は表示されません。変更するには再入力してください。」

### 5. 解除確認（状態 5）
- 伏字フィールド直下にインライン展開（別モーダルにしない）。
- `bg:var(--cw-warn-soft); border:1px #f0c98a; border-radius:9px; padding:11px 13px`。
- unlink アイコン(warn) + 「この Agent の通知先を解除しますか？」(12.5px/700) + 「このエージェントは結果を通知しなくなります。Webhook URL の登録は削除されます。」(11px warn)。
- 右下に「キャンセル」(ghost) + 「解除する」（`bg:var(--cw-warn)` 塗り + unlink アイコン）。

### 4b. 再入力で更新（上書き）
- 「再入力で更新」押下 → 伏字を空の入力に戻し、ラベル右に「現在の設定を上書き」（warn 9.5px）を表示。
- 有効な新 URL を入れて保存するまで旧設定を維持。「上書きをやめる」リンクで伏字表示へ戻る。

### 6. 接続テスト（状態 6・任意）
- 登録済み状態の下部（`border-top` 区切り）に「テスト送信」ボタン（`bg:var(--cw-accent-soft)`、`text:var(--cw-accent)`、`border:1px var(--cw-accent)/0.2`、紙飛行機アイコン）。
- 押下 → **送信中**（スピナー + 「送信中…」muted）→ **成功**（`var(--cw-success)` + チェック「テスト通知を送信しました」）/ **失敗**（`var(--cw-danger)` + 警告「送信に失敗 — URL を確認してください」）。
- **MVP では任意**。実装方針は §「接続テスト 有る版 / 無い版」を参照（プロトは有る版を既定）。

### 7. built-in エージェントの設定導線（IA 提案 #7）
- built-in（業務エージェント等）は編集モーダルが Custom と別扱いのことがあるため、**一覧行に「通知」ボタン**を置き、
  押下で **通知セクションだけ**の軽量ポップオーバーを開く。
- ポップオーバー: `width:384px`、行の右上に anchored、`bg:var(--cw-card); border:1px var(--cw-border); border-radius:12px; box-shadow:0 16px 44px rgba(0,0,0,0.22)`。
  ヘッダ（ベル 26px タイル + 「通知先を設定」+ 対象 Agent ミニ + Built-in バッジ + ×）/ 本文（`<NotifySection hideHeader>`）/ フッタ（キャンセル + 保存）。
- **実装は AgentDetailModal と同一の `NotifySection` を `hideHeader` で再利用**。導線が別なだけ。

### 8. 一覧の既設インジケータ（IA 提案 #8）
- 通知先が設定済みの Agent 行に、**ベル + platform ドット**の小バッジ（`NotifyIndicator`）。
  `inline-flex; gap:4px; rounded-full; padding:1.5px 7px 1.5px 6px; font-size:9.5px/600`、色は platform（Slack=緑 / Teams=紫）の soft 背景 + 同色文字 + 末尾に 5px ドット。
- 行の2段目に「{platform} に設定済み」（muted）。未設定行は「通知先 未設定」(subtle) + 「通知を設定」ボタン（accent-soft）。

---

## Interactions & Behavior

- **自動判定**: 入力のたびに `detectPlatform(url)` を実行（debounce 不要・純粋関数）。スキーム無し入力は `https://` を補って判定。
- **保存活性**: `inEdit && (slack|teams)` のときだけモーダルフッタ「保存」を活性（`onValidityChange` で親へ通知）。
- **保存**: 親（AgentDetailModal）のフッタ「保存」で永続化。サーバは保存後 **url を返さず `{ platform }` だけ** 返す → 次回ロードで伏字。
- **表示/隠す**: 入力中のみ eye トグル（type を text↔password）。**登録済みの伏字には出さない**。
- **再入力で更新**: 伏字 → 空入力へ。確定（保存）するまで旧設定は維持。
- **解除**: インライン確認 → `onChange(null)`。warn トーンで誤操作防止。
- **接続テスト**: `onTest()` を await。`sending → success/fail` をインライン表示。送信内容は固定の確認メッセージ（サーバ実装側）。
- **トランジション**: 枠線/フォーカスは 120ms 程度。重い演出なし（既存 Settings に合わせ抑制）。
- **レスポンシブ**: モーダル幅 560px 前提。狭幅オーバーレイでも 1 カラムで成立。

## State Management

`NotifySection` は **controlled component**。親が `value: WebhookConfig | null` を保持し `onChange` で受ける。

- `value === null` → 未設定 / `value === { platform }`（url 無し）→ 登録済み伏字 / `value === { platform, url }` → 入力中の下書き。
- 内部一時状態: `editing`（伏字を上書き中か）, `draft`（入力テキスト）, `show`（表示/隠す）, `confirm`（解除確認）, `test`（idle/sending/success/fail）。
- typing 中は `onChange` を都度発火（有効なら `{platform,url}`、未設定からの無効入力は `null`）。上書き編集中は有効になるまで既存値を維持（誤って解除しない）。
- フッタ「保存」活性は `onValidityChange(canSave)` を購読。
- **生 URL を state にもクライアントログにも残さない方針**（保存後はサーバから返さない）。

## Design Tokens

CSS 変数（`--cw-*`、light 既定 + dark 対応）。既存 Settings（richColors light）と同一語彙。

| トークン | light | dark | 用途 |
|---|---|---|---|
| `--cw-bg` | `#faf8f3` | `#1a160f` | モーダル body 背景 |
| `--cw-card` | `#ffffff` | `rgba(42,34,23,0.85)` | カード / 入力 / モーダル |
| `--cw-card-border` | `rgba(35,18,0,0.08)` | — | カード枠 |
| `--cw-card-hi` | `rgba(255,191,0,0.06)` | — | 伏字フィールド地 / 淡い面 |
| `--cw-border` | `rgba(35,18,0,0.10)` | — | 罫線・区切り・入力枠 |
| `--cw-text` | `#231200` | `#ede4d0` | 本文 |
| `--cw-muted` | `#6b5f4a` | — | サブ・hint |
| `--cw-subtle` | `#a89d85` | — | 補助・placeholder・伏字 |
| `--cw-accent` | `#0d9488` | 同一 | アクセント / 検出 OK / Slack 検出 hint |
| `--cw-accent-soft` | `rgba(13,148,136,0.10)` | — | テスト送信ボタン地 |
| `--cw-on-accent` | `#ffffff` | — | アクセント上の文字 |
| `--cw-warn` | `#b45309` | — | 判定不能・解除・上書き注意 |
| `--cw-warn-soft` | `#fef3c7` | — | 解除確認ボックス地（枠 `#f0c98a`） |
| `--cw-danger` | `#dc2626` | — | テスト失敗 |
| `--cw-success` | `#047857` | — | テスト成功 |
| 緑ドット | `#22c55e` | — | 設定済みステータス点 |
| **Slack 識別色** | `#15803d` / soft `rgba(21,128,61,0.10)` | — | Slack バッジ（緑系） |
| **Teams 識別色** | `#7c3aed` / soft `rgba(124,58,237,0.10)` | — | Teams バッジ（紫系） |

- **角丸**: 入力/伏字 7px、ボタン 7px、小バッジ 3px、カード 12px、モーダル 14px、インジケータ/ステータス pill 999px。
- **影**: 原則なし。モーダル `0 20px 60px rgba(0,0,0,0.25)`、ポップオーバー `0 16px 44px rgba(0,0,0,0.22)`。
- **タイポ**: 本文 'Noto Sans JP' 13px/行高1.4。URL・コード・等幅情報・バッジは 'JetBrains Mono'。
  ラベル 11.5px/600、hint 10.5px、見出し 10.5px/700/uppercase。
- **spacing**: カード padding 14×16px、行 gap 8–12px、余白 12–14px 基調。

プラットフォーム識別色（Slack=緑 / Teams=紫）は「色だけでも識別できる」ための差し色。`PLATFORM_META` に1箇所集約済み。

## 接続テスト 有る版 / 無い版

- **有る版（推奨・プロト既定）**: 登録済みに「テスト送信」1ボタン。送信中→成功/失敗をインライン表示。
  貼り間違い・失効を保存直後に発見でき、運用の「実は届いてなかった」を防ぐ。`onTest` を渡すだけで有効化。
- **無い版（最小）**: 宛先の登録のみ。`onTest` を渡さなければテスト UI は出ない。初回疎通確認はユーザー任せ。

## Assets

- アイコンはすべて **インライン SVG**（bell / lock / shield / eye / eye-off / send / check / alert / unlink / spinner / Slack ハッシュ / Teams バブル）。外部アセットなし。
  対象コードベースに既存アイコンセットがあれば差し替え可。
- ブランド/画像アセットなし。Slack / Teams の公式ロゴは使わず、中立な単純グリフ + 色で表現している（必要なら公式ブランドガイドに沿って差し替え）。

## Files

| ファイル | 役割 |
|---|---|
| `NotifySection.tsx` | **参照実装（本体）**。controlled。`NotifySection` / `PlatformBadge` / `NotifyIndicator` を export。`--cw-*` トークン使用 |
| `webhookPlatform.ts` | 型（`WebhookConfig` / `WebhookPlatform` / `DetectResult`）+ `detectPlatform` / `isSupportedPlatform` / `PLATFORM_META` / `maskedSecret`。**フレームワーク非依存** |
| `prototype/Webhook Notify - UX Exploration.html` | スタンドアロン検討版（全状態・kintone 文脈・IA 提案・UI コピー） |
| `prototype/webhook-notify.jsx` | プロトの通知セクション本体（vanilla React + Babel） |
| `prototype/webhook-context.jsx` | AgentDetailModal / built-in ポップオーバー / 一覧インジケータ / kintone ホスト |
| `prototype/webhook-explore.jsx` | 情報設計の提案 / 判定・伏字・解除の見せ方 / 状態一覧 / UI コピー |
| `prototype/{wedge-header,wedge-settings,deployments-data,design-canvas}.jsx`, `prototype/styles.css` | プロト実行用の土台（トークン / グリフ / バッジ / design canvas / フォント） |

### 組み込み手順（要約）

1. `AgentDetailModal` の **「公開先(ACL)」セクション直後** に `<NotifySection value={wh} onChange={setWh} onValidityChange={setCanSave} onTest={...} />` を差し込む。
2. フッタ「保存」の `disabled` を `!canSave` と既存変更検知に連動。保存時に `Agent.webhook` を永続化。
3. サーバは保存後 **url を返さず `{ platform }`** のみ返す（伏字運用）。
4. built-in 用に、Agent 一覧行の「通知」ボタンから同じ `<NotifySection hideHeader>` を軽量ポップオーバーで開く（#7）。
5. Agent 一覧に `agent.webhook` があれば `<NotifyIndicator platform={agent.webhook.platform} />` を行へ追加（#8）。

`detectPlatform` のホスト判定（`hooks.slack.com` / `*.webhook.office.com` / `outlook.office.com` 等）と
伏字運用は `webhookPlatform.ts` 冒頭コメントを参照。
