# 開発ガイドライン (Development Guidelines)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.1 (MVP ドラフト)
**最終更新日**: 2026-04-23

---

## 1. 基本原則

1. **テスト駆動開発 (TDD)**: 実装前にテストを書く (Red → Green → Refactor)。詳細は §5
2. **シンプルさ優先**: 不要な抽象化・早すぎる最適化を避ける
3. **型安全**: TypeScript / Python ともに型を活用し、ランタイムエラーを減らす
4. **テスト可能性**: UI と純粋ロジックを分離し、ロジック層は単体テスト可能に
5. **セキュリティ既定**: 認証情報は常に Vault / Proxy 設定経由。平文保持禁止
6. **OSS として読みやすく**: 外部貢献者が迷わない命名・構造・ドキュメント

---

## 2. TypeScript コーディング規約

### 2.1 言語バージョン / 設定
- TypeScript **5.x** (strict モード有効)
- `tsconfig.json` の主要設定:
  - `"strict": true`
  - `"noUncheckedIndexedAccess": true`
  - `"exactOptionalPropertyTypes": true`
  - `"target": "ES2022"`, `"module": "ESNext"`

### 2.2 命名規則

| 対象 | 規則 | 例 |
|------|------|----|
| 変数・関数 | camelCase | `fetchAgents`, `sessionId` |
| 型・インタフェース | PascalCase | `ChatMessage`, `AgentMetadata` |
| 定数 (モジュール公開) | UPPER_SNAKE_CASE | `POLLING_INTERVAL_MS` |
| React コンポーネント | PascalCase | `ChatPanel`, `ApprovalCard` |
| React フック | camelCase + `use` 接頭辞 | `useSession` |
| ファイル | §3.1 と同様 | — |
| Zustand ストア | `<domain>Store` | `chatStore` |

### 2.3 記述スタイル
- **import 順序**: 外部ライブラリ → 内部モジュール (`@/` または相対) → 型 import。ESLint (`import/order`) で自動整列
- **型 import**: `import type { X } from '...'` を優先
- **`any` 禁止**: どうしても必要な場合は `// eslint-disable-next-line` とコメント理由を併記
- **React**: 関数コンポーネント + フックのみ。クラスコンポーネント禁止
- **副作用**: `useEffect` の依存配列を必ず明示。空配列に依存する場合もコメントで意図を残す
- **エラーハンドリング**: `throw new Error(...)` 時はメッセージを具体的に。`console.error` ではなく `logger` 経由

### 2.4 禁止事項
- `var` の使用
- `namespace` の使用 (ESM で代替)
- `enum` の使用 (代わりにユニオン型 + `as const` オブジェクト)
- デフォルトエクスポートの乱用 (1 ファイル 1 主要 export を除き named export)

---

## 3. Python コーディング規約

### 3.1 言語バージョン / 設定
- Python **3.11+**
- 型ヒント必須 (関数シグネチャは全て annotate)
- PEP 8 準拠 (Ruff で自動チェック)

### 3.2 命名規則

