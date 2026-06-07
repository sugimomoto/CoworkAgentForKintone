# requirements.md — エージェント別の利用ユーザー絞り込み (公開先 ACL) (Issue #47)

## 1. 目的

エンドユーザー (業務担当者) が増えてくると「営業部だけに営業アシスタント」「経理部だけに経理エージェント」のような **部門・チーム単位の見え方制御** が必須になる。現状の `visibility: 'public' | 'private'` は「全員に見せる / 誰にも見せない」のバイナリしか持たないため、これを **public の中で更にスコープを切れる** 構造に拡張する。

#45 でエージェント一覧 (PresetAgentLanding) が業務ユーザーのエントリーポイントになったため、関係ないエージェントが並ぶことが UX 上の摩擦を生む。本 Issue で解消する。

## 2. スコープ

### 2.1 含む

- `AgentRecord` に **公開先スコープ** 3 フィールドを追加:
  - `allowedUsers: readonly string[]`         — kintone ユーザーコード
  - `allowedGroups: readonly string[]`        — kintone グループコード
  - `allowedOrganizations: readonly string[]` — kintone 組織コード
- Anthropic Agent.metadata に **JSON 配列文字列**として保存 (key: `allowedUsers` / `allowedGroups` / `allowedOrganizations`)
- 空配列のときは metadata key を削除 (= public visibility なら全員に見える、後方互換)
- 結合ロジック: **OR 結合** (= ユーザーが allowedUsers に含まれる **OR** いずれかの allowedGroups に所属 **OR** いずれかの allowedOrganizations に所属)
- bootstrap (`useSession`) 時:
  - kintone REST `/k/api/users/groups.json` `/k/api/users/organizations.json` で現在ユーザーの所属を取得
  - `chatStore.currentUserAccess: { code, groups[], organizations[] }` に保存
  - Agent filter を適用して `builtInAgents` に積む
- **admin (= `kintone.isUsersAndSystemAdministrator() === true`) は ACL の filter を完全免除** (= 全 Agent が見える)
- `AgentDetailModal` に **公開先選択 UI**:
  - 3 つの incremental search ドロップダウン (ユーザー / グループ / 組織)
  - 入力中に kintone API で候補を絞り込み、チップ形式で追加
  - 各セクションに既存選択をチップ表示、× で個別削除
- `AgentsListPane` の各 Agent 行に **公開先サマリ** 表示
  - 全員 / 「3 ユーザー」「2 グループ + 1 組織」のような短い形
- `PresetAgentLanding` / Header `AgentPicker` には追加変更なし (AgentRecord 段階で filter 済のため)

### 2.2 含まない

- **サーバー側 (Worker) での厳密 ACL enforcement** — Phase 1 はクライアント側 filter のみ。DevTools 経由で全 Agent ID が見える可能性は残るが社内運用なら十分。厳密版は別 Issue で
- **アプリスコープ** (「このアプリで開いた時だけ表示」) — 将来の別 Issue
- **動的ロール** (kintone のアプリ別管理者 / プロセス管理者などとの連動) — 将来の別 Issue
- **Custom Agent の作成・編集権限の絞り込み** — admin チェック一元管理のまま、別 Issue
- **「scope 外を一時的に admin が見るプレビュー」** — 別 Issue (admin はそもそも全 Agent 見えるので Phase 1 では不要)
- **リアルタイム反映** — bootstrap 時取得のみ。kintone 側でユーザーをグループ追加したら、エンドユーザーは Plugin リロードで反映される
- **ユーザーコードの大文字小文字正規化** — kintone は case-sensitive で扱うので Plugin 側も保存値そのまま比較

## 3. ユーザーストーリー

### 3.1 admin (情シス) — 公開先指定

- AS A admin
- I WANT エージェントごとに「営業部 (グループ) のみ」「マネージャーチーム (組織) のみ」のように公開先を指定
- SO THAT エンドユーザーには自部門に関係するエージェントだけが並び、UI が散らからない

### 3.2 業務ユーザー — 関係ないエージェントを見ない

- AS A 業務ユーザー
- I WANT 自分に関係ないエージェントが PresetAgentLanding に並ばない
- SO THAT 「どれを使えばいいか分からない」状態にならない、最初の 1 クリックまでが速い

### 3.3 admin — 後方互換

