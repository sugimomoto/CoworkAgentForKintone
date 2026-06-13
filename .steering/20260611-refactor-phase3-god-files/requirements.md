# 要求: リファクタリング Phase 3 — God ファイル分割

## 背景

2026-06-11 実施のコードベース全体レビューで、plugin パッケージに責務が集中した巨大ファイルが 4 つ確認された。いずれも機能追加のたびに肥大化しており、変更影響の見通しとテスト容易性を損なっている。

| ファイル | 行数 | 混在している責務 |
|---|---|---|
| `packages/plugin/src/desktop/settings/AgentDetailModal.tsx` | 1004 | モード管理 (edit / create / create-from-proposal) の 9 つの useState、Agent 詳細フェッチ、234 行のネスト DraftForm、削除確認モーダル |
| `packages/plugin/src/core/bootstrap/resolveAgent.ts` | 695 | Default Agent 解決、Built-in 3 種解決、Agent ツール構築、メタデータフィルタ、in-flight 重複排除キャッシュ |
| `packages/plugin/src/desktop/settings/SkillAddModal.tsx` | 655 | ファイル / テキスト 2 タブのフォーム状態、drag-drop + JSZip 展開、frontmatter パース、バリデーション |
| `packages/plugin/src/store/chatStore.ts` | 561 | メッセージ CRUD、アーティファクト管理、バインディング (Vault/Credential/OAuth) 状態、添付ファイル管理、Customizer wedge 状態、pending カスタムツール追跡 |

加えて `packages/plugin/src/config/ConfigScreen.tsx` (554 行) も、マルチステップフォーム状態・Cloudflare デプロイのポーリング (アンマウント時のキャンセル漏れあり、`ConfigScreen.tsx:139-144`)・プロキシ設定構築 (90 行の handleSave) が混在している。

また、メタデータフィルタの `findByMetadata` 呼び出しパターンが `resolveAgent.ts` / `resolveEnvironment.ts` / `resolveVault.ts` で重複している。

## ゴール

- 各ファイルを単一責務のモジュールに分割し、責務ごとに独立してテストできる状態にする
- 分割後の各ファイルをおおむね 400 行以下に収める
- 挙動は変えない (リグレッションゼロ)

## スコープ

- **A. resolveAgent.ts の分割**:
  - `resolveBuiltInAgents()` + 関連ヘルパー → `core/bootstrap/resolveBuiltInAgents.ts`
  - Default / Built-in 共通のツール構築 → `core/bootstrap/buildAgentTools.ts`
  - メタデータフィルタの共通化 → ジェネリックな `findResourceByMetadata()` ヘルパーに集約し、resolveEnvironment / resolveVault の重複も解消
  - テストを分割先に対応する 2 ファイルへ再編
- **B. chatStore.ts の分割**: Zustand のスライスパターンまたは別ストアへ分離
  - バインディング状態 (vaultId / credentialId / bindingStatus / bindingError)
  - アーティファクト (artifacts Map / activeArtifactId / pendingCustomToolUseIds)
  - 添付ファイル (attachedFiles + add/update/remove/clear)
  - 残り (メッセージ / セッション / Agent / view / wedge) を chatStore 本体に残す
  - `store/index.ts` で再エクスポートし、既存 import への影響を最小化
- **C. AgentDetailModal.tsx の分解**:
  - `DraftForm` をファイルとして独立 + Skills / Tools セクションのサブコンポーネント化
  - モード管理 + sourceAgent 算出 → `useAgentModalMode` フック
  - 削除確認 → 汎用 `ConfirmDialog` (Phase 4 の Modal 共通化の先行成果物として作る)
  - フェッチ effect の依存配列見直し (`localMode` 依存による不要な再フェッチの解消)
- **D. SkillAddModal.tsx の分解**: ファイル処理 (drag-drop / JSZip / frontmatter パース / バリデーション) を `useFileUpload` フックまたは core の純関数群へ抽出。FileTab / TextTab を独立コンポーネント化
- **E. ConfigScreen.tsx の分解**: Cloudflare デプロイ処理 → `useCloudflareDeployment` フック (アンマウント時キャンセル対応を同時に修正)。プロキシ設定ステップ構築 → `buildProxySteps()` 純関数 + ユニットテスト

### スコープ外

- 見た目・文言・UX の変更 (一切なし)
- 共通 UI コンポーネント (Modal / Button / FormField) の全面展開 (Phase 4。ただし C の ConfirmDialog のみ先行)
- 新機能の追加

## ユーザーストーリー

### US-1: プラグイン開発者 (カスタム Agent 機能の拡張担当)

> 私は Agent 作成フローに新しい設定項目を追加したい。現状は 1004 行の AgentDetailModal を読み解いてどの useState がどの effect と連動しているか把握する必要がある。**フォームが DraftForm、モード管理が useAgentModalMode に分かれていれば**、触るべき場所が一目で分かり、影響範囲もテストで確認できる。

### US-2: プラグイン開発者 (状態管理の改修担当)

> バインディング (OAuth) 周りの不具合を調査するとき、**バインディング状態が独立したスライスになっていれば**、メッセージやアーティファクトの状態遷移と切り離してテスト・デバッグできる。

### US-3: レビュアー

> リファクタリング PR をレビューする際、**「純粋な移動」と「ロジック変更」が PR 単位で分かれていれば**、diff が大きくても安心して承認できる。

## 受け入れ条件

### AC-1: ファイルサイズと責務の分離

- `resolveAgent.ts` / `chatStore.ts` / `AgentDetailModal.tsx` / `SkillAddModal.tsx` / `ConfigScreen.tsx` がいずれも分割後 450 行以下
- 分割先モジュールがそれぞれ単一の責務を持ち、対応するテストファイルを持つ

### AC-2: リグレッションゼロ

- 既存のユニットテストが (import パス更新以外の変更なしで) 全て green
- E2E (smoke / config / session-history / live) がローカルで green
- ビルド (`pnpm plugin:build`) が成功し、実環境で Agent 作成・編集・削除、スキル追加、config 保存、チャット送受信が動作する

### AC-3: 重複の解消

- `findByMetadata` 呼び出しパターンが共通ヘルパー 1 箇所に集約され、resolveAgent / resolveEnvironment / resolveVault がそれを利用している

### AC-4: 既知のバグ修正 (分割に伴う最小限の挙動修正)

- ConfigScreen の Cloudflare バージョンポーリングがアンマウント時にキャンセルされ、unmount 後の setState が発生しない
- AgentDetailModal のフェッチ effect が `sourceAgent` 不変時に再実行されない

## 制約事項

- Phase 2 (レイヤー是正) 完了後に着手する (型と依存の向きが確定していることが前提)
- **PR は責務単位で分割する** (A〜E でそれぞれ 1 PR 以上。「移動のみ」と「ロジック変更」を同一 commit に混ぜない)
- 各 PR で `pnpm -r run test` / `pnpm lint` / `pnpm typecheck` green を維持
- Zustand / React のバージョンは変えない。新規ライブラリは追加しない
- `data-testid` 等のテスト用フックは維持し、E2E を壊さない
