# DevContainer 開発環境

VS Code Dev Containers / GitHub Codespaces で開ける、再現性の高い開発環境定義です。

## 提供ツール

| ツール | バージョン | 用途 |
|---|---|---|
| Node.js | 24.x | プラグイン (TypeScript) ビルド |
| pnpm | (package.json の `packageManager` から解決) | Node ワークスペース管理 |
| Python | 3.12 | kintone ヘルパーライブラリ開発 (3.11+ 要件を満たす) |
| uv | latest | Python 依存解決の高速化 |
| hatch | latest | Python パッケージビルド (wheel/sdist) |
| cli-kintone | latest | プラグインの pack / upload |

## 開き方

### VS Code (ローカル)
1. [Dev Containers 拡張](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) をインストール
2. リポジトリを VS Code で開く
3. コマンドパレット (`⌘⇧P`) → **Dev Containers: Reopen in Container**
4. 初回ビルドは 3〜5 分かかる (以降はキャッシュ利用)

### GitHub Codespaces
- リポジトリページで `Code` → `Codespaces` → `Create codespace on main`
- ブラウザで自動起動

## 含めたもの・含めないもの

**Container 内で動く**
- `pnpm install` / `pnpm test` / `pnpm typecheck` / `pnpm build` (TypeScript 側)
- `pytest` / `ruff` / `mypy` / `hatch build` (Python 側)
- `cli-kintone plugin pack` (zip 生成)

**ホスト側で動かすことを推奨**
- **Playwright E2E** — ブラウザ実行・kintone 実環境アクセスのため、ホスト側の `pnpm e2e` が安定
- **`pnpm app-deploy` / `pnpm upload`** — `.env` をマウントすれば Container 内でも動くが、ローカルの `.ppk` 鍵管理を考えるとホストが楽

## .env / .ppk の扱い

`.env` と `packages/plugin/.keys/plugin.ppk` は `.gitignore` 済 = Container にも自動でマウントされる
(リポジトリディレクトリ全体を bind mount しているため)。

## トラブルシューティング

- **OneDrive 配下で Container を開くと遅い** — bind mount の overhead で初回ビルドが遅くなることがある。気になる場合はリポジトリを `~/Code/` などに移すか、Codespaces を使う
- **`pnpm` が見つからない** — `corepack enable` が走った後にシェルを開き直す。`source ~/.bashrc` でも可
- **Playwright がインストールされていない** — Container には入っていない。E2E はホストで実行
