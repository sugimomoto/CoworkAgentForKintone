# 設計: 初回実装 (MVP)

**作業タイトル**: initial-implementation
**作成日**: 2026-04-25

本書は [requirements.md](./requirements.md) に対する実装設計。恒久ドキュメント ([docs/functional-design.md](../../docs/functional-design.md) / [docs/architecture.md](../../docs/architecture.md) / [docs/repository-structure.md](../../docs/repository-structure.md)) と重複する内容は書かず、**本ステアリング固有の実装方針・変更内容・Phase 進行計画** のみを記述する。

---

## 1. 実装アプローチ

### 1.0 開発手法: TDD
本ステアリングのすべての実装タスクは **テスト駆動開発 (TDD)** で進める ([docs/development-guidelines.md §5](../../docs/development-guidelines.md))。

- **基本サイクル**: Red (失敗するテストを書く) → Green (最小実装で通す) → Refactor (整える)
- **戦略**:
  - **ロジック層 (`core/`, helper ライブラリ)** は **Inside-Out** (古典派 TDD)。純粋関数・純粋クラスとしてテスト先行
  - **UI 層 (`components/`)** は **Outside-In** (Acceptance Test 先行)。Testing Library でユーザー操作シナリオを書いてから実装
- **外部サービス (Anthropic / kintone API)** は必ずテストダブルで置換し、単体テストで実 API は叩かない
- **Phase 0 から CI で `pnpm test` / `pytest` を回す**: 1 行目の実装前に「テストが落ちる状態で push できる」状態を作る

### 1.1 Phase 進行方針
- 各 Phase 終了時に **実機動作確認 + 振り返り** を実施。次 Phase で軌道修正可能にする
- Phase 1a 完了時点で実行可能なプラグイン zip を一度 GitHub にリリース (alpha タグ) し、早期フィードバックを得る
- 各 Phase は **feature ブランチ** で進め、完了ごとに main に merge
- 各タスクは **「テスト追加」コミット → 「実装」コミット** の 2 ステップ以上を含むこと

### 1.2 並行可能作業
- `packages/plugin/` (TypeScript) と `packages/kintone-helper/` (Python) は独立しており並行実装可能
- Phase 1a 段階では kintone-helper はまだ呼ばれないので、Phase 1b から本格着手で良い
- 初期環境整備 (モノレポ、CI、Lint) は Phase 1a 着手前の「Phase 0」として実施

### 1.3 リポジトリ初期化 (Phase 0)
- `pnpm-workspace.yaml` / ルート `package.json` / `.editorconfig` / `.prettierrc` / `.eslintrc.cjs` を用意
- `.github/workflows/ci.yml` の枠組みを作り、Lint / 型 / テストを最初から回す
- `LICENSE` (MIT) / ルート `README.md` のスケルトンを作成

---

## 2. Phase 1a 設計: 最小動作確認

### 2.1 成果物
1. インストール可能な kintone プラグイン zip
2. 管理者設定画面 (API Key 入力)
3. チャットサイドパネル (Rich variant デザイン + メッセージ送受信の最小実装)
4. Default Agent / 最小 Environment / Session の自動解決

### 2.2 実装スコープ

| コンポーネント | 実装する | 実装しない (後続 Phase) |
|---------------|---------|----------------------|
| `src/config/` | Anthropic API Key 入力 UI + Proxy 設定保存 | ー |
| `src/desktop/ChatPanel.tsx` | Rich variant のレイアウト + User/Agent/Thinking カード | Tool / Plan / Progress / Result カード |
| `src/desktop/components/` | `MessageList`, `MessageInput`, `Header`, `Composer` | `ApprovalCard`, `ProgressCard`, `ResultCard`, `CredentialDialog` |
| `src/core/managed-agents/client.ts` | `kintone.plugin.app.proxy` 経由の HTTP ラッパ | ー |
| `src/core/managed-agents/resources.ts` | Agent / Environment / Session の list / create | Vault (Phase 1b) |
| `src/core/managed-agents/events.ts` | `POST events (user.message)` + `GET events` ポーリング | `user.tool_confirmation` 等 (Phase 1c) |
| `src/core/bootstrap/` | `resolveAgent`, `resolveEnvironment` (最小構成) | `resolveVault` (Phase 1b) |
| `src/store/chatStore.ts` | Zustand でメッセージ配列と入力状態を管理 | 承認状態管理 (Phase 1c) |
| `manifest.json` | Proxy 設定 + desktop/config 定義 | ー |

### 2.3 Phase 1a の Environment

Phase 1a では kintone 操作を行わないので、最小 Environment を作成。Phase 1b 以降で置き換える:

```js
{
  name: 'Cowork Agent - Bootstrap',
  config: {
    type: 'cloud',
    networking: { type: 'limited', allow_package_managers: false, allowed_hosts: [] },
    packages: {},
  },
  metadata: {
    source: 'cowork-agent-for-kintone',
    purpose: 'bootstrap',  // Phase 1b で破棄・再作成する印
  },
}
```

