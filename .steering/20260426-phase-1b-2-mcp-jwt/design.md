# Phase 1b-2 (改訂) — Remote MCP + JWT Bearer 設計

要件: [requirements.md](./requirements.md)

## 1. 全体アーキテクチャ

### 1.1 コンポーネント

```
┌──────────────────────────────────────┐
│  kintone Plugin (browser)             │
│   - ConfigScreen (admin)              │
│   - ChatPanel / CredentialDialog      │
│   - useUserBinding                    │
└────┬───────────────────┬─────────────┘
     │ kintone.proxy      │ Anthropic API
     │ (MINT_API_KEY 注入)│ (X-Api-Key)
     ↓                    ↓
┌─────────────┐    ┌──────────────────┐
│ Worker /mint│    │  Anthropic API   │
│  (admin     │    │   /v1/vaults     │
│   deployed) │    │   /v1/sessions   │
└──────┬──────┘    │   ...            │
       │ JWT       └────┬─────────────┘
       │ 返却           │
       ↓                │ vault_ids        Bearer JWT
┌──────────────┐         │  ↓                ↓
│ Plugin       │─────→  Vault Credential ─→ Worker /mcp
│ /mcp         │                              ↓
└──────────────┘                          [kintone REST API]
```

### 1.2 信頼境界

| 主体 | 持つ秘密 | 触れる情報 |
|---|---|---|
| **kintone admin (人間)** | MINT_API_KEY (生成) / Anthropic API Key | 全部 |
| **Plugin (admin 画面)** | (なし、setProxyConfig 保管のみ) | 設定値 |
| **Plugin (end-user チャット)** | (なし) | 自分の kintone セッション + 自分の入力した password (一時的に in-memory) |
| **Cloudflare Worker** | JWT_HMAC_SECRET / MINT_API_KEY | 全 end-user の kintone creds (JWT 検証時のみ in-memory) |
| **Anthropic Vault** | JWT (= 暗号化保管) | JWT のみ。decrypt 不可 (write-only) |
| **Anthropic Environment** | (なし) | MCP リクエスト時に Vault から取得した JWT のみ (= Bearer header) |

`JWT_HMAC_SECRET` は **Worker 内のみ存在**。`MINT_API_KEY` は Plugin の setProxyConfig と
Worker secret の両方に同じ値が入る (admin の人手で同期)。

---

## 2. Cloudflare Worker (`packages/kintone-mcp/`)

### 2.1 ディレクトリ構成

```
packages/kintone-mcp/
├── README.md                      # Deploy 手順 (Deploy Button + wrangler)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── wrangler.toml                  # Worker 設定
├── src/
│   ├── index.ts                   # エントリ (router)
│   ├── mint.ts                    # POST /mint
│   ├── mcp.ts                     # POST /mcp (MCP HTTP transport)
│   ├── jwt.ts                     # HMAC-SHA256 sign/verify (Web Crypto)
│   ├── kintone.ts                 # kintone REST 呼出ヘルパ
│   └── tools/
│       ├── index.ts               # tool 定義の集約
│       ├── apps_list.ts
│       ├── apps_get.ts
│       ├── apps_get_schema.ts
│       └── records_get.ts
└── tests/
    ├── jwt.test.ts
    ├── mint.test.ts
    ├── mcp.test.ts
    └── tools/
        ├── apps.test.ts
        └── records.test.ts
```

### 2.2 wrangler.toml

```toml
name = "cowork-agent-kintone-mcp"
main = "src/index.ts"
compatibility_date = "2026-04-01"

# Cloudflare Deploy Button 用 (将来追加可)
# https://developers.cloudflare.com/workers/platform/deploy-buttons/

# secrets は wrangler secret put で別途登録:
#   - JWT_HMAC_SECRET
#   - MINT_API_KEY
```

### 2.3 エンドポイント仕様

#### `POST /mint`

**認証**: `Authorization: Bearer {MINT_API_KEY}`

**Request body** (JSON):
```json
{
  "kintone_domain": "tenant.cybozu.com",
  "kintone_login": "sato",
  "kintone_password": "p4ssw0rd"
}
```

