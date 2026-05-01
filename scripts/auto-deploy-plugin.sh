#!/usr/bin/env bash
# auto-deploy-plugin.sh
# Claude Code の Stop フックから呼ばれる自動デプロイスクリプト
#
# 動作:
#   1. Plugin ソース変更があれば `pnpm plugin:deploy` (build → pack → upload kintone)
#   2. Worker ソース変更があれば `pnpm worker:deploy` (esbuild bundle → Cloudflare upload)
#   3. 結果を JSON で stdout に出力 ({"systemMessage": "..."})
#
# 監視対象:
#   - packages/plugin/src       … Plugin TS/TSX
#   - packages/plugin/plugin    … manifest / icon / 静的 CSS
#   - packages/kintone-mcp/src  … Worker TS (Plugin bundle にも取り込まれるので両方影響)
#
# 出力:
#   - 変更なし: 出力なし (silent)
#   - 成功: {"systemMessage": "🚀 ..."}
#   - 失敗: {"systemMessage": "❌ ..."}

set -uo pipefail

# リポジトリルートに移動 (スクリプトの位置から相対)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PLUGIN_ZIP="packages/plugin/dist/plugin.zip"
WORKER_STAMP="packages/plugin/dist/.worker-deployed"

PLUGIN_SOURCES=(
  "packages/plugin/src"
  "packages/plugin/plugin"
  "packages/kintone-mcp/src"
)
WORKER_SOURCES=(
  "packages/kintone-mcp/src"
)

# --- 1. 変更検知 ---
NEED_PLUGIN=0
if [ ! -f "$PLUGIN_ZIP" ]; then
  NEED_PLUGIN=1
elif find "${PLUGIN_SOURCES[@]}" -type f -newer "$PLUGIN_ZIP" 2>/dev/null | grep -q .; then
  NEED_PLUGIN=1
fi

NEED_WORKER=0
if [ ! -f "$WORKER_STAMP" ]; then
  NEED_WORKER=1
elif find "${WORKER_SOURCES[@]}" -type f -newer "$WORKER_STAMP" 2>/dev/null | grep -q .; then
  NEED_WORKER=1
fi

if [ "$NEED_PLUGIN" = "0" ] && [ "$NEED_WORKER" = "0" ]; then
  exit 0
fi

# --- 2. nvm を読み込んで Node / pnpm にパスを通す ---
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

# --- 3. .env の存在チェック ---
if [ ! -f "$REPO_ROOT/.env" ]; then
  printf '{"systemMessage": "⚠️ auto-deploy: .env が見つかりません。`cp .env.example .env` で作成してください。"}'
  exit 0
fi

MESSAGES=()
ANY_FAILED=0

# --- 4. Plugin デプロイ ---
if [ "$NEED_PLUGIN" = "1" ]; then
  PLUGIN_OUT=$(pnpm plugin:deploy 2>&1)
  PLUGIN_EXIT=$?
  if [ $PLUGIN_EXIT -eq 0 ]; then
    SUMMARY=$(echo "$PLUGIN_OUT" | grep -E "Plugin ID:|Target version:" | tr '\n' ' ' | sed 's/  */ /g')
    [ -z "$SUMMARY" ] && SUMMARY="installed"
    MESSAGES+=("🚀 Plugin: $SUMMARY")
  else
    ANY_FAILED=1
    LAST=$(echo "$PLUGIN_OUT" | tail -3 | tr '\n' ' ' | sed 's/  */ /g')
    MESSAGES+=("❌ Plugin failed (exit $PLUGIN_EXIT): $LAST")
  fi
fi

# --- 5. Worker デプロイ ---
if [ "$NEED_WORKER" = "1" ]; then
  WORKER_OUT=$(pnpm worker:deploy 2>&1)
  WORKER_EXIT=$?
  if [ $WORKER_EXIT -eq 0 ]; then
    # 末尾の Worker URL を拾う (deploy-worker.mjs が最後に URL を stdout する)
    WORKER_URL=$(echo "$WORKER_OUT" | tail -1)
    MESSAGES+=("☁️ Worker: $WORKER_URL")
    # stamp を更新 (次回以降の差分判定用)
    mkdir -p "$(dirname "$WORKER_STAMP")"
    touch "$WORKER_STAMP"
  else
    ANY_FAILED=1
    LAST=$(echo "$WORKER_OUT" | tail -3 | tr '\n' ' ' | sed 's/  */ /g')
    MESSAGES+=("❌ Worker failed (exit $WORKER_EXIT): $LAST")
  fi
fi

# --- 6. 通知 ---
if [ ${#MESSAGES[@]} -gt 0 ]; then
  COMBINED=$(printf '%s\n' "${MESSAGES[@]}" | tr '\n' ' ' | sed 's/  */ /g; s/ $//')
  if command -v jq >/dev/null 2>&1; then
    ESCAPED=$(printf '%s' "$COMBINED" | jq -Rs .)
    printf '{"systemMessage": %s}' "$ESCAPED"
  else
    # jq 無し fallback (ダブルクォートだけエスケープ)
    SAFE=$(printf '%s' "$COMBINED" | sed 's/"/\\"/g')
    printf '{"systemMessage": "%s"}' "$SAFE"
  fi
fi

[ $ANY_FAILED -eq 1 ] && exit 1
exit 0