- AS A 既存運用中の admin
- I WANT 既に作成済の Agent (allowedUsers 等が未設定) はこれまで通り全員に見える
- SO THAT 本機能の追加で既存の公開状態が壊れない

### 3.4 admin — 自分は全部見える

- AS A admin
- I WANT 自分は ACL 設定に関係なく全 Agent が見える
- SO THAT 動作確認・トラブルシュート時に「自分が見えない」せいで困らない

## 4. 受け入れ条件

### 4.1 データモデル

- [ ] AC-1: `AgentRecord` に `allowedUsers / allowedGroups / allowedOrganizations: readonly string[]` が追加されている (空配列許容)
- [ ] AC-2: `BUILTIN_AGENT_SPECS` の 3 variant は **3 配列を持たない** (= 空配列扱い = 全員に見える)
- [ ] AC-3: Anthropic Agent.metadata に **`allowedUsers` / `allowedGroups` / `allowedOrganizations`** の 3 key で **JSON 配列文字列**として保存される
- [ ] AC-4: 空配列のときは metadata key 自体が削除される (= 旧 quickActions と同じパターン)
- [ ] AC-5: `agentToRecord` で 3 配列が正しく復元される (不正 JSON は silent fallback で空配列)
- [ ] AC-6: `AgentEditDraft` に 3 フィールドが追加され、`mergeMetadataPatch` で永続化される

### 4.2 kintone API ラッパー

- [ ] AC-7: 新規ファイル `packages/plugin/src/core/kintone/users.ts` に以下のラッパー関数を追加:
  - `fetchCurrentUserGroups(): Promise<string[]>` — `/k/api/users/groups.json` を呼ぶ
  - `fetchCurrentUserOrganizations(): Promise<string[]>` — `/k/api/users/organizations.json`
  - `searchUsers(query: string): Promise<{ code, name }[]>` — `/k/api/users/users.json`
  - `searchGroups(query: string): Promise<{ code, name }[]>` — `/k/api/users/groups.json` (全件)
  - `searchOrganizations(query: string): Promise<{ code, name }[]>` — `/k/api/users/organizations.json` (全件)
- [ ] AC-8: いずれも失敗時は空配列を返す (= 致命傷にしない)
- [ ] AC-9: kintone runtime が存在しない (Vitest) 環境では空配列を返す

### 4.3 bootstrap での filter 適用

- [ ] AC-10: `useSession` の bootstrap 段階で、`fetchCurrentUserGroups` / `fetchCurrentUserOrganizations` を並列実行
- [ ] AC-11: 取得結果 + `getLoginUser().code` を `chatStore.currentUserAccess: { code, groups, organizations } | null` にセット
- [ ] AC-12: API 失敗時は `currentUserAccess = { code, groups: [], organizations: [] }` で起動継続 (= ACL 適用は user code のみ、grup/org は filter なしと同等)
- [ ] AC-13: `setBuiltInAgents` に渡す前に Agent filter を適用:
  - admin (`resolveIsAdmin() === true`) → filter 適用なし、全 Agent を積む
  - 一般ユーザー → §5 の判定式で filter
- [ ] AC-14: filter 結果は `builtInAgents` に積まれる。filter 後 0 件でも UI は壊れない (`PresetAgentLanding` が `WelcomeMessage` にフォールバック)

### 4.4 AgentDetailModal の公開先選択 UI (Claude Design 採用案 A: 縦スタック / OR カード)

- [ ] AC-15: 「公開先」セクションを **クイックアクションと Skills の間** に追加
- [ ] AC-16: セクション最上部に **ステータスバナー** を表示:
  - 3 配列全部空 → 「**全員に公開**」 + globe アイコン + サブテキスト (`bg-card-hi`)
  - いずれか指定あり → 「**指定したメンバーに公開** · 合計 N 件」 + check アイコン + OR 結合の説明 (`bg-accent-soft/60`)
- [ ] AC-17: 3 軸 (ユーザー / グループ / 組織) を **独立したカード** で縦に並べ、間に **OR コネクタ** を挟む
  - OR コネクタは上下軸ともに値があるとき active 色 (`bg-accent-soft + text-accent`)、そうでないとき非アクティブ色
