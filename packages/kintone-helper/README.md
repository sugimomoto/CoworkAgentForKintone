# cowork-agent-kintone

[Cowork Agent for kintone](https://github.com/sugimomoto/CoworkAgentForKintone) の Managed Agents
Environment 上で動作する **kintone REST API ヘルパーライブラリ**。

> ⚠️ Alpha 版です。読取系 API のみ実装しています (Phase 1c で書込・一括 API を追加予定)。

## インストール

```bash
pip install cowork-agent-kintone
```

> 当面は GitHub Release 添付の wheel から `pip install <url>` で取得します
> (PyPI 公開は 1.0 安定版で予定)。

## Quick Start

```python
import os
from cowork_agent_kintone import Client

# 環境変数 KINTONE_DOMAIN / KINTONE_LOGIN / KINTONE_PASSWORD から自動取得
c = Client()

# アプリ一覧
apps = c.apps.list(name="顧客")
for app in apps:
    print(app["appId"], app["name"])

# 単一アプリ
app = c.apps.get(42)

# フィールド schema
schema = c.apps.get_schema(42)

# レコード 1 ページ取得 (最大 500 件)
res = c.records.get(42, query='created_time > "2026-01-01"', fields=["title", "owner"])
print(res["records"])

# 全件取得 (cursor 利用、10,000 件超対応)
for record in c.records.iter_all(42, query='status = "open"'):
    print(record["$id"]["value"])
```

## サポート

- Python 3.11+
- Basic 認証のみ (API トークン非対応)

## ライセンス

MIT
