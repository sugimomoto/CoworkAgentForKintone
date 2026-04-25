# @cowork-agent/plugin

**Cowork Agent for kintone** のプラグイン本体パッケージです。

> Phase 0 時点ではビルドステップなしの最小構成です。Phase 1a で Vite + React によるビルドパイプラインに置き換えます。

---

## ディレクトリ構造

```
packages/plugin/
├── plugin/                     ← cli-kintone plugin pack の入力 (zip 化される実体)
│   ├── manifest.json
│   ├── js/
│   │   ├── desktop.js
│   │   └── config.js
│   ├── css/
│   │   ├── desktop.css
│   │   └── config.css
│   ├── html/
│   │   └── config.html
│   └── image/
│       └── icon.png            ← 32×32 placeholder (Teal #0d9488)
├── scripts/
│   └── upload.mjs              ← ローカル kintone へアップロードする Node スクリプト
├── .keys/                      ← .ppk 秘密鍵 (Git 管理外)
│   └── plugin.ppk              (keygen 実行時に生成)
├── dist/                       ← ビルド出力 (Git 管理外)
│   └── plugin.zip
├── package.json
└── README.md
```

---

## 配布と運用の責務分担

| 環境 | 責務 |
|------|------|
| **GitHub (CI)** | OSS 配布用 `plugin.zip` の生成のみ。kintone へのアップロードはしない |
| **ローカル開発環境** | `plugin.zip` 生成 + 自分の kintone 開発環境へのアップロード |

OSS ユーザーは GitHub Releases から `plugin.zip` をダウンロードし、自身の kintone にインストールします。アップロード自動化は各メンテナのローカル責任で行います。

---

## 前提

- Node.js 20.x 以降 (`--env-file` を使うため)
- `cli-kintone` (`npm install -g @kintone/cli`)

---

## ローカル開発手順

### 1. リポジトリルートに `.env` を作成

```bash
cp .env.example .env
$EDITOR .env
```

`.env` には自分の kintone 開発環境の認証情報を記述します:

```env
KINTONE_BASE_URL=https://your-subdomain.cybozu.com
KINTONE_USERNAME=your-login-name
KINTONE_PASSWORD=your-password
```

> `.env` は `.gitignore` で除外済み。**絶対にコミットしないでください**。

### 2. 初回セットアップ — 秘密鍵 (.ppk) の生成

`.ppk` はプラグイン ID を決定する **永続的な鍵** です。一度生成したら、それ以降のすべてのパッケージング・アップロードで同じ `.ppk` を使い続けます。**紛失または再生成すると、既存インストール済みプラグインの更新ができなくなります**。

```bash
pnpm plugin:keygen
```

生成された `packages/plugin/.keys/plugin.ppk` を **必ず安全な場所にバックアップ** してください (1Password / GitHub Secrets 等)。

#### 安全装置

`pnpm plugin:keygen` は **既に `.ppk` が存在する場合は拒否** します:

```text
[Cowork Agent] .keys/plugin.ppk は既に存在します。
```

意図的に再生成したい場合 (例: 別プラグインとして作り直す) は、既存をバックアップしてから:

```bash
pnpm plugin:keygen -- --force
```

#### `pnpm plugin:pack` / `plugin:upload` での再利用

これらのコマンドは常に既存の `.keys/plugin.ppk` を使うため、複数回実行しても同じ Plugin ID で署名されます (kintone 側では同一プラグインのバージョン更新として認識されます)。

### 3. プラグイン zip のパッケージング

```bash
pnpm plugin:pack
# → packages/plugin/dist/plugin.zip
```

### 4. kintone へのアップロード

`.env` に認証情報を設定済みであれば:

```bash
pnpm plugin:upload
```

または、パッケージング + アップロードを一気に実行:

```bash
pnpm plugin:deploy   # build → pack → upload
```

> `cli-kintone plugin upload` は **パスワード認証のみ対応** (API トークン非対応)。アップロードユーザーは kintone のシステム管理者権限が必要です。

---

## E2E テスト (Playwright)

実際の kintone 環境にアップロードしたプラグインの動作を検証する。

