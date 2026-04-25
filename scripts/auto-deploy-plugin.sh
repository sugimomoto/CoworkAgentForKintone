#!/usr/bin/env bash
# auto-deploy-plugin.sh
# Claude Code の Stop フックから呼ばれる自動デプロイスクリプト
#
# 動作:
#   1. packages/plugin/plugin/** に dist/plugin.zip より新しいファイルがあるかチェック
#   2. 変更ありなら `pnpm plugin:deploy` を実行
#   3. 結果を JSON で stdout に出力 ({"systemMessage": "..."})
#
# 出力フォーマット:
#   - 変更なし: 出力なし (silent)
#   - 成功: {"systemMessage": "🚀 ..."}
#   - 失敗: {"systemMessage": "❌ ..."}

set -uo pipefail

# リポジトリルートに移動 (スクリプトの位置から相対)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PLUGIN_SRC="packages/plugin/plugin"
PLUGIN_ZIP="packages/plugin/dist/plugin.zip"

# --- 1. 変更検知 ---
NEED_DEPLOY=0
if [ ! -f "$PLUGIN_ZIP" ]; then
  NEED_DEPLOY=1
elif find "$PLUGIN_SRC" -type f -newer "$PLUGIN_ZIP" 2>/dev/null | grep -q .; then
  NEED_DEPLOY=1
fi

if [ "$NEED_DEPLOY" = "0" ]; then
  exit 0
fi

# --- 2. nvm を読み込んで Node / pnpm にパスを通す ---
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

# --- 3. .env の存在チェック ---
if [ ! -f "$REPO_ROOT/.env" ]; then
  printf '{"systemMessage": "⚠️ Plugin auto-deploy: .env が見つかりません。`cp .env.example .env` で作成してください。"}'
  exit 0
fi

# --- 4. pnpm plugin:deploy 実行 ---
OUTPUT=$(pnpm plugin:deploy 2>&1)
EXIT=$?

if [ $EXIT -eq 0 ]; then
  # 成功: Plugin ID とバージョンを抽出して通知
  SUMMARY=$(echo "$OUTPUT" | grep -E "Plugin ID:|Target version:" | tr '\n' ' ' | sed 's/  */ /g')
  if [ -z "$SUMMARY" ]; then
    SUMMARY="installed"
  fi
  printf '{"systemMessage": "🚀 Plugin auto-deployed: %s"}' "$SUMMARY"
else
  # 失敗: 末尾 15 行を含めて通知 (jq でエスケープ)
  if command -v jq >/dev/null 2>&1; then
    ESCAPED=$(echo "$OUTPUT" | tail -15 | jq -Rs .)
    printf '{"systemMessage": "❌ Plugin auto-deploy failed (exit %d):\\n%s"}' "$EXIT" "$ESCAPED"
  else
    printf '{"systemMessage": "❌ Plugin auto-deploy failed (exit %d). 詳細はターミナルで `pnpm plugin:deploy` を実行して確認してください。"}' "$EXIT"
  fi
fi