| 対象 | 規則 | 例 |
|------|------|----|
| 変数・関数 | snake_case | `get_records`, `app_id` |
| クラス | PascalCase | `Client`, `KintoneApiError` |
| 定数 | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT` |
| モジュール | snake_case | `records.py`, `auth.py` |
| 非公開メンバ | `_` 接頭辞 | `_build_headers` |

### 3.3 記述スタイル
- **import 順序**: 標準ライブラリ → サードパーティ → 自プロジェクト (ブランクライン区切り)
- **docstring**: 公開クラス・関数には簡潔な Google スタイル docstring を必須とする (1 行で済むなら 1 行)
- **型**: `from __future__ import annotations` を先頭に記述し、遅延評価を活用
- **エラー**: 独自例外 `KintoneApiError` を基底にし、原因種別でサブクラス化

### 3.4 禁止事項
- `print()` によるデバッグ出力 (テストを除く) — `logging` 経由で出力
- 相対 import のネスト (`from ..foo import bar` レベルで深いもの)
- `__all__` の濫用 (明示エクスポート以外は不要)

---

## 4. スタイリング (Tailwind CSS)

### 4.1 基本方針
- **Tailwind ユーティリティクラスを第一選択**
- グローバル CSS は `styles/global.css` の Tailwind ディレクティブ + 最小限のリセットのみ
- kintone 本体の UI に干渉しないよう、プラグインのルート要素にスコープ (`.cowork-agent-root`) を付与

### 4.2 記述ルール
- クラス順は **Tailwind 公式推奨順序** (`prettier-plugin-tailwindcss` で自動整列)
- 動的クラス名は `clsx` で組み立て (`twMerge` 併用で衝突解消)
- カスタムカラー・フォントは `tailwind.config.ts` の `theme.extend` で定義

### 4.3 禁止事項
- インラインスタイル (`style={...}`) は動的な値 (位置計算等) 以外で使用禁止
- `!important` の使用禁止 (どうしても必要な場合は `!` プレフィックスの Tailwind 記法で明示)
- CSS Modules / styled-components は使わない (Tailwind に一本化)

---

## 5. テスト規約 (TDD)

本プロジェクトは **テスト駆動開発 (TDD)** を採用する。テストを先に書き、テストを通すために実装を書き、その後リファクタリングするサイクル (Red → Green → Refactor) を全実装で守る。

### 5.1 TDD の基本サイクル

各機能・各バグ修正は以下のサイクルで進める:

1. **Red**: 失敗するテストを 1 件書く (まだ実装は書かない)
2. **Green**: そのテストを通す **最小限** のコードを書く (汚くて OK)
3. **Refactor**: 重複や読みにくさを解消する (テストが緑のまま保つ)

これを **小さなステップ** で繰り返す。1 サイクルは数分〜十数分に収めることを目安にする。

### 5.2 採用する戦略

- **基本は Inside-Out (古典派 TDD)**: ロジック層 (`core/`, helper ライブラリ) は純粋関数 / 純粋クラスとして TDD で先行実装し、最後に UI / 統合層を組み立てる
- **UI は Outside-In 補助**: チャットの主要フローは Testing Library でユーザー視点のテスト (Acceptance Test) を先に書き、必要な内部 API を逆算して定義する
- **外部サービスは必ずテストダブル**: Anthropic / kintone の実 API は単体テストで叩かない。`responses` (Python) / `vi.mock` + 自前 fake (TypeScript) を使う

### 5.3 プラグイン側 (Vitest + Testing Library)

| レイヤー | TDD 方針 |
|---------|---------|
| `core/` (純粋ロジック) | **Inside-Out**: 関数の振る舞いを Vitest でテスト先行、実装後にリファクタ |
| `core/managed-agents/` (HTTP クライアント) | `fetch` を `vi.fn()` で差し替え、リクエスト形・エラー処理を契約として固定 |
| `core/bootstrap/` (リソース解決) | metadata 検索の境界値 (見つかる/見つからない/重複) を網羅 |
| `hooks/` | `renderHook` でフック単体の状態遷移をテスト → 実装 |
| `components/` | Testing Library でユーザー操作 (クリック / 入力 / 表示確認) を先に書く → コンポーネント実装 |
| Integration | チャット送信 → ポーリング → カード表示の主要フローを 1〜2 本書く (E2E ライク、Playwright は MVP 対象外) |

- テストファイルは対象ファイルの隣に `*.test.ts(x)` で配置
- カバレッジ目標: `core/` 80% / 全体 60% (MVP)

### 5.4 ヘルパーライブラリ側 (pytest)

- **Inside-Out で純 TDD 適用**: ヘルパーライブラリは純粋なロジック層なので、TDD と最も相性が良い
- HTTP モックは `responses` を使用 (実 API は叩かない)
- 各メソッドは「正常系」「エラー系」「境界値 (0, 1, 99, 100, 101, 200, 10000, 10001 件)」をテスト先行で網羅
- テスト対象ファイルに対応する `tests/test_<module>.py` を配置
- カバレッジ目標: 80%

### 5.5 テスト粒度ガイド

| 粒度 | 用途 | 比率目安 |
|------|------|---------|
| Unit | 1 関数 / 1 クラス / 1 フック | 70% |
| Component | 1 React コンポーネント (Testing Library) | 20% |
| Integration | 主要フロー (HTTP モック + 複数モジュール統合) | 10% |
| E2E | (Phase 2 以降) Playwright | — |

### 5.6 テスト原則

- **テスト名は内容を説明**: `it('returns empty list when no records match')` のように動詞 + 条件
- **1 テスト 1 振る舞い**: 関連アサーションはまとめて OK だが、複数の振る舞いを 1 テストに混ぜない
- **共有モックは最小限**: 可読性優先。`beforeEach` で fixture を共通化しすぎない
- **AAA パターン**: Arrange (準備) → Act (実行) → Assert (検証) の 3 段で構造化
- **失敗メッセージが原因を語る**: `expect(x).toBe(y)` よりも、状態が分かる toMatchObject や具体的な assert を優先
- **テストが落ちることを 1 度は確認**: 実装前に Red、実装後に Green を必ず両方目視

### 5.7 TDD で守らない例外

以下は TDD を緩めて良い:

- **設定ファイル / 型定義 / 単純な定数** (`tsconfig.json`, `manifest.json`, `constants.ts` など) — テスト不要
- **インライン SVG アイコン** — スナップショットテストで十分
- **試行錯誤のスパイク** — 仕様が固まる前のプロトタイプは別ブランチで自由に書く。本流に取り込む際は TDD で書き直す

### 5.8 PR ルール

- **テストのコミットを 1 つ以上含むこと** (Red コミット → Green コミット の構造を推奨)
- 「実装のみ」の PR はレビュー時に質問が入る。理由を本文に書くか、テストを追加してから merge する

---

## 6. Git 規約

### 6.1 ブランチ戦略 (GitHub Flow)

`main` ブランチを常にリリース可能な安定版として維持する。

```
main                                  # 常にリリース可能な安定版
├── feature/[Issue番号]-[機能名]        # 機能開発
├── fix/[Issue番号]-[バグ内容]          # バグ修正
└── feature/[YYYYMMDD]-[topic]          # ステアリングを伴う大規模作業
```

- `develop` ブランチは使用しない
- 作業は必ず `feature/` または `fix/` ブランチで行い、完了後 `main` にマージ
- 通常は **Issue 番号ベース** (`feature/44-chat-panel`、`fix/99-submit-button`)
- ステアリングディレクトリ (`.steering/[YYYYMMDD]-[title]/`) を伴う場合は **日付ベース** (`feature/20260425-initial-implementation`)
- マージ後はブランチを削除する

### 6.2 コミットメッセージ

`[種別]: 説明` の簡潔形式で記述する。

| 種別 | 用途 |
|------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメント変更 |
| `style` | コードスタイルのみの変更 |
| `refactor` | 機能変更を伴わないリファクタリング |
| `test` | テスト追加・修正 |
| `chore` | ビルド・依存・ツール設定変更 |
| `ci` | CI 設定変更 |

```
feat: アプリ画面に Chat UI を追加
fix: エージェントループが終了しない問題を修正
docs: functional-design.md にツール定義を追記
```

#### Issue クローズ

Issue に紐づくすべてのコミット (`feat` / `fix` 問わず) には `Closes #<Issue番号>` を本文に含める。**ブランチ名に Issue 番号があっても GitHub は自動リンクしないため、コミットメッセージへの記載が必須**。

