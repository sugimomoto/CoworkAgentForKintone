# @cowork-agent/kintone-mcp

Cowork Agent for kintone の **Remote MCP Server** (Cloudflare Workers ホスト)。

Anthropic Managed Agents から MCP プロトコル経由で kintone REST API を呼ぶための
ブリッジ。kintone 認証情報は Plugin が JWT に詰めて Anthropic Vault Credential に
保管し、Anthropic がランタイムで Bearer トークンとして注入する。

## アーキテクチャ

```
[kintone Plugin (browser, admin/end-user)]
       ↓ kintone proxy 経由   POST /mint  (Bearer: MINT_API_KEY)
[Cloudflare Worker]
       JWT_HMAC_SECRET で署名
       ↓ JWT を返却
[Plugin] → Anthropic Vault に Credential 登録 (token=JWT, mcp_server_url=/mcp)
       ↓
[Anthropic Agent (実行時)]
       ↓ POST /mcp (Bearer: JWT)
[Cloudflare Worker]
       JWT 検証 → kintone API 呼出
```

## 必要環境

- Cloudflare アカウント (無料 plan で OK)
- `wrangler` CLI: `npm install -g wrangler` または `pnpm add -g wrangler`

## デプロイ手順 (admin 作業)

### 1. ログイン
```bash
wrangler login
```

### 2. 秘密鍵を生成して Worker secret として登録
```bash
# JWT 署名鍵 (Worker 内部のみ。ユーザーや Plugin には伝えない)
openssl rand -hex 32 | wrangler secret put JWT_HMAC_SECRET

# Plugin → Worker /mint 認証鍵 (Plugin 設定画面にも同じ値を入力する)
MINT_API_KEY=$(openssl rand -hex 32)
echo "$MINT_API_KEY" | wrangler secret put MINT_API_KEY
echo "👉 この値を Plugin 設定画面の MINT_API_KEY 欄にも貼り付けてください: $MINT_API_KEY"
```

### 3. デプロイ
```bash
pnpm install
wrangler deploy
```

完了すると `https://cowork-agent-kintone-mcp.<your-account>.workers.dev` のような
URL が表示される。Plugin 設定画面の `Worker URL` 欄に貼り付ける。

## ローカル開発

```bash
# .dev.vars ファイルを作成 (gitignore 済)
cat > .dev.vars <<EOF
JWT_HMAC_SECRET=$(openssl rand -hex 32)
MINT_API_KEY=$(openssl rand -hex 32)
EOF

# ローカルサーバ起動
pnpm dev

# 別ターミナルで疎通テスト
curl -X POST http://localhost:8787/mint \\
  -H "Authorization: Bearer $(grep MINT_API_KEY .dev.vars | cut -d= -f2)" \\
  -H "Content-Type: application/json" \\
  -d '{"kintone_domain":"example.cybozu.com","kintone_login":"alice","kintone_password":"p"}'
```

## テスト

```bash
pnpm test
```

## 提供ツール (Phase 1b-2 — 読取のみ)

- `kintone-get-apps` — アプリ一覧 (API トークン認証では除外)
- `kintone-get-app` — 単一アプリ詳細
- `kintone-get-form-fields` — フィールド schema
- `kintone-get-records` — レコード取得 (構造化フィルタ対応)

書込系 (`add-records` / `update-records` 等) は Phase 1c で追加予定。

## ライセンス

MIT
