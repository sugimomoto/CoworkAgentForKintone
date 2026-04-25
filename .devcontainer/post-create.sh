#!/usr/bin/env bash
# Cowork Agent for kintone — DevContainer 初回セットアップ
#
# devcontainer.json の postCreateCommand から呼ばれる。
# - pnpm 有効化 + 依存インストール
# - Python 開発ツール (uv / hatch / pip 開発依存) インストール
# - cli-kintone (kintone プラグインビルド/アップロード CLI) インストール

set -euo pipefail

echo "==> [1/4] Enabling corepack and installing pnpm"
corepack enable
# package.json の packageManager フィールドからバージョンが解決される
corepack prepare --activate

echo "==> [2/4] Installing Node workspace dependencies (pnpm install)"
pnpm install --frozen-lockfile

echo "==> [3/4] Installing Python development tools (uv, hatch, ruff, mypy)"
# uv: 高速な Python プロジェクトマネージャ。ホスト環境を汚さず Python 依存解決ができる
python -m pip install --upgrade pip
python -m pip install --user uv hatch

echo "==> [4/4] Installing cli-kintone (kintone plugin build/upload CLI)"
# pnpm 経由ではなく npm グローバルでインストール (pnpm のグローバル PATH 設定の手間を省く)
npm install -g @kintone/cli

echo ""
echo "==> Optional: install kintone-helper in editable mode"
echo "    (skipped — Phase 1b-1 でパッケージ実装後に有効化)"
echo "    将来は: pip install -e ./packages/kintone-helper[dev]"

echo ""
echo "==> DevContainer setup complete."
echo "    Node:        $(node --version)"
echo "    pnpm:        $(pnpm --version)"
echo "    Python:      $(python --version)"
echo "    uv:          $(uv --version 2>&1 || echo 'not on PATH yet — open new shell')"
echo "    hatch:       $(hatch --version 2>&1 || echo 'not on PATH yet — open new shell')"
echo "    cli-kintone: $(cli-kintone --version 2>&1 || echo 'not found')"
echo ""
echo "    Note: Playwright E2E はホスト側で実行することを推奨 (ブラウザ表示・kintone への"
echo "    実環境アクセスのため)。Container 内では unit/typecheck/build が主な用途。"