```
feat: プロンプトチップ機能を追加

Closes #44
```

### 6.3 プルリクエスト

- **1 PR = 1 機能・1 修正**
- PR 作成前に手動テストチェックリストを確認する
- レビュー不要の場合はセルフマージ可
- **CI 通過必須**: Lint / 型 / テスト + プラグインビルドが全て green
- マージ方式: Squash merge (main を linear に保つ)

### 6.4 GitHub Issues ラベル運用

Issue には必ず **status ラベル 1 つ** と **area ラベル 1 つ以上** を付与する。
ラベル定義は [.github/labels.yml](.github/labels.yml) で管理し、`bash scripts/setup-labels.sh` で同期する。

#### status ラベル

| ラベル | 説明 |
|---|---|
| `status: planned` | 対応予定 (未着手) |
| `status: completed` | 実装完了 |

#### area ラベル

| ラベル | 説明 |
|---|---|
| `area: ai` | AI / Claude API / Managed Agents 関連 |
| `area: kintone` | kintone 操作・REST API 連携 |
| `area: ux` | UI・UX・デザイン関連 |
| `area: helper` | Python ヘルパーライブラリ |
| `area: ci` | CI/CD・ビルド・リリース |
| `area: docs` | ドキュメント |
| `area: integration` | 外部サービス連携 (Slack / Salesforce / Gmail 等) |