**Response 200**:
```json
{ "jwt": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response 401**:
```json
{ "error": "invalid mint key" }
```

**JWT payload** (本 Phase の仕様):
```json
{
  "iss": "cowork-agent-for-kintone",
  "sub": "kintone-creds",
  "iat": 1735000000,
  "exp": 1742776000,
  "kintone": {
    "domain": "tenant.cybozu.com",
    "login": "sato",
    "password": "p4ssw0rd"
  }
}
```
- `exp` は 90 日 (TTL は constants で調整可)
- `kintone.password` は plain (Vault 暗号化保管前提)
- 将来 API トークン対応時は `kintone.api_token` を追加 + `auth_type` で分岐

#### `POST /mcp`

**認証**: `Authorization: Bearer {JWT}` (Anthropic Vault Credential が自動注入)

**MCP HTTP transport (JSON-RPC 2.0)**:

リクエスト:
```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
```

レスポンス:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "kintone_apps_list",
        "description": "List kintone apps",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}
```

`tools/call` リクエスト:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "kintone_records_get",
    "arguments": { "app_id": 42, "query": "status = \"open\"" }
  }
}
```

レスポンス:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      { "type": "text", "text": "{ \"records\": [...], \"totalCount\": \"5\" }" }
    ]
  }
}
```

エラー時は MCP 仕様の `error` オブジェクトを返す。

### 2.4 Tool 実装 (Phase 1b-2 — 読取系のみ、公式準拠)

[KintoneMCPServerReference スキル](../../.claude/skills/KintoneMCPServerReference/SKILL.md) 参照。
**ツール命名規約** は kintone 公式 MCP に揃え、`kintone-<verb>-<noun>` (kebab-case) を使う。

| name | 概要 | input |
|---|---|---|
| `kintone-get-apps` | アプリ一覧 (API トークン認証時は除外) | `name?`, `ids?[]`, `codes?[]`, `spaceIds?[]`, `limit?`, `offset?` |
| `kintone-get-app` | 単一アプリ詳細 | `app` (string) |
| `kintone-get-form-fields` | フィールド定義 | `app`, `lang?`, `preview?` |
| `kintone-get-records` | レコード取得 (構造化フィルタ + 内部クエリ生成) | `app`, `filters?`, `fields?[]`, `orderBy?`, `limit?`, `offset?` |

**書込系 (add/update/delete) は Phase 1c に持ち越し**。

**カーソル全件取得 (`iter_all`) は Phase 1b-2 ではスコープ外**。
Agent 側で `kintone-get-records` をループ呼出する想定 (`limit` + `offset` で対応)。

#### 構造化フィルタ (`kintone-get-records`)

公式 MCP の get-records をそのまま踏襲し、kintone のクエリ言語ではなく **構造化フィルタ JSON** を入力として受け、Worker 内部で kintone クエリ文字列を組立てる。

```ts
filters?: {
  textContains?: { field: string; value: string }[];      // like
  equals?: { field: string; value: string | number }[];   // =
  dateRange?: { field: string; from?: string; to?: string }[];   // >= / <=
  numberRange?: { field: string; min?: number; max?: number }[]; // >= / <=
  inValues?: { field: string; values: string[] }[];      // in (...)
  notInValues?: { field: string; values: string[] }[];   // not in (...)
};
orderBy?: { field: string; order?: 'asc' | 'desc' }[];
fields?: string[];
limit?: number;     // 1-500
offset?: number;
```

- 全フィルタ条件は **AND 結合のみ** (OR 未対応、description で明記)
- 各フィルタタイプの description で kintone field type をリスト化 (公式準拠)

#### Tool 命名対応 (公式 → 我々)

| 公式 MCP ツール名 (流用) | 用途 |
|---|---|
| `kintone-get-apps` | アプリ一覧 |
| `kintone-get-app` | 単一アプリ |
| `kintone-get-form-fields` | フィールド schema (= 旧名 `apps_get_schema`) |
| `kintone-get-records` | 構造化フィルタ + records 取得 |

