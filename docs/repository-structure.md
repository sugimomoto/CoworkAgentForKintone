# リポジトリ構造定義書 (Repository Structure)

**プロダクト名**: Cowork Agent for kintone
**バージョン**: 0.1 (MVP ドラフト)
**最終更新日**: 2026-04-23

---

## 1. 概要

本リポジトリは **pnpm workspace** を利用したモノレポ構成で、以下 2 パッケージを管理する。

| パッケージ | 言語 | 成果物 |
|-----------|------|--------|
| `packages/plugin` | TypeScript (React + Vite + Tailwind) | kintone プラグイン `.zip` |
| `packages/kintone-helper` | Python 3.11+ | pip パッケージ (PyPI 公開) |

---

## 2. リポジトリ全体構造

```
CoworkAgentForKintone/
├── .claude/                         # Claude Code 設定・スキル (開発支援)
├── .github/
│   └── workflows/                   # GitHub Actions 定義
│       ├── ci.yml                   # Lint / 型 / テスト
│       ├── build-plugin.yml         # プラグイン zip ビルド
│       └── publish-pypi.yml         # Python パッケージ公開
├── .steering/                       # 作業単位ドキュメント
│   └── [YYYYMMDD]-[title]/
│       ├── requirements.md
│       ├── design.md
│       └── tasklist.md
├── docs/                            # 永続ドキュメント
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md     # 本ファイル
│   ├── development-guidelines.md
│   └── glossary.md
├── packages/
│   ├── plugin/                      # kintone プラグイン
│   │   ├── src/
│   │   ├── public/
│   │   ├── manifest.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   └── README.md
│   └── kintone-helper/              # Python ヘルパーライブラリ
│       ├── src/cowork_agent_kintone/
│       ├── tests/
│       ├── pyproject.toml
│       ├── README.md
│       └── CHANGELOG.md
├── scripts/                         # 開発補助スクリプト
│   ├── package-plugin.mjs
│   └── release.mjs
├── .editorconfig
├── .gitignore
├── .prettierrc
├── .prettierignore
├── .eslintrc.cjs
├── CLAUDE.md                        # プロジェクトメモリ (開発規約)
├── LICENSE                          # MIT
├── README.md
├── package.json                     # workspace root
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

---

## 3. packages/plugin (kintone プラグイン)

### 3.1 ディレクトリ構造

```
packages/plugin/
├── src/
│   ├── desktop/
│   │   ├── index.tsx                # レコード一覧画面エントリ (app.record.index.show)
│   │   ├── ChatPanel.tsx            # サイドパネルのチャット UI ルート
│   │   ├── components/              # プレゼンテーション層 React コンポーネント
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── ApprovalCard.tsx
│   │   │   ├── TaskIndicator.tsx
│   │   │   └── CredentialDialog.tsx
│   │   └── hooks/                   # React フック
│   │       ├── useSession.ts
│   │       ├── useEventPoller.ts
│   │       └── useUserBinding.ts
│   ├── config/
│   │   ├── index.tsx                # プラグイン設定画面エントリ
│   │   └── ConfigScreen.tsx
│   ├── core/                        # UI に依存しないロジック層
│   │   ├── managed-agents/
│   │   │   ├── client.ts            # Managed Agents HTTP クライアント (kintone.proxy 経由)
│   │   │   ├── resources.ts         # Agent/Environment/Vault/Session の CRUD + metadata フィルタ
│   │   │   ├── events.ts            # イベント送受信 (ポーリング含む)
│   │   │   └── types.ts
│   │   ├── kintone/
│   │   │   ├── api.ts               # @kintone/rest-api-client ラッパ
│   │   │   └── user.ts              # getLoginUser() 等
│   │   ├── bootstrap/
│   │   │   ├── resolveAgent.ts      # Default Agent 解決・作成
│   │   │   ├── resolveEnvironment.ts
│   │   │   └── resolveVault.ts
│   │   └── constants.ts             # metadata キー名、ポーリング間隔等
│   ├── store/                       # Zustand ストア
│   │   ├── chatStore.ts
│   │   └── configStore.ts
│   ├── utils/
│   │   ├── markdown.ts              # DOMPurify + markdown レンダラ
│   │   └── logger.ts
│   ├── locales/
│   │   └── ja.json
│   ├── styles/
│   │   └── global.css               # Tailwind エントリ
│   └── types/
│       └── kintone-plugin.d.ts
├── public/
│   └── image/
│       └── icon.png                 # プラグインアイコン
├── manifest.json                    # プラグイン定義ファイル
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── README.md
```

### 3.2 manifest.json の要点

```json
{
  "manifest_version": 1,
  "version": "0.1.0",
  "type": "APP",
  "name": { "ja": "Cowork Agent for kintone" },
  "description": { "ja": "Claude Managed Agents を活用した業務エージェント" },
  "icon": "image/icon.png",
  "homepage_url": { "ja": "https://github.com/.../CoworkAgentForKintone" },
  "desktop": {
    "js": ["js/desktop.js"],
    "css": ["css/desktop.css"]
  },
  "config": {
    "html": "html/config.html",
    "js": ["js/config.js"],
    "required_params": ["proxyConfigured"]
  }
}
```

### 3.3 ビルド成果物

- `dist/` に Vite 出力
- `dist-plugin/` に `cli-kintone plugin pack` で zip 化した `plugin.zip`

---

## 4. packages/kintone-helper (Python ヘルパーライブラリ)

### 4.1 ディレクトリ構造

```
packages/kintone-helper/
├── src/cowork_agent_kintone/
│   ├── __init__.py                  # エクスポート定義
│   ├── client.py                    # Client クラス
│   ├── auth.py                      # Basic 認証ヘッダ構築
│   ├── apps.py                      # get_apps / get_app_schema / get_form_layout
│   ├── records.py                   # get_records / add_records / update_records / delete_records
│   ├── bulk.py                      # bulk_request
│   ├── cursor.py                    # カーソル API ラッパ (10,000 件超の自動継続)
│   ├── errors.py                    # KintoneApiError 等
│   └── _http.py                     # 共通 HTTP 呼出
├── tests/
│   ├── test_client.py
│   ├── test_records.py
│   ├── test_cursor.py
│   └── fixtures/
│       └── responses.json
├── pyproject.toml
├── README.md
├── CHANGELOG.md
└── LICENSE
```

### 4.2 pyproject.toml の要点

```toml
[project]
name = "cowork-agent-kintone"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["requests>=2.31"]