### 初回セットアップ

```bash
# Chromium ブラウザバイナリ取得 (~100MB、初回のみ)
pnpm plugin:e2e:install
```

`.env` に E2E 用のアプリ ID を追記:

```env
# プラグインを追加した kintone アプリの ID (URL の /k/<APP_ID>/ 部分)
KINTONE_TEST_APP_ID=42
```

> アプリ ID は kintone 管理画面でプラグイン追加済のアプリを開き、URL から確認してください。

### 実行

```bash
pnpm plugin:e2e             # 全テスト実行 (CLI レポート + HTML レポート生成)
pnpm plugin:e2e:ui          # Playwright UI モード (デバッグ用)
pnpm plugin:e2e -- smoke    # smoke spec のみ
```

### スコープ (Phase 1a)
- `auth.setup.ts`: kintone ログイン → `.auth/kintone.json` に storageState 保存 (1 回だけ)
- `smoke.spec.ts`: レコード一覧画面でパネル表示、Header / Composer の存在確認
- `chat-flow.spec.ts`: Anthropic API をルートインターセプトでモックし、UserMessage が DOM に追加されることを確認

### Phase 1b 以降の拡張候補
- 実 Anthropic に対する接続テスト
- HITL 承認フロー / Plan カード / Progress カードの動作確認
- モバイル対応の E2E

---

## CI/CD (GitHub Actions)

### `.github/workflows/build-plugin.yml`

| トリガ | 動作 |
|-------|------|
| PR (`packages/plugin/**` 変更) | zip 化 + 30MB サイズ検証 + Artifact 7 日間保管 |
| `main` への push | 同上 |
| `plugin-v*` タグ push | 同上 + GitHub Release に zip 自動添付 |
| 手動 (`workflow_dispatch`) | 同上 |

### 必要な GitHub Secrets

| Secret 名 | 用途 | 必要性 |
|----------|------|--------|
| `KINTONE_PLUGIN_PPK_BASE64` | プラグイン署名鍵 (`.ppk` を base64 化したもの) | **タグリリース時のみ必須** (PR ビルドは未設定なら ephemeral key で動作) |

**プラグイン ID 一貫性の重要性**:
- OSS 配布される `plugin.zip` は **常に同じ `.ppk` で署名する必要があります**。鍵が変わるとユーザーは新規プラグインとしてインストールし直す必要が生じ、既存設定が失われます
- そのため **タグリリース版** (`plugin-v*`) は必ず GitHub Secret から復元した正規 `.ppk` で署名されます

#### `.ppk` を Secret に登録する手順

```bash
# macOS
base64 -i packages/plugin/.keys/plugin.ppk | pbcopy

# Linux
base64 -w 0 packages/plugin/.keys/plugin.ppk | xclip -selection clipboard
```

その値を **GitHub Settings → Secrets and variables → Actions → New repository secret** に `KINTONE_PLUGIN_PPK_BASE64` として登録します。

---

## トラブルシューティング

| 症状 | 原因 | 対応 |
|------|-----|------|
| `cli-kintone: command not found` | 未インストール | `npm install -g @kintone/cli` |
| `必要な環境変数が未設定です: ...` | `.env` 未作成 / 値が空 | `cp .env.example .env` して値を埋める |
| `dist/plugin.zip が見つかりません` | パッケージング未実行 | `pnpm plugin:pack` を先に実行 (または `pnpm plugin:deploy`) |
| `private key required` | `.ppk` 未配置 | `pnpm plugin:keygen` で生成 (※プラグイン ID が変わる) |
| `Authentication failed` | 認証情報の誤り or 権限不足 | `.env` の値確認、システム管理者アカウントを使用 |
| プラグイン ID が変わってしまった | 異なる `.ppk` で署名 | バックアップから元の `.ppk` を復旧 |

---

## 関連ドキュメント

- [docs/repository-structure.md](../../docs/repository-structure.md) — リポジトリ全体構造
- [docs/architecture.md](../../docs/architecture.md) — 技術スタック詳細
- [.steering/20260425-initial-implementation/](../../.steering/20260425-initial-implementation/) — 初回実装ステアリング