### 2.4 Phase 1a の Agent system prompt (暫定)

```
あなたは kintone の業務支援エージェント Cowork Agent です。
現在セットアップ中で、kintone への接続機能はまだ有効化されていません。
ユーザーからの質問には、kintone の基本的な使い方や今後できることの案内を中心に返答してください。
```

### 2.5 Phase 1a の検証シナリオ

1. 管理者が Anthropic API Key を設定 → Proxy 設定に保存されていることを確認
2. レコード一覧画面を開く → サイドパネルが Rich variant デザインで表示
3. 「こんにちは」と送信 → ポーリングで Agent 応答が `thinking` → `agent.message` カードで順次表示
4. パネルを閉じて再度開く → 会話履歴が復元
5. 別のレコード一覧画面 (別アプリ) を開く → 同じ Session の続きとして表示

---

## 3. Phase 1b 設計: 認証基盤 + 読取 + HITL 基盤

### 3.1 追加コンポーネント

| コンポーネント | 役割 |
|---------------|------|
| `src/core/bootstrap/resolveVault.ts` | Vault の metadata 検索・作成 |
| `src/core/bootstrap/ensureEnvironment.ts` | Phase 1a の bootstrap Environment を破棄し、ユーザー専用 Environment (ヘルパーライブラリ + `allowed_hosts` 設定済み) に置換 |
| `src/desktop/components/CredentialDialog.tsx` | 初回 kintone 認証情報入力モーダル |
| `src/desktop/components/ProgressCard.tsx` | Progress カード (スピナー + バー + substeps) |
| `src/desktop/components/ResultCard.tsx` | Result カード (ヘッダ + Rows + followup) |
| `src/desktop/components/ApprovalCard.tsx` | Plan (read-only) カードの表示のみ (destructive 対応は Phase 1c) |
| `src/desktop/components/ToolCallCard.tsx` | Tool call カード (ヘルパーライブラリ経由の bash 実行表示) |
| `packages/kintone-helper/src/cowork_agent_kintone/*` | Python ライブラリ本体 (`client.py`, `apps.py`, `records.py`, `cursor.py`, `auth.py`, `errors.py`) |

### 3.2 ユーザー初回バインディングフロー実装

```
ChatPanel マウント
  ↓
useUserBinding() フック実行
  ├─ Managed Agents から Environment / Vault を metadata で検索
  ├─ 該当する bootstrap Environment のみ見つかった場合: 置換対象と判定
  └─ ユーザー用が見つからない場合: CredentialDialog を開く
        ↓
    ユーザーが ID/PW 入力 → 登録ボタン押下
        ↓
    1. Vault 作成 (display_name: "Cowork Agent - <user>@<domain>")
       - metadata: source, kintoneDomain, kintoneUserCode
    2. ユーザー用 Environment 作成
       - name: "Cowork Agent - <user>@<domain>"
       - metadata: 同上
       - packages.pip: ['cowork-agent-kintone']
       - allowed_hosts: [<kintoneDomain>]
    3. bootstrap Environment に紐づく Session があれば新規作成に切り替え
       (新 Environment で新 Session を起こし、以降はそちらを利用)
    4. CredentialDialog を閉じて通常チャットに戻る
```

### 3.3 Vault と Environment の結合 (環境変数注入)

- Vault 作成時に `KINTONE_LOGIN` / `KINTONE_PASSWORD` / `KINTONE_DOMAIN` の 3 キーを登録
- Session 作成時に `vault_ids: [vaultId]` を渡すと Environment コンテナに環境変数として自動注入される (Managed Agents 仕様)
- ヘルパーライブラリの `Client()` は起動時に環境変数から認証情報を自動取得

### 3.4 Plan カード (read-only) の導入

- Plan カードは Phase 1b では **read-only (影響範囲の事前通知のみ)** を対象とする
- Agent は読取タスク実行前に Plan カードで「これから X 件を取得します」と通知、ユーザーは見るだけで即実行 (承認不要)
- 将来 Phase 1c で destructive フラグを追加し承認ボタンを有効化する

### 3.5 Progress カードの同期

- Progress カードは Agent が `tool_use` / bash 実行中の進捗を周期的に発話することで更新する
- ヘルパーライブラリは 100 件分割処理時に `print(f"Progress: {i}/{total}")` を標準出力に出し、Agent がそれを拾って Progress メッセージに変換

### 3.6 ヘルパーライブラリ Phase 1b 対象 API

| メソッド | Phase |
|---------|-------|
| `Client()` | 1b |
| `get_apps` | 1b |
| `get_app_schema` | 1b |
| `get_form_layout` | 1b |
| `get_records` (カーソル対応) | 1b |
| `add_records` / `update_records` / `delete_records` | 1c |
| `bulk_request` | 1c |

---

## 4. Phase 1c 設計: 書き込み + HITL 承認

### 4.1 追加実装

