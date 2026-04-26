#!/usr/bin/env node
/* eslint-disable no-console */
// kintone OAuth + Anthropic Vault Credential (mcp_oauth) のエンドツーエンド検証スクリプト。
//
// フロー:
//   1. PKCE (S256) で code_verifier / code_challenge を生成
//   2. Authorization URL を組み立てて表示 → ユーザーがブラウザで開いて承認
//   3. Worker /oauth/callback に code が届く → ユーザーが画面の code をコピーして貼り付け
//   4. 自分で /oauth2/token と交換 (client_secret_basic, PKCE code_verifier 付き)
//   5. Anthropic Vault → Vault Credential (mcp_oauth + refresh) を作成
//   6. Agent (mcp_servers で Worker /mcp を登録、vault_id 紐付け) + Session 作成
//   7. user.message を送信 → SSE を読み tool_use と tool_result を観察
//
// 検証完了後は cleanup として agent / vault を archive する。
//
// 使い方:
//   node scripts/verify-mcp-oauth.mjs
//
// 必要な .env キー:
//   ANTHROPIC_API_KEY
//   KINTONE_BASE_URL                    (例: https://2kzzfr8gc3l6.cybozu.com)
//   KINTONE_OAUTH_CLIENT_ID
//   KINTONE_OAUTH_CLIENT_SECRET
//   KINTONE_OAUTH_AUTHORIZATION_URL     (例: https://<sub>.cybozu.com/oauth2/authorization)
//   KINTONE_OAUTH_TOKEN_URL             (例: https://<sub>.cybozu.com/oauth2/token)

import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// .env を読み込む (シンプルなパーサ、quotes は外す)
function loadDotenv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf-8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadDotenv();

const REDIRECT_URI = 'https://cowork-agent-kintone-mcp.sugimomoto.workers.dev/oauth/callback';
const MCP_SERVER_URL = 'https://cowork-agent-kintone-mcp.sugimomoto.workers.dev/mcp';

const required = [
  'ANTHROPIC_API_KEY',
  'KINTONE_BASE_URL',
  'KINTONE_OAUTH_CLIENT_ID',
  'KINTONE_OAUTH_CLIENT_SECRET',
  'KINTONE_OAUTH_AUTHORIZATION_URL',
  'KINTONE_OAUTH_TOKEN_URL',
];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[fatal] missing env: ${k}`);
    process.exit(1);
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ---------- PKCE & state ----------

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const codeVerifier = base64url(crypto.randomBytes(32));
const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
const state = base64url(crypto.randomBytes(16));

// ---------- helpers ----------

const ANTH_HEADERS = {
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'managed-agents-2026-04-01',
  'X-Api-Key': ANTHROPIC_API_KEY,
};

async function anthropic(method, path, body) {
  const res = await fetch(`https://api.anthropic.com${path}`, {
    method,
    headers: ANTH_HEADERS,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic ${method} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function ask(prompt) {
  const rl = readline.createInterface({ input, output });
  const ans = await rl.question(prompt);
  rl.close();
  return ans.trim();
}

function dump(label, obj) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

// ---------- main ----------