#### 認証種別ごとのツール除外

公式に倣い、API トークン認証時は以下を `tools/list` レスポンスから除外:
- `kintone-get-apps` (kintone API 制約: API トークンではアプリ一覧取得不可)
- `kintone-add-app` (Phase 1c 以降に追加した時点で適用)

JWT payload の `kintone.auth_type` で分岐する。

#### Tool 戻り値フォーマット

公式 MCP に揃え、MCP `CallToolResult` 形式で返す:

```ts
{
  structuredContent: { records: [...], totalCount: "5" },
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
}
```

- `structuredContent`: 構造化データ (clients が programmatic に処理可能)
- `content[].text`: human-readable JSON dump (Agent への自然言語応答に使われる)

### 2.5 JWT 実装 (`src/jwt.ts`)

```ts
import { encodeBase64Url, decodeBase64Url } from './base64';

export async function signJwt(payload: object, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = (obj: object) =>
    encodeBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${encodeBase64Url(new Uint8Array(sig))}`;
}

export async function verifyJwt<T>(jwt: string, secret: string): Promise<T> {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('malformed jwt');
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(s!),
    new TextEncoder().encode(data),
  );
  if (!valid) throw new Error('invalid signature');
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(p!)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token expired');
  }
  return payload as T;
}
```

依存ライブラリ無し (Web Crypto API 利用)。

### 2.6 kintone 呼出 (`src/kintone.ts`)

公式 MCP は `@kintone/rest-api-client` (Node 公式 SDK) を使うが、**Cloudflare Workers では
Node 依存が動かない可能性大** のため、Web Crypto + 標準 `fetch` で自前実装する。
Phase 1b-1 で書いた Python helper の TypeScript 版に相当 (基本的な HTTP 取り回し + 例外変換)。



```ts
export interface KintoneCreds {
  domain: string;
  login: string;
  password: string;
}