| コンポーネント | 役割 |
|---------------|------|
| `ApprovalCard.tsx` (拡張) | destructive フラグ対応、3 ボタン (承認して実行 / 修正 / キャンセル) を有効化 |
| `src/core/managed-agents/approval.ts` | 承認操作を `user.message` として送信するラッパ |
| ヘルパーライブラリの書込 API | `add_records`, `update_records`, `delete_records`, `bulk_request` |

### 4.2 HITL 承認の実現方式

Managed Agents API に破壊的操作専用の承認機構が無いため、**Agent の system prompt と UI 側の組合せで実現** する:

1. Agent の system prompt に「破壊的操作は必ず Plan カードを先に発話し、ユーザーから『承認します』と明示的な返信が来るまで実行しないこと」を明記
2. Agent が `destructive=true` の Plan を発話した時点でポーリングを継続しながらユーザー入力を待つ
3. ユーザーが「承認して実行」ボタンを押すと UI が「承認します。実行してください。」を `user.message` として POST
4. 「キャンセル」ボタンは「この操作はキャンセルします。」を POST
5. 「修正」ボタンは通常の入力欄にフォーカス (ユーザーが自由文で修正指示)

### 4.3 分割実行と Progress 連動

- ヘルパーライブラリは 100 件超を内部でチャンク分割し、各チャンクごとに `print(f"Chunk {i}/{n} done")` を出力
- Agent は bash 出力を読んで Progress カードを段階更新

---

## 5. Phase 1d 設計: アプリ横断転記 (検証 + プロンプト調整)

### 5.1 新規実装
- なし (Phase 1a〜1c の機能で自然に実現可能)

### 5.2 検証項目
- 「問合せアプリの未対応レコードを案件アプリに転記して」
- 「売上アプリの今月分を月次集計アプリに転記して」
- 複数ステップ (検索 → 抽出 → 転記先へ追加) が Plan カードで可視化されること
- 失敗時の途中経過表示とリカバリ提案

### 5.3 system prompt 調整

複合指示を扱うための注意点を system prompt に追記:
- 複数ステップのタスクは最初に全体計画を Plan カードで提示
- 途中で失敗した場合、次のステップに進む前にユーザーに確認を求める
- 既に成功したレコード ID は逐次報告 (途中失敗時の追跡可能性確保)

---

## 6. 変更するコンポーネント (恒久 docs への影響)

本ステアリングの実装で恒久ドキュメントを更新すべき箇所:

| docs | 更新理由 |
|------|---------|
| `docs/functional-design.md` | Agent system prompt が Phase ごとに変化するため、§6.3 の暫定プロンプトを「Phase ごとに段階的に進化」の注記 + 最終版を追記 |
| `docs/architecture.md` | Python ヘルパーライブラリの公開ステータス (MVP 公開時点のバージョン) 記載 |
| `docs/glossary.md` | Phase 進行中に新しい用語が出てきたら随時追加 |

---

## 7. 影響範囲の分析

### 7.1 既存コードへの影響
- 初回実装のため「既存コード」は存在しない。ゼロから構築
- ただしモノレポ初期化 (Phase 0) は後続ステアリング全ての前提になるため、構成ミスの影響大

### 7.2 外部サービスへの影響
- **Anthropic**: 各ユーザー分の Agent / Environment / Vault / Session を Anthropic 側に作成 → リソース数増加。上限到達時は手動 / 自動クリーンアップが必要 (未確定事項として継続)
- **kintone**: Basic 認証での API 呼出 → kintone 側のレート制限 (100 req/sec、10,000 req/min) に注意

### 7.3 開発者体験への影響
- pnpm + uv の併用で依存インストール手順が 2 種類必要 → README とセットアップスクリプトで吸収
- Python / TypeScript の CI ジョブ分離 → GitHub Actions でマトリクス実行

---

## 8. データ構造の変更

既に `docs/functional-design.md §3` で確定済。**本ステアリングで新たなデータ構造変更はない**。

---

## 9. リスクと対策

| リスク | 対策 |
|-------|------|
| Managed Agents Beta API の仕様変更 | `anthropic-beta` ヘッダをバージョン固定、変更検知時は CI で失敗させ即座に気付く |
| ヘルパーライブラリの Environment プリインストールが遅い | Environment 作成は 1 ユーザー 1 回のみ。再作成が必要ないようメタデータで確実に再利用 |
| Agent が HITL を無視して破壊的操作を実行する | system prompt の厳格化 + テスト観点で「destructive 操作の Plan なし実行」を検出するテストを書く |
| kintone.proxy の 30 秒タイムアウト | Managed Agents API 側の長時間処理はポーリングで受け取る (1 リクエストは短い)、kintone API 呼出はヘルパーライブラリ内で細かく分割 |
| プラグイン zip が 30MB を超える | Vite の Tree Shaking + 動的 import + プロダクションビルドでサイズ監視 (CI で警告) |

---

## 10. 完了後の次ステップ (別ステアリング候補)

- `20260XXX-phase2-planning` — フェーズ 2 機能の要件整理
- `20260XXX-telemetry` — Sentry 等の運用監視整備
- `20260XXX-i18n-en` — 英語対応
- `20260XXX-mobile` — モバイル対応