```
# 例
status: planned + area: ux + area: kintone   → UI 改善かつ kintone 連携を含む新機能
status: completed + area: ai                 → 実装済みの AI 機能
```

- GitHub のデフォルトラベル (`enhancement` / `bug` 等) は使用しない
- Issue クローズ時は `status: planned` → `status: completed` に更新

### 6.5 タグ・リリース

- タグは **`pnpm plugin:release`** で自動作成する (手動で `git tag` しない)
- タグ push をトリガに GitHub Actions が `plugin.zip` を自動ビルドして GitHub Releases に公開
- タグ形式:
  - **プラグイン**: `v{major}.{minor}.{patch}` (例: `v1.0.1`)
  - **Python ヘルパー** (Phase 1b 以降): `helper-v{major}.{minor}.{patch}` (例: `helper-v0.2.0`)
- 詳細は §7 バージョン管理 参照

### 6.6 禁止事項

- `main` への直接 push (ブランチ保護ルールで強制)
- 大量ファイル混在 PR (1 PR 1 関心事)
- **テスト先行のないコミット (TDD 違反)** — 設定・型定義など §5.7 の例外を除く
- テスト未追加の機能追加 PR (明示的に例外理由を書く場合を除く)
- `package.json` の `version` を **手動で書き換え禁止** (必ず `pnpm plugin:release*` 経由)
- 手動で `git tag` するのも禁止

---

## 7. バージョン管理

### 7.1 バージョン体系 (4 つの番号)

| 番号 | 管理場所 | 更新タイミング | 例 |
|------|---------|--------------|-----|
| **major** | `packages/plugin/package.json` | 大幅な仕様変更・リブランド | `1` |
| **minor** | `packages/plugin/package.json` | 新機能追加 (`feat` コミットを含むリリース) | `0` |
| **patch** | `packages/plugin/package.json` | バグ修正・小改善のみ (`fix` / `chore` のみ) | `1` |
| **build** | `packages/plugin/plugin/manifest.json` | `pnpm plugin:build` のたびに自動 +1 | `163` |

#### 表示例

```
GitHub タグ・Releases:  v1.0.1
kintone プラグイン画面:  1.0.1 (build 163)
package.json:           1.0.1
manifest.json:          163
```

### 7.2 バージョン種別の選び方

| リリースに含まれる変更 | 使用コマンド |
|----------------------|------------|
| 新機能 (`feat`) が 1 件以上ある | `pnpm plugin:release:minor` |
| バグ修正・改善 (`fix` / `chore` / `docs`) のみ | `pnpm plugin:release` (= patch) |
| 破壊的変更・大幅リブランド | `pnpm plugin:release:major` |

### 7.3 コマンド一覧

| コマンド | 役割 |
|---------|------|
| `pnpm plugin:build` | build 番号 (manifest.json) を +1。開発中に何度でも実行可 |
| `pnpm plugin:pack` | 現在の manifest を使って `plugin.zip` を生成 |
| `pnpm plugin:upload` | `.env` の認証情報で kintone 環境にアップロード |
| `pnpm plugin:deploy` | build → pack → upload を一気通貫 |
| `pnpm plugin:release` | patch +1 → git commit + タグ作成 (default) |
| `pnpm plugin:release:minor` | minor +1, patch = 0 → git commit + タグ作成 |
| `pnpm plugin:release:major` | major +1, minor/patch = 0 → git commit + タグ作成 |

### 7.4 開発〜リリースの流れ

```
[feature ブランチで開発]
  実装 → 手動 or 自動デプロイで build 番号 +1 (manifest.json)
  ※ Stop フックで自動デプロイされるので通常は手動 build 不要

[main にマージ後、リリースする時]
  pnpm plugin:release           # patch (or :minor / :major)
                                # → package.json bump + commit + v* タグ作成
  git push origin main --tags   # GitHub に push
  → GitHub Actions が plugin.zip を自動ビルドして Release に添付
```