- [ ] AC-18: 各軸カードのヘッダ行に **件数バッジ** を表示 (「5 人」「2 グループ」「指定なし」)
- [ ] AC-19: 各軸カードに以下を備える:
  - **検索 input** (debounce 300ms、フォーカス時に accent ring)
  - **候補ドロップダウン** (input 直下に anchored、最大 10 件、最大高 232px、選択済は exclude で除外)
  - **チップ列** (1 件以上のとき、最大高 132px + 内部スクロール)
- [ ] AC-20: チップ形式:
  - ユーザー: 18px イニシャルバブル + 「名前（メアド）」 + × 削除、`max-width: 230px`
  - グループ / 組織: 軸アイコン + 名前 + × 削除、`max-width: 150px`
- [ ] AC-21: 軸ごとの **識別色** を CSS 変数 `--axis` で渡す:
  - ユーザー = `var(--cw-accent)` (teal)
  - グループ = `#7c6aa8`
  - 組織 = `#2f6f9f`
- [ ] AC-22: キーボード操作: `↑↓` 候補移動 / `Enter` 確定 / `Esc` 閉じる / `Tab` 軸移動
- [ ] AC-23: API エラー時はドロップダウン内に警告 + 「再試行」ボタン、入力済チップは保持
- [ ] AC-24: 保存時に `AgentEditDraft.allowedUsers / allowedGroups / allowedOrganizations` に反映

### 4.5 AgentsListPane の公開先サマリ (`formatAccessSummary` 採用)

- [ ] AC-25: 各 Agent 行に「公開先」表示を追加。フォーマットは **`formatAccessSummary` (最大軸 + 余り表示)** を採用:
  - 3 配列すべて空 → 「**全員**」 + globe アイコン (text-muted)
  - 「**5 人**」「**5 人 +2**」「**2 グループ +1**」 (最大軸 + その他の合計)
- [ ] AC-26: 1 行に収まる短文 (最大幅 116px 想定)、tooltip で詳細フォーマット (`formatAccessFull` の「5 人・2 グループ・1 組織」) を補助 (任意)

### 4.6 admin 免除

- [ ] AC-27: admin (= `resolveIsAdmin() === true`) が bootstrap した場合、filter は適用されない (= 全 Agent が `builtInAgents` に積まれる)
- [ ] AC-28: admin 判定の async 性に伴う一瞬の「filter 適用→解除」の閃きを避けるため、admin 解決前は **filter を保留** (= 全 Agent を一時的に積む) → admin 確定 (true/false) 後に filter を再適用

### 4.7 既存値の名前解決 (resolveEntries)

- [ ] AC-29: AgentDetailModal を編集モードで開く際、`AccessPicker` の `resolveEntries(kind, codes)` で保存済 code を name 付き AccessEntry に解決する
- [ ] AC-30: 解決失敗時は code 表示のフォールバック (チップに code がそのまま見える)
- [ ] AC-31: bootstrap (`useSession`) 段階での解決は不要 (= AgentsListPane / PresetAgentLanding には code を渡す必要がない、サマリは件数のみ)

### 4.8 後方互換 / 既存導線

- [ ] AC-32: 3 配列がすべて空 (= 旧 Agent / Built-in / 何も設定していない Custom Agent) の場合、`visibility === 'public'` なら全ユーザーに見える (旧挙動と同じ)
- [ ] AC-33: 既存ユニットテスト (835 件) が pass する (新スキーマに合わせた最小限の更新は許可)
- [ ] AC-34: Header の AgentPicker / PresetAgentLanding の **既存 UI に追加変更不要** (= AgentRecord 段階で filter 済なので)

## 5. ACL 判定式 (canonical)

```
visible(agent, currentUser, isAdmin) =
  isAdmin                                       // admin は完全免除
  || (
       agent.visibility === 'public'            // private は誰にも見えない (既存通り)
       && (
            (
              agent.allowedUsers.length === 0
              && agent.allowedGroups.length === 0
              && agent.allowedOrganizations.length === 0
            )                                   // 全部空 → 全員 OK
            || agent.allowedUsers.includes(currentUser.code)
            || agent.allowedGroups.some((g) => currentUser.groups.includes(g))
            || agent.allowedOrganizations.some((o) => currentUser.organizations.includes(o))
          )
     )
```

判定対象は `chatStore.builtInAgents` に積む段階。以降の UI (Header / PresetAgentLanding 等) は **filter 済の配列を渡されるだけ** で追加処理不要。

## 6. 制約事項

