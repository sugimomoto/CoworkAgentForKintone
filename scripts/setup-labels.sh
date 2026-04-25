#!/usr/bin/env bash
# setup-labels.sh — GitHub Issues のラベル定義を .github/labels.yml と同期
#
# 前提:
#   - gh CLI がインストール済み (https://cli.github.com)
#   - gh auth login 完了
#
# 使い方:
#   bash scripts/setup-labels.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABELS_FILE="$REPO_ROOT/.github/labels.yml"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI が見つかりません。https://cli.github.com からインストールしてください。" >&2
  exit 1
fi

if [ ! -f "$LABELS_FILE" ]; then
  echo "Error: $LABELS_FILE が見つかりません。" >&2
  exit 1
fi

# YAML を簡易パース (name / color / description のセット)
python3 - <<'PY' "$LABELS_FILE"
import sys, re, subprocess

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

# 簡易 YAML パーサ (この用途に十分)
labels = []
current = None
for line in text.splitlines():
    line = line.rstrip()
    if not line or line.startswith("#"):
        continue
    m = re.match(r"^- name:\s*\"([^\"]+)\"$", line)
    if m:
        if current:
            labels.append(current)
        current = {"name": m.group(1)}
        continue
    m = re.match(r"^\s+(\w+):\s*\"([^\"]*)\"$", line)
    if m and current:
        current[m.group(1)] = m.group(2)
if current:
    labels.append(current)

print(f"[setup-labels] {len(labels)} 個のラベルを同期します")
for lbl in labels:
    name = lbl["name"]
    color = lbl.get("color", "ededed")
    desc = lbl.get("description", "")
    cmd = ["gh", "label", "create", name, "--color", color, "--description", desc, "--force"]
    print(f"  - {name} (#{color})")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"    ERROR: {r.stderr.strip()}", file=sys.stderr)

print("[setup-labels] 完了")
PY