### 7.5 ルール

- **build 番号は開発用**。kintone 画面で確認できる。GitHub では管理しない
- **リリースバージョン (major.minor.patch) は `pnpm plugin:release*` でのみ更新**。手動で書き換えない
- **GitHub タグとリリースバージョンは常に一致**させる (`v1.0.1` タグ = `package.json` の `1.0.1`)
- **build 番号と semver は独立**。release コマンドは build 番号には触れない
- **Working tree が clean** な状態でしか release コマンドは動かない (誤コミット防止)

---

## 8. セキュリティガイドライン

### 8.1 絶対ルール

1. **認証情報をコード・リポジトリにコミットしない**
   - `.env` 等は `.gitignore` に追加
   - サンプルは `.env.example` として用意
2. **ログに機微情報を出力しない**
   - API Key / パスワード / 個人情報は必ずマスク
3. **Anthropic API Key はブラウザ側 JS から参照不可**
   - すべて `kintone.plugin.app.proxy` 経由
4. **kintone 認証情報は Vault にのみ保存**
   - プラグイン設定や ブラウザ Storage への保存禁止
5. **チャット表示は DOMPurify でサニタイズ**
   - Agent 出力にも XSS 対策を適用

### 8.2 依存関係

- `pnpm audit` / `pip audit` を CI で定期実行
- 既知の脆弱性を含む依存は即座にアップデート

### 8.3 コードレビュー観点

- 認証情報・秘匿情報の取り扱いに変更があれば必ずセキュリティ観点でレビュー
- 外部入力 (ユーザー入力、Agent 出力、REST レスポンス) が UI に流れる経路を確認

---

## 9. ドキュメント規約

### 9.1 コード内コメント

- **WHY を書く**: 何をしているかは名前・コードで伝わるよう命名で工夫
- **TODO / FIXME**: Issue 番号を必須 (`// TODO(#42): ...`)

### 9.2 公開 API の docstring / JSDoc

- TypeScript: 公開関数・型に JSDoc (最小 1 行)
- Python: 公開クラス・関数に docstring (Google スタイル)

### 9.3 変更ログ

- ヘルパーライブラリ: `CHANGELOG.md` を Keep a Changelog 形式で更新
- プラグイン: GitHub Releases ノートに集約

---

## 10. ローカル開発

### 10.1 セットアップ

```bash
# 依存インストール
pnpm install                      # JS 全体
uv sync --directory packages/kintone-helper  # Python

# プラグインビルド (開発用)
pnpm --filter plugin dev

# プラグイン zip 化
pnpm --filter plugin build
pnpm --filter plugin package      # cli-kintone plugin pack
```

### 10.2 環境変数 (開発時のみ)

`.env.local` ファイルをプラグイン配下に配置 (コミット禁止):
- `ANTHROPIC_API_KEY`: ローカル動作確認用
- `KINTONE_DOMAIN`: 検証用サブドメイン
- `KINTONE_LOGIN` / `KINTONE_PASSWORD`: 検証用アカウント

### 10.3 pre-commit フック

- Lint / 型チェック / フォーマッタを `lefthook` または `husky` で自動実行
- 通過しないとコミット不可

---

## 11. レビュー / 品質ゲート

| ゲート | ツール | タイミング |
|-------|-------|-----------|
| Format | Prettier / Ruff | pre-commit + CI |
| Lint | ESLint / Ruff | pre-commit + CI |
| 型チェック | tsc / mypy | pre-commit + CI |
| ユニットテスト | Vitest / pytest | pre-commit (変更分のみ) + CI (全件) |
| 依存監査 | pnpm audit / pip audit | CI (週次) |
| ビルド確認 | Vite / hatchling | CI (PR 時) |

すべて CI で通過しないと main にマージ不可。

---

## 12. アクセシビリティ / i18n

- **キーボード操作** で全チャット機能が完結すること
- **ARIA ロール / ラベル** を適切に付与
- UI 文言は必ず `locales/<lang>.json` 経由。ハードコード禁止
- MVP は日本語のみ、将来の英語対応を想定した実装

---

## 13. 変更履歴 (本ガイドライン)

- 2026-04-23: 初版作成