export async function kintoneRequest(
  creds: KintoneCreds,
  method: 'GET' | 'POST',
  path: string,
  options: { params?: Record<string, unknown>; body?: unknown } = {},
): Promise<unknown> {
  const url = new URL(`https://${creds.domain}${path}`);
  for (const [k, v] of Object.entries(options.params ?? {})) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    'X-Cybozu-Authorization': btoa(`${creds.login}:${creds.password}`),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`kintone ${res.status}: ${await res.text()}`);
  return res.json();
}
```

(GET 時に Content-Type を付けない。Phase 1b-1 で踏んだ罠を回避。)

### 2.7 ツール定義パターン (`createTool`)

公式 MCP の `factory.ts` (`createTool(name, config, callback)`) を踏襲:

```ts
// src/tools/index.ts
import { createTool } from './factory';
export const getRecords = createTool(
  'kintone-get-records',
  {
    title: 'Get Records',
    description: 'Get multiple records from a kintone app with structured filtering. ...',
    inputSchema,    // Zod raw shape
    outputSchema,
  },
  async (args, { creds }) => {
    const query = buildQueryFromFilters(args.filters, args.orderBy, args.limit, args.offset);
    const res = await kintoneRequest(creds, 'GET', '/k/v1/records.json', {
      params: { app: args.app, query, fields: args.fields, totalCount: true },
    });
    const result = { records: res.records, totalCount: res.totalCount };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

export const tools = [getRecords, getApps, getApp, getFormFields] as const;
```

- input schema フィールドはすべて `.describe()` で詳細説明 (Agent 向けドキュメント)
- description には **「先に kintone-get-form-fields を呼べ」のような連鎖誘導** を含める
- `auth_type` 別の除外は `server.ts` 側で `shouldEnableTool(name, { isApiTokenAuth })` でフィルタ

### 2.8 router (`src/index.ts`)

```ts
import { handleMint } from './mint';
import { handleMcp } from './mcp';

export interface Env {
  JWT_HMAC_SECRET: string;
  MINT_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/mint') {
      return handleMint(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/mcp') {
      return handleMcp(request, env);
    }
    return new Response('Not Found', { status: 404 });
  },
};
```

### 2.8 テスト戦略 (vitest + miniflare)

- `jwt.test.ts`: 署名・検証 (正常系 + tamper detection + exp 切れ)
- `mint.test.ts`: MINT_API_KEY 検証 + JWT 生成 + 不正リクエスト
- `mcp.test.ts`: JSON-RPC parse / tools/list / tools/call dispatch / JWT 検証失敗
- `tools/apps.test.ts`: kintone API モック (`vi.fn()` で fetch を置換) + 期待 URL/headers 確認
- `tools/records.test.ts`: 同上、query / fields / total_count 確認

---

## 3. Plugin 側

### 3.1 ConfigScreen 拡張 (admin 画面)

新規入力項目:
- **MCP Worker URL** (text): `https://cowork-agent-kintone-mcp.<your-account>.workers.dev`
  - 通常 setConfig で保存
- **MCP MINT_API_KEY** (password type, write-only)
  - **setProxyConfig** で `${WORKER_URL}/mint` 宛 POST の Authorization Bearer ヘッダに登録
  - end-user JS / `getConfig` / `getProxyConfig` で読出不可
  - 表示時は常に空 (`••••••` 等プレースホルダのみ)
- **MCP `/mcp` URL は別途記録しない** — `${WORKER_URL}/mcp` で導出

UI 配置:
```
[既存] Anthropic API Key (placeholder: sk-ant-...)
─────────────────────────────────
[新規] kintone MCP (Cloudflare Workers)
  Worker URL:        https://cowork-agent-kintone-mcp.xxx.workers.dev
  MINT_API_KEY:      ●●●●●●●●●● (再入力で更新)
  [保存] [キャンセル]
```

保存ロジック (擬似コード):
```ts
// 値の検証
if (!isHttpsUrl(workerUrl)) showError('URL must be https');
// 通常 config に Worker URL のみ保存 (end-user が getConfig で読める = OK)
kintone.plugin.app.setConfig({ ...existing, workerUrl });
// MINT_API_KEY は setProxyConfig で kintone runtime に隠蔽保管
kintone.plugin.app.setProxyConfig(
  `${workerUrl}/mint`,
  'POST',
  { Authorization: `Bearer ${mintApiKey}` },
  {},
);
// 既存 Anthropic API Key の setProxyConfig 登録は触らない
```

### 3.2 chatStore 拡張

```ts
interface ChatState {
  // 既存
  vaultId: string | null;
  // 旧 userEnvironmentId は廃止 (Environment 側を変えないため)
  credentialId: string | null;   // 新規
  bindingStatus: BindingStatus;
  bindingError: string | null;
  ...
}
```

### 3.3 resources.ts 拡張 (Vault Credential API)

```ts
// 型 (types.ts に追加)
export type VaultAuth =
  | {
      type: 'static_bearer';
      mcp_server_url: string;
      token?: string;     // create 時のみ。レスポンスでは返らない (write-only)
    }
  | {
      type: 'mcp_oauth';
      // 本 Phase では未使用。将来用にプレースホルダ
      mcp_server_url: string;
      access_token?: string;
      // ...
    };

export interface VaultCredential {
  type: 'credential';
  id: string;
  vault_id: string;
  display_name: string;
  auth: VaultAuth;          // token / access_token は write-only なので返らない
  metadata?: ManagedAgentsMetadata;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

// 関数
export function listVaultCredentials(vaultId: string): Promise<ListResponse<VaultCredential>>;
export function createVaultCredential(vaultId: string, body: {
  display_name: string;
  auth: VaultAuth;
  metadata?: ManagedAgentsMetadata;
}): Promise<VaultCredential>;
export function updateVaultCredential(vaultId: string, credentialId: string, body: {
  auth?: Partial<VaultAuth>;
  display_name?: string;
}): Promise<VaultCredential>;
export function archiveVaultCredential(vaultId: string, credentialId: string): Promise<void>;
```

旧 `setVaultKeys` は **削除** する。

### 3.4 mintClient (`src/core/mcp/mintClient.ts`)

新規ファイル。kintone proxy 経由で Worker /mint を叩く。

```ts
import { getProxyTransport } from '../kintone/proxyTransport';

export interface MintRequest {
  workerUrl: string;
  kintone_domain: string;
  kintone_login: string;
  kintone_password: string;
}

/**
 * Worker /mint エンドポイントを kintone proxy 経由で呼出し JWT を取得する。
 * MINT_API_KEY は kintone.plugin.app.setProxyConfig 登録済みヘッダから自動注入される。
 */
export async function mintKintoneJwt(req: MintRequest): Promise<string> {
  const proxy = getProxyTransport();
  const url = `${req.workerUrl.replace(/\/$/, '')}/mint`;
  const res = await proxy(url, 'POST', /* additional headers */ {}, {
    kintone_domain: req.kintone_domain,
    kintone_login: req.kintone_login,
    kintone_password: req.kintone_password,
  });
  if (!res || typeof res !== 'object' || typeof (res as { jwt?: unknown }).jwt !== 'string') {
    throw new Error('mint endpoint returned invalid response');
  }
  return (res as { jwt: string }).jwt;
}
```

(`getProxyTransport` は Phase 1a の `proxyTransport.ts` パターンを再利用。実装に応じて signature 調整)

### 3.5 useUserBinding 改修

旧版の bind() を以下に置換:

```ts
const bind = useCallback(
  async (values: { login: string; password: string }) => {
    if (!agentId) throw new Error('Agent が解決されていません');
    if (inFlightBindRef.current) return inFlightBindRef.current;

    const p = (async () => {
      try {
        setBindingStatus('binding');
        const kctx = getCurrentSessionContext();      // domain は自動取得
        const workerUrl = await getWorkerUrl();        // setConfig から取得

        // 1. Worker /mint で JWT を取得
        const jwt = await mintKintoneJwt({
          workerUrl,
          kintone_domain: kctx.kintoneDomain,
          kintone_login: values.login,
          kintone_password: values.password,
        });

        // 2. user 用 Vault を解決
        const vault = await resolveUserVault({
          kintoneDomain: kctx.kintoneDomain,
          kintoneUserCode: kctx.kintoneUserCode,
        });

        // 3. Vault Credential を作成 (or 更新)
        const existing = await findExistingCredential(vault.id, `${workerUrl}/mcp`);
        const credential = existing
          ? await updateVaultCredential(vault.id, existing.id, {
              auth: { type: 'static_bearer', mcp_server_url: `${workerUrl}/mcp`, token: jwt },
            })
          : await createVaultCredential(vault.id, {
              display_name: `kintone (${kctx.kintoneUserCode}@${kctx.kintoneDomain})`,
              auth: {
                type: 'static_bearer',
                mcp_server_url: `${workerUrl}/mcp`,
                token: jwt,
              },
            });

        setVaultId(vault.id);
        setCredentialId(credential.id);
        setBindingStatus('bound');
      } catch (err) {
        setBindingStatus('error', err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        inFlightBindRef.current = null;
      }
    })();
    inFlightBindRef.current = p;
    return p;
  },
  [agentId, ...],
);
```

`findExistingCredential` は `listVaultCredentials(vault.id)` で `mcp_server_url` 一致のものを探すヘルパ。

### 3.6 CredentialDialog の修正

```tsx
export function CredentialDialog({ open, onSubmit, onClose }) {
  // domain は kintone JS API から自動取得 (read-only display)
  const domain = useMemo(() => {
    try {
      return getCurrentSessionContext().kintoneDomain;
    } catch {
      return '';
    }
  }, []);
  const initialLogin = useMemo(() => {
    try {
      return getCurrentSessionContext().kintoneUserCode;
    } catch {
      return '';
    }
  }, []);

  const [login, setLogin] = useState(initialLogin);
  const [password, setPassword] = useState('');
  ...
}
```

`onSubmit({ login, password })` のみ。domain は dialog 内で参照しないので不要。

### 3.7 Session 作成時の vault_ids 注入

旧 Phase 1b-2 で実装済の `createUserSession({ ..., vaultId })` を流用。
ただし呼び出し側では `useChatStore.getState().vaultId` を見て、bound 状態なら付ける。

```ts
// useSession.ts ensureSession
const useUserVault =
  state.bindingStatus === 'bound' && state.vaultId !== null && state.credentialId !== null;
const vaultId = useUserVault ? state.vaultId! : undefined;

const session = await createUserSession({
  agentId: ctx.agentId,
  environmentId: ctx.environmentId,        // bootstrap Env のままで OK
  kintoneDomain: ctx.kintoneDomain,
  kintoneUserCode: ctx.kintoneUserCode,
  ...(vaultId ? { vaultId } : {}),
});
```

### 3.8 Agent への MCP server 登録

**未確定**。Anthropic Managed Agents の Agent / Environment に MCP server を登録する API
仕様は実装時に検証する必要がある。仮設計:

- 候補 A: Agent の `tools` 配列に追加
  ```json
  {
    "type": "mcp",
    "url": "https://...workers.dev/mcp",
    "name": "kintone-mcp"
  }
  ```
- 候補 B: Environment の networking config に MCP server URL を含める
  ```json
  "networking": {
    "type": "limited",
    "allow_mcp_servers": true,
    "mcp_servers": [{ "url": "..." }]
  }
  ```

実装時に skill docs / 実 API レスポンスで確定。**Default Agent 作成時** (`resolveDefaultAgent.ts`) または **Session 作成時** (`createUserSession`) のどちらかで設定する。

→ Phase 1b-2 のタスクとして「実 API で動作確認しながら適切な場所に注入」と TODO を残す。

### 3.9 旧 Phase 1b-2 コードの扱い

| ファイル | 処置 |
|---|---|
| `core/bootstrap/resolveVault.ts` | **保持** (Vault 解決ロジック)。`setVaultCredentials` は削除して `createVaultCredential` の利用に置換 |
| `core/bootstrap/ensureEnvironment.ts` | **削除** |
| `core/bootstrap/ensureEnvironment.test.ts` | **削除** |
| `core/bootstrap/resolveVault.test.ts` | 一部書換 (setVaultCredentials → createVaultCredential mock) |
| `core/managed-agents/resources.ts` の `setVaultKeys` | **削除** |
| `desktop/hooks/useUserBinding.ts` | **大改修** (上記 3.5) |
| `desktop/components/CredentialDialog.tsx` | **小改修** (3.6) |
| `desktop/ChatPanel.tsx` | binding ステータス参照は変えない |
| `store/chatStore.ts` | `userEnvironmentId` 削除、`credentialId` 追加 |

旧 Phase 1b-2 で作成済の Anthropic 上の Vault / Environment は **手動で archive** することを README で促す (alpha 段階の手作業)。

---

## 4. テスト戦略

### 4.1 Worker (vitest + miniflare)
- `jwt.test.ts` (10+ tests)
- `mint.test.ts` (5+ tests)
- `mcp.test.ts` (10+ tests, JSON-RPC parse + dispatch)
- `tools/*.test.ts` (各 tool ごと 3-5 tests)
- 期待カバレッジ: 90%+

### 4.2 Plugin (既存 vitest)
- `resources.test.ts` 拡張 (`createVaultCredential` / `update` / `archive` の 3 関数)
- `resolveVault.test.ts` 改修 (`setVaultCredentials` 削除、`findExistingCredential` ヘルパ追加)
- `useUserBinding.test.ts` 改修 (mintKintoneJwt + createVaultCredential のフロー)
- `CredentialDialog.test.tsx` 改修 (domain auto / login pre-fill)
- `ConfigScreen.test.tsx` 拡張 (Worker URL / MINT_API_KEY 入力 + setProxyConfig 登録呼出)

### 4.3 E2E (Plugin)
- `e2e/credential-bind.setup.ts` を JWT-based に書直し
- `e2e/credential-binding.spec.ts` 新規 (実 Worker は不要、mock サーバ等を使う or 環境変数で skip)
- 既存 16 件は破壊しない

---

## 5. 段階的な実装順序 (TDD)

| # | 作業 | ライセンス |
|---|---|---|
| 1 | Worker 雛形作成 (`packages/kintone-mcp/` 初期化、tsconfig / vitest / wrangler.toml) | ⬜ |
| 2 | `jwt.ts` 実装 + テスト | 🟥 → 🟩 |
| 3 | `kintone.ts` 実装 + テスト (fetch モック) | 🟥 → 🟩 |
| 4 | `mint.ts` (`/mint` ハンドラ) 実装 + テスト | 🟥 → 🟩 |
| 5 | `tools/*.ts` 実装 + テスト (apps_list, apps_get, apps_get_schema, records_get) | 🟥 → 🟩 |
| 6 | `mcp.ts` (`/mcp` JSON-RPC ハンドラ) 実装 + テスト | 🟥 → 🟩 |
| 7 | `index.ts` (router) 実装 | 🟩 |
| 8 | `wrangler dev` でローカル起動確認 + curl での疎通テスト | ⬜ |
| 9 | Plugin 側: types / resources の Vault Credential API 拡張 + テスト | 🟥 → 🟩 |
| 10 | Plugin 側: `mintClient.ts` + テスト | 🟥 → 🟩 |
| 11 | Plugin 側: `useUserBinding` 改修 + テスト | 🟥 → 🟩 |
| 12 | Plugin 側: `CredentialDialog` 微修正 + テスト | 🟥 → 🟩 |
| 13 | Plugin 側: `ConfigScreen` 拡張 (Worker URL / MINT_API_KEY) + テスト | 🟥 → 🟩 |
| 14 | Plugin 側: `chatStore` 改修 (`credentialId`) + テスト | 🟥 → 🟩 |
| 15 | Plugin 側: `useSession` で `vault_ids` 注入 + テスト | 🟥 → 🟩 |
| 16 | Worker を Cloudflare に deploy (admin 作業 + 動作確認) | ⬜ |
| 17 | Plugin デプロイ + 実環境バインドフロー動作確認 | ⬜ |
| 18 | 既存 E2E のリグレッション確認 + 新規 E2E 追加 | 🟥 → 🟩 |
| 19 | Agent への MCP server 登録 API を実 API で確認 → 適切な場所に組込 | 🟥 → 🟩 |
| 20 | 旧 Phase 1b-2 残骸の cleanup (delete files / archive 済を確認) | 🔵 |

---

## 6. リスク・未確定事項

| リスク | 対応 |
|---|---|
| Anthropic Vault Credential API の正確な request/response shape | 実装時に curl で 1 度叩いて確認、必要なら types/resources を調整 |
| Agent / Environment の MCP server 登録 API | step 19 で実検証。必要なら Phase 1b-2 のサブ Phase として再ステアリング |
| Cloudflare Worker の MCP HTTP transport が Anthropic 側と互換か | step 16 で疎通確認。互換性あれば最小実装で OK |
| MINT_API_KEY を setProxyConfig 経由で送れるか (kintone proxy が任意ドメインを許容) | kintone proxy は URL 完全一致必須。Worker URL を毎回完全一致で登録する必要あり |
| Worker が cold start 含めて応答時間 (Anthropic 側のタイムアウト) | Cloudflare Workers は cold start 0ms。問題なし |
| JWT 漏洩時の影響 | `exp` 90 日 + ローテーションで対処。緊急時は Vault Credential archive で即無効化 |
| Anthropic API 経由で他 user の Credential を `vault_ids` 指定して使えてしまう | alpha 段階の trust 前提として明示。将来は per-user API key 等で隔離 |

---

## 7. 完了の定義

- requirements.md AC-1〜9 + NFR-1〜6 を満たす
- Worker の単体テスト全緑
- Plugin の単体テスト全緑 (新規 + 既存)
- 既存 E2E 16 件 + 新規 credential-binding spec 緑
- 実環境動作確認: admin が Worker deploy → Plugin 設定 → end-user 初回送信 → CredentialDialog → 登録 → kintone tool 呼出が成功
- 旧 Phase 1b-2 の残骸コードが削除済 (or 流用部分は明示)
