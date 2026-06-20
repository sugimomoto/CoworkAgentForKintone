#!/usr/bin/env bash
# PreToolUse フック (matcher: Bash)。
# `gh pr create` を検知し、packages/plugin / packages/kintone-mcp の変更に対して
# docs/ や packages/landing が未更新なら、モデル (= セッション内の Claude) に
# 非ブロッキングの docs-sync リマインドを additionalContext で注入する。
#
# 設計: 判定は決定的 (git diff のパス突合) のみ。実際の「docs/LP 更新が要るか」の
# 判断と編集は、リマインドを受け取った Claude がセッション文脈をもとに行う。
# ポリシー: .github/docs-sync-policy.md
#
# 失敗してもツールはブロックしない (exit 0 を徹底。exit 2 のみがブロック扱い)。

input=$(cat)

# jq 無し / git 外なら何もしない
command -v jq >/dev/null 2>&1 || exit 0

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# gh pr create を含む Bash コマンドのときだけ対象
case "$cmd" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

# 現在ブランチの main からの変更 (コミット済 + 未コミット + staged) を収集
base="origin/main"
git rev-parse --verify -q "$base" >/dev/null 2>&1 || base="main"
git rev-parse --verify -q "$base" >/dev/null 2>&1 || exit 0

changed=$(
  {
    git diff --name-only "$base"...HEAD 2>/dev/null
    git diff --name-only 2>/dev/null
    git diff --name-only --cached 2>/dev/null
  } | sort -u
)

code_changed=$(printf '%s\n' "$changed" | grep -E '^packages/(plugin|kintone-mcp)/' || true)
docs_changed=$(printf '%s\n' "$changed" | grep -E '^(docs/|packages/landing/)' || true)

# 機能コード変更あり かつ docs/landing 未更新 のときだけリマインド
if [ -n "$code_changed" ] && [ -z "$docs_changed" ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      additionalContext: "📝 docs-sync リマインド: この PR は packages/plugin または packages/kintone-mcp を変更していますが、docs/ ・ packages/landing は未更新です。.github/docs-sync-policy.md に照らして判断し、ユーザー向けの機能・設定・用語・制約の変更なら docs/LP を更新してこのブランチに push してください (リファクタ・chore・内部実装のみなら更新不要)。スクリーンショットは生成せず、必要なら PR コメントで「要スクショ更新」と指摘するに留めること。"
    }
  }'
fi

exit 0
