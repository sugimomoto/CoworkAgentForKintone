#!/usr/bin/env node

// Issue #124 確定スクリプト — 実リフレッシュの強制実行
//
// 既存の mcp_oauth Vault Credential（access_token は失効済の想定）を再利用して
// env + agent + session を作り、kintone ツールを 1 回呼ぶ。
// access_token が失効しているため Anthropic は必ず cybozu /oauth2/token へ
// refresh を試みる。その成否で「実リフレッシュ実行」が機能するかを確定する。
//
//   成功 (tool_result OK)     → 自動リフレッシュは機能している（不具合は現状再現せず）
//   失敗 (401 / invalid_grant) → 実リフレッシュ実行の失敗を確定。エラー本文を捕捉
//
// 実行後に agent / env / session は archive する（credential / vault は触らない）。
// billable: モデル呼び出し 1 ターンぶん。
//
// 使い方:
//   node scripts/probe-oauth-refresh.mjs --vault <vault_id> [--cred <credential_id>]
//   node scripts/probe-oauth-refresh.mjs            # metadata で mcp_oauth を自動選択（最初の1件）
//
// 必要な .env キー: ANTHROPIC_API_KEY

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const METADATA_SOURCE = 'cowork-agent-for-kintone';
const ANTHROPIC_BETA = 'managed-agents-2026-04-01';