async function main() {
  // --- Step 1: Authorization URL を組み立て表示 ---
  const scope =
    process.env.KINTONE_OAUTH_SCOPE ??
    'k:app_record:read k:app_record:write k:app_settings:read k:file:read';
  const authUrl = new URL(process.env.KINTONE_OAUTH_AUTHORIZATION_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.KINTONE_OAUTH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('--- STEP 1: Open this URL in your browser and approve ---\n');
  console.log(authUrl.toString());
  console.log(`\n(state=${state})\n`);

  const code = await ask('--- STEP 2: paste the code from /oauth/callback page > ');
  if (!code) {
    console.error('code is empty');
    process.exit(1);
  }

  // --- Step 3: cybozu /oauth2/token と交換 (client_secret_basic + PKCE code_verifier) ---
  const basicAuth = Buffer.from(
    `${process.env.KINTONE_OAUTH_CLIENT_ID}:${process.env.KINTONE_OAUTH_CLIENT_SECRET}`,
  ).toString('base64');

  const tokenForm = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch(process.env.KINTONE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: tokenForm,
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    console.error(`token endpoint ${tokenRes.status}: ${tokenText}`);
    process.exit(1);
  }
  const tokens = JSON.parse(tokenText);
  // 出力するが access_token は短縮表示
  const masked = {
    ...tokens,
    access_token: tokens.access_token ? `${tokens.access_token.slice(0, 8)}... (len=${tokens.access_token.length})` : null,
    refresh_token: tokens.refresh_token ? `${tokens.refresh_token.slice(0, 8)}... (len=${tokens.refresh_token.length})` : null,
  };
  dump('TOKEN exchange OK', masked);

  if (!tokens.access_token) {
    console.error('no access_token returned');
    process.exit(1);
  }

  // --- Step 4: Vault + Vault Credential 作成 ---
  const vault = await anthropic('POST', '/v1/vaults', {
    display_name: 'kintone OAuth verification',
  });
  dump('Vault created', { id: vault.id });

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : undefined;

  const credBody = {
    auth: {
      type: 'mcp_oauth',
      mcp_server_url: MCP_SERVER_URL,
      access_token: tokens.access_token,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      ...(tokens.refresh_token
        ? {
            refresh: {
              refresh_token: tokens.refresh_token,
              token_endpoint: process.env.KINTONE_OAUTH_TOKEN_URL,
              client_id: process.env.KINTONE_OAUTH_CLIENT_ID,
              token_endpoint_auth: {
                type: 'client_secret_basic',
                client_secret: process.env.KINTONE_OAUTH_CLIENT_SECRET,
              },
              scope,
            },
          }
        : {}),
    },
    display_name: 'kintone',
  };
  const credential = await anthropic('POST', `/v1/vaults/${vault.id}/credentials`, credBody);
  dump('Credential created', credential);

  // --- Step 5: Environment + Agent + Session ---
  // Vault credential は mcp_server_url で agent.mcp_servers[].url とマッチングされる。
  const env = await anthropic('POST', '/v1/environments', {
    name: 'kintone OAuth verification env',
    config: {
      type: 'cloud',
      networking: {
        type: 'limited',
        allow_mcp_servers: true,
        allowed_hosts: ['cowork-agent-kintone-mcp.sugimomoto.workers.dev'],
      },
    },
  });
  dump('Environment created', { id: env.id });

  const agent = await anthropic('POST', '/v1/agents', {
    model: 'claude-sonnet-4-6',
    name: 'kintone OAuth verification agent',
    system:
      'You are testing the Cowork Agent for kintone Remote MCP server. ' +
      'When the user asks for kintone apps, call the kintone-get-apps tool with no arguments and return the result.',
    mcp_servers: [
      {
        type: 'url',
        name: 'kintone',
        url: MCP_SERVER_URL,
      },
    ],
    tools: [
      {
        type: 'mcp_toolset',
        mcp_server_name: 'kintone',
        default_config: { enabled: true, permission_policy: { type: 'always_allow' } },
      },
    ],
  });
  dump('Agent created', { id: agent.id });

  const session = await anthropic('POST', '/v1/sessions', {
    agent: agent.id,
    environment_id: env.id,
    vault_ids: [vault.id],
  });
  dump('Session created', { id: session.id });

  // --- Step 6: メッセージ送信 + SSE 監視 ---
  await anthropic('POST', `/v1/sessions/${session.id}/events`, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: 'kintone のアプリ一覧を取得して、最初の3件の名前と ID を教えて。' }],
      },
    ],
  });
  console.log('\n--- user.message sent, streaming events ---\n');

  const sseRes = await fetch(`https://api.anthropic.com/v1/sessions/${session.id}/events/stream`, {
    headers: { ...ANTH_HEADERS, Accept: 'text/event-stream' },
  });
  if (!sseRes.ok) {
    const t = await sseRes.text();
    throw new Error(`SSE ${sseRes.status}: ${t}`);
  }
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;
  const startedAt = Date.now();
  while (!done) {
    const { value, done: d } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      const t = event.type;
      const summary = (() => {
        if (t === 'agent.message')
          return `[agent.message] ${JSON.stringify(event.content).slice(0, 300)}`;
        if (t === 'agent.tool_use' || t === 'agent.mcp_tool_use' || t === 'agent.custom_tool_use')
          return `[${t}] name=${event.name ?? event.tool_name ?? '?'} input=${JSON.stringify(event.input ?? {}).slice(0, 200)}`;
        if (t === 'tool_result' || t === 'agent.tool_result' || t === 'mcp_tool_result')
          return `[${t}] ${JSON.stringify(event).slice(0, 400)}`;
        if (t === 'session.status_idle')
          return `[idle] stop_reason=${JSON.stringify(event.stop_reason ?? null)}`;
        if (t === 'session.error') return `[ERROR] ${JSON.stringify(event.error)}`;
        if (t === 'session.deleted') return `[deleted]`;
        return `[${t}]`;
      })();
      console.log(summary);
      if (t === 'session.status_idle') {
        if (event.stop_reason && event.stop_reason.type !== 'custom_tool_use') {
          done = true;
        }
      }
      if (t === 'session.deleted' || t === 'session.error') done = true;
    }
    if (Date.now() - startedAt > 90_000) {
      console.warn('--- SSE timeout (90s), aborting ---');
      done = true;
    }
  }

  // --- cleanup ---
  console.log('\n--- cleanup ---');
  try {
    await anthropic('POST', `/v1/environments/${env.id}/archive`, {});
    console.log(`environment ${env.id} archived`);
  } catch (e) {
    console.warn('environment archive failed:', e.message);
  }
  try {
    await anthropic('POST', `/v1/agents/${agent.id}/archive`, {});
    console.log(`agent ${agent.id} archived`);
  } catch (e) {
    console.warn('agent archive failed:', e.message);
  }
  try {
    await anthropic('POST', `/v1/vaults/${vault.id}/credentials/${credential.id}/archive`, {});
    console.log(`credential ${credential.id} archived`);
  } catch (e) {
    console.warn('credential archive failed:', e.message);
  }
  try {
    await anthropic('POST', `/v1/vaults/${vault.id}/archive`, {});
    console.log(`vault ${vault.id} archived`);
  } catch (e) {
    console.warn('vault archive failed:', e.message);
  }

  console.log('\nDONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