[project.optional-dependencies]
dev = ["pytest", "responses", "ruff", "mypy"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### 4.3 公開先

- PyPI: `pip install cowork-agent-kintone`
- GitHub Releases にも成果物添付

---

## 5. 命名規則 (概要)

### 5.1 ファイル名

| 種別 | 規則 | 例 |
|------|-----|----|
| TypeScript コンポーネント | PascalCase | `ChatPanel.tsx` |
| TypeScript モジュール | camelCase | `chatStore.ts` |
| React フック | camelCase、`use` 接頭辞 | `useSession.ts` |
| Python モジュール | snake_case | `records.py` |
| ドキュメント | kebab-case | `functional-design.md` |

### 5.2 ディレクトリ

- TypeScript: camelCase または単数形の名詞 (`components/`, `hooks/`, `store/`)
- Python: snake_case
- 機能分類は層別 (`core/`, `components/`) か機能別 (`managed-agents/`, `kintone/`)

### 5.3 コード規約の詳細

詳細は [docs/development-guidelines.md](docs/development-guidelines.md) にて定義。

---

## 6. ファイル配置ルール

### 6.1 プラグイン側 (TypeScript)

- **UI 層** (`src/desktop/components/`, `src/config/`): React コンポーネントのみ。ビジネスロジックは禁止
- **ロジック層** (`src/core/`): ブラウザ DOM や React 非依存。ユニットテスト可能にする
- **状態管理** (`src/store/`): Zustand ストア。複数コンポーネント間で共有する状態のみ
- **型定義** (`src/types/`): グローバルな型拡張 (`kintone-plugin.d.ts` 等)
- **定数・設定** (`src/core/constants.ts`): metadata キー、ポーリング設定等

### 6.2 ヘルパーライブラリ側 (Python)

- **`client.py`**: ユーザーが最初に import する `Client` を定義。他モジュールに委譲
- **機能別モジュール**: `apps.py` / `records.py` / `bulk.py` に API 操作を分離
- **内部ユーティリティ**: 先頭 `_` を付けて公開 API と区別 (`_http.py` 等)
- **テスト**: `tests/` 配下、ファイル名 `test_<module>.py`

### 6.3 禁止事項

- `packages/plugin/` から `packages/kintone-helper/` を import しない (言語が違うため物理的に不可だが、概念的にも独立したプロジェクトとして扱う)
- ドキュメントをコード配下に置かない (README 以外は `docs/` か `.steering/` に集約)
- 生成物 (`dist/`, `dist-plugin/`, `__pycache__/`, `.venv/` 等) はコミット禁止

---

## 7. ブランチ戦略

- **main**: リリース版。常にデプロイ可能な状態を維持
- **feature/[YYYYMMDD]-[topic]**: 機能追加ブランチ。`.steering/` のディレクトリ名に対応
- **fix/[issue-number]-[topic]**: バグ修正ブランチ
- **chore/[topic]**: 依存更新など軽微な作業

### PR フロー
1. feature ブランチで開発
2. PR 作成 → CI で Lint / 型 / テストを実行
3. レビュー承認後に main へ squash merge

---

## 8. リリース成果物

| 成果物 | 配布先 | タグ |
|-------|--------|------|
| `plugin.zip` | GitHub Releases | `plugin-v<semver>` |
| Python wheel / sdist | PyPI + GitHub Releases | `helper-v<semver>` |

2 パッケージは独立したバージョニングで、タグプレフィックスで区別する。