- C-1: Anthropic Agent.metadata の string 値合計サイズ上限 (実測 〜数 KB) を考慮し、3 配列合計で **50 entry / 1KB を推奨上限** とする。超過時は警告のみ (保存は通す = 弱バリデーション)
- C-2: kintone REST API は cookie 認証 (同一オリジン) で叩く。CORS / Vault token は不要
- C-3: ユーザーコード等は kintone 上の表記そのまま (case-sensitive、正規化しない)
- C-4: bootstrap 1 回のみ取得 (= リアルタイム反映なし、リロードで再取得)
- C-5: admin = `kintone.isUsersAndSystemAdministrator() === true` (= cybozu.com 共通管理者)
- C-6: クライアント側 filter のみ (= Phase 1)。DevTools 経由での回避は許容する (社内運用前提)
- C-7: モバイル / i18n はスコープ外
- C-8: ユーザー / グループ / 組織の検索 API は kintone 標準 REST (`/k/api/users/users.json` 等)。1 リクエストあたり最大 100 件、incremental search では offset 不使用 (= 先頭 100 件のみ candidate)

## 7. 採用済デザイン (Claude Design ハンドオフ)

- **採用案**: 案 A (縦スタック / ステータスバナー / 軸カード × 3 / OR コネクタ)
- **ハンドオフファイル**:
  - `AccessPicker.tsx` (360 行、Tailwind トークン使用) — `packages/plugin/src/desktop/settings/AccessPicker.tsx` にコピー
  - `accessControl.ts` (型 + サマリヘルパー) — `packages/plugin/src/core/access/accessControl.ts` にコピー
- **デザイントークン整合**: 既存 `--cw-accent` 等にマップ。軸の識別色は CSS 変数 `--axis` (user=accent / group=`#7c6aa8` / org=`#2f6f9f`)
- **サマリ採用**: `formatAccessSummary` (最大軸 + 余り表示)

## 8. オープン論点 (design.md で決める)

- ✅ Q-3 (ピッカー UI 配置) — `packages/plugin/src/desktop/settings/AccessPicker.tsx` に確定
- Q-1: `chatStore.currentUserAccess` の型 — `{ code, groups, organizations }` のシンプル shape か、より明示的な branded type か
- Q-2: filter の適用タイミング — `useSession` で filter してから `setBuiltInAgents` に渡すか、`builtInAgents` selector で常に filter するか
- Q-4: `/k/api/users/*.json` のレスポンス shape 実機確認 (実機で `curl` で叩いて design.md でモック構造を確定)
- Q-5: admin 判定の async 性に伴うラグ抑制方法

## 8. 関連

- Issue: #47 (本要件)
- 前: #45 (PresetAgentLanding) / #48 (Designer)
- 後: #46 (マーケットプレイス配布) — ACL 設定の export/import 対応を検討
- 影響ファイル予定:
  - `packages/plugin/src/core/bootstrap/agentTypes.ts` (AgentRecord + 3 metadata key 定数)
  - `packages/plugin/src/core/bootstrap/agentRecord.ts` (parse 関数追加)
  - `packages/plugin/src/core/managed-agents/agentDetailApi.ts` (`AgentEditDraft` + `mergeMetadataPatch`)
  - `packages/plugin/src/desktop/hooks/useSession.ts` (bootstrap で kintone API + filter)
  - `packages/plugin/src/store/chatStore.ts` (`currentUserAccess` フィールド)
  - `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` (公開先選択 UI)
  - `packages/plugin/src/desktop/settings/AgentsListPane.tsx` (公開先サマリ)
  - 新規: `packages/plugin/src/core/kintone/users.ts` (REST API ラッパー)
  - 新規: `packages/plugin/src/core/access/filterAgentsByAccess.ts` (filter 純関数、テスト容易性)
  - 新規 (任意): `packages/plugin/src/desktop/settings/AccessPicker.tsx` (Q-3 で確定)
- テスト影響:
  - 新規: `filterAgentsByAccess.test.ts` (5 配列パターン × 3 軸)
  - 新規: `users.test.ts` (kintone API ラッパー)
  - 新規: `AccessPicker.test.tsx`
  - 既存: `AgentDetailModal.test.tsx` に 3 ピッカー操作テスト追加
  - 既存: `useSession` 系で admin 免除 / filter 適用パスを assertion