function loadDotenv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadDotenv();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('[fatal] missing env: ANTHROPIC_API_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
let OPT_VAULT = argVal('--vault');
let OPT_CRED = argVal('--cred');

const ANTH_HEADERS = {
  'Content-Type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': ANTHROPIC_BETA,
  'X-Api-Key': ANTHROPIC_API_KEY,
};

async function anthropic(method, apiPath, body) {
  const res = await fetch(`https://api.anthropic.com${apiPath}`, {
    method,
    headers: ANTH_HEADERS,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  if (!res.ok) throw new Error(`Anthropic ${method} ${apiPath} -> ${res.status}: ${text}`);
  return json;
}

function dump(label, obj) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function pickCredential() {
  if (OPT_VAULT && OPT_CRED) {
    const detail = await anthropic('GET', `/v1/vaults/${OPT_VAULT}/credentials/${OPT_CRED}`);
    return { vaultId: OPT_VAULT, cred: detail };
  }
  const vaults = (await anthropic('GET', '/v1/vaults?limit=100')).data ?? [];
  const candidates = OPT_VAULT
    ? vaults.filter((v) => v.id === OPT_VAULT)
    : vaults.filter((v) => v.metadata?.source === METADATA_SOURCE);
  for (const v of candidates) {
    const creds = (await anthropic('GET', `/v1/vaults/${v.id}/credentials`)).data ?? [];
    for (const c of creds) {
      if (c.archived_at) continue;
      const detail = await anthropic('GET', `/v1/vaults/${v.id}/credentials/${c.id}`);
      if (detail.auth?.type === 'mcp_oauth') return { vaultId: v.id, cred: detail };
    }
  }
  return null;
}

async function main() {
  const picked = await pickCredential();
  if (!picked) {
    console.error('mcp_oauth credential が見つかりません。--vault/--cred で明示指定してください。');
    process.exit(2);
  }
  const { vaultId, cred } = picked;
  const mcpServerUrl = cred.auth?.mcp_server_url;
  if (!mcpServerUrl) {
    console.error('credential に mcp_server_url がありません。', cred.id);
    process.exit(2);
  }
  const host = new URL(mcpServerUrl).hostname;
  dump('対象 credential', {
    vault_id: vaultId,
    credential_id: cred.id,
    mcp_server_url: mcpServerUrl,
    access_expires_at: cred.auth?.expires_at,
    has_refresh: !!cred.auth?.refresh,
  });

  // env
  const env = await anthropic('POST', '/v1/environments', {
    name: 'issue124 refresh probe env',
    config: {
      type: 'cloud',
      networking: { type: 'limited', allow_mcp_servers: true, allowed_hosts: [host] },
    },
  });
  dump('Environment created', { id: env.id });

  // agent
  const agent = await anthropic('POST', '/v1/agents', {
    model: 'claude-sonnet-4-6',
    name: 'issue124 refresh probe agent',
    system:
      'You are probing kintone OAuth auto-refresh. ' +
      'Call the kintone-get-apps tool with no arguments and report the raw result.',
    mcp_servers: [{ type: 'url', name: 'kintone', url: mcpServerUrl }],
    tools: [
      {
        type: 'mcp_toolset',
        mcp_server_name: 'kintone',
        default_config: { enabled: true, permission_policy: { type: 'always_allow' } },
      },
    ],
  });
  dump('Agent created', { id: agent.id });

  // session
  const session = await anthropic('POST', '/v1/sessions', {
    agent: agent.id,
    environment_id: env.id,
    vault_ids: [vaultId],
  });
  dump('Session created', { id: session.id });

  // message
  await anthropic('POST', `/v1/sessions/${session.id}/events`, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: 'kintone のアプリ一覧を取得して、最初の3件の名前と ID を教えて。' }],
      },
    ],
  });
  console.log('\n--- user.message sent, streaming events ---\n');

  let verdict = 'unknown';
  let toolErrorText = '';

  const sseRes = await fetch(`https://api.anthropic.com/v1/sessions/${session.id}/events/stream`, {
    headers: { ...ANTH_HEADERS, Accept: 'text/event-stream' },
  });
  if (!sseRes.ok) throw new Error(`SSE ${sseRes.status}: ${await sseRes.text()}`);
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
      if (t === 'agent.mcp_tool_use' || t === 'agent.tool_use') {
        console.log(`[${t}] name=${event.name ?? event.tool_name ?? '?'}`);
      } else if (t === 'mcp_tool_result' || t === 'tool_result' || t === 'agent.tool_result') {
        const s = JSON.stringify(event);
        console.log(`[${t}] ${s.slice(0, 600)}`);
        const lower = s.toLowerCase();
        if (lower.includes('error') || lower.includes('401') || lower.includes('invalid_token') || lower.includes('unauthorized') || lower.includes('invalid_grant')) {
          verdict = 'refresh_failed';
          toolErrorText = s.slice(0, 1200);
        } else if (verdict === 'unknown') {
          verdict = 'refresh_ok';
        }
      } else if (t === 'agent.message') {
        console.log(`[agent.message] ${JSON.stringify(event.content).slice(0, 300)}`);
      } else if (t === 'session.error') {
        console.log(`[ERROR] ${JSON.stringify(event.error)}`);
        verdict = 'session_error';
        toolErrorText = JSON.stringify(event.error);
      } else if (t === 'session.status_idle') {
        console.log(`[idle] stop_reason=${JSON.stringify(event.stop_reason ?? null)}`);
        if (event.stop_reason && event.stop_reason.type !== 'custom_tool_use') done = true;
      }
    }
    if (Date.now() - startedAt > 90_000) {
      console.warn('--- SSE timeout (90s) ---');
      done = true;
    }
  }

  // cleanup
  console.log('\n--- cleanup (agent/env archive; credential/vault は温存) ---');
  for (const [label, p] of [
    ['environment', `/v1/environments/${env.id}/archive`],
    ['agent', `/v1/agents/${agent.id}/archive`],
  ]) {
    try {
      await anthropic('POST', p, {});
      console.log(`${label} archived`);
    } catch (e) {
      console.warn(`${label} archive failed:`, e.message);
    }
  }

  // 事後: credential を再検査して expires_at が更新されたか確認
  try {
    const after = await anthropic('GET', `/v1/vaults/${vaultId}/credentials/${cred.id}`);
    console.log(`\naccess_expires_at  before=${cred.auth?.expires_at}  after=${after.auth?.expires_at}`);
  } catch {
    /* ignore */
  }

  console.log(`\n================ 判定: ${verdict} ================`);
  if (verdict === 'refresh_ok') {
    console.log('失効済 access_token でツール成功 = 自動リフレッシュは機能。#124 は現状再現せず（既に解消の可能性）。');
  } else if (verdict === 'refresh_failed' || verdict === 'session_error') {
    console.log('リフレッシュ実行に失敗。捕捉したエラー:');
    console.log(toolErrorText);
  } else {
    console.log('判定不能。ツール呼び出しが起きなかった可能性。SSE ログを確認。');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
