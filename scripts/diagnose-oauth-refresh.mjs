#!/usr/bin/env node

// Issue #124 診断スクリプト
// kintone OAuth (Anthropic Vault `mcp_oauth` credential) の自動リフレッシュ不全の原因切り分け。
//
// 本プラグインが作成した Vault Credential を列挙し、各々に対して
//   POST /v1/vaults/{vault_id}/credentials/{credential_id}/mcp_oauth_validate
// を実行して has_refresh_token / refresh.status / mcp_probe を確認する。
//
// 読み取り専用 — credential の作成・更新・archive は一切行わない。token 等の秘匿値も出力しない。
//
// 使い方:
//   node scripts/diagnose-oauth-refresh.mjs            # metadata.source で本プラグイン由来に絞る
//   node scripts/diagnose-oauth-refresh.mjs --all      # 全 Vault を対象
//   node scripts/diagnose-oauth-refresh.mjs --vault vault_xxx   # 単一 Vault
//   node scripts/diagnose-oauth-refresh.mjs --json     # 機械可読 JSON 出力
//
// 必要な .env キー:
//   ANTHROPIC_API_KEY

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// METADATA_SOURCE = packages/plugin/src/core/constants.ts
const METADATA_SOURCE = 'cowork-agent-for-kintone';
const ANTHROPIC_BETA = 'managed-agents-2026-04-01';

// ---------- .env loader (verify-mcp-oauth.mjs と同等) ----------
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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('[fatal] missing env: ANTHROPIC_API_KEY');
  process.exit(1);
}

// ---------- args ----------
const args = process.argv.slice(2);
const OPT_ALL = args.includes('--all');
const OPT_JSON = args.includes('--json');
const vaultIdx = args.indexOf('--vault');
const OPT_VAULT = vaultIdx >= 0 ? args[vaultIdx + 1] : null;

// ---------- anthropic helper ----------
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
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, json, text };
}

function metadataSummary(md) {
  if (!md || typeof md !== 'object') return '';
  const parts = [];
  if (md.source) parts.push(md.source);
  if (md.kintoneDomain) parts.push(md.kintoneDomain);
  if (md.kintoneUserCode) parts.push(`user=${md.kintoneUserCode}`);
  return parts.join(' / ');
}

// ---------- main ----------
async function main() {
  // 1. Vault 一覧
  const vaultsRes = await anthropic('GET', '/v1/vaults?limit=100');
  if (!vaultsRes.ok) {
    console.error(`[fatal] list vaults ${vaultsRes.status}: ${vaultsRes.text}`);
    process.exit(1);
  }
  let vaults = vaultsRes.json?.data ?? [];

  if (OPT_VAULT) {
    vaults = vaults.filter((v) => v.id === OPT_VAULT);
  } else if (!OPT_ALL) {
    vaults = vaults.filter((v) => v.metadata?.source === METADATA_SOURCE);
  }

  if (vaults.length === 0) {
    console.error(
      `対象 Vault が 0 件。--all で全 Vault 対象、--vault <id> で単一指定も可能。` +
        ` (取得した Vault 総数: ${vaultsRes.json?.data?.length ?? 0})`,
    );
    process.exit(2);
  }

  const report = [];

  for (const vault of vaults) {
    const credsRes = await anthropic('GET', `/v1/vaults/${vault.id}/credentials`);
    if (!credsRes.ok) {
      report.push({ vault_id: vault.id, error: `list credentials ${credsRes.status}` });
      continue;
    }
    const active = (credsRes.json?.data ?? []).filter((c) => !c.archived_at);

    for (const cred of active) {
      // credential 詳細を取得して refresh 設定の構造を確認（仮説D: refresh ブロック不全）
      const detail = await anthropic('GET', `/v1/vaults/${vault.id}/credentials/${cred.id}`);
      const auth = detail.json?.auth ?? null;
      const expiresAt = auth?.expires_at ?? null;
      const refreshCfg = auth?.refresh ?? null;
      const refreshShape = refreshCfg
        ? {
            has_token_endpoint: typeof refreshCfg.token_endpoint === 'string',
            token_endpoint_auth_type: refreshCfg.token_endpoint_auth?.type ?? null,
            has_scope: refreshCfg.scope !== undefined,
          }
        : null;

      const v = await anthropic(
        'POST',
        `/v1/vaults/${vault.id}/credentials/${cred.id}/mcp_oauth_validate`,
        {},
      );
      const result = v.json ?? { _raw: v.text, _status: v.status };
      const hasRefresh = result?.has_refresh_token;
      const refreshStatus = result?.refresh?.status;
      const probe = result?.mcp_probe?.http_response ?? result?.mcp_probe?.status;

      // 仮説ヒント
      let hint = '';
      if (hasRefresh === false) {
        hint = '仮説A: refresh_token が Vault に存在しない（kintone 未発行 or 経路欠落）';
      } else if (result?.status === 'invalid') {
        hint = '仮説B/C 候補: refresh はあるが grant 喪失。refresh.status / probe を確認';
      } else if (result?.status === 'valid') {
        hint = 'OK: この credential は有効。失効再現時に再実行して比較を';
      } else if (result?.status === 'unknown') {
        hint = '一時エラー(unknown): 時間を置いて再実行';
      }

      report.push({
        vault_id: vault.id,
        vault_meta: metadataSummary(vault.metadata),
        credential_id: cred.id,
        auth_type: auth?.type ?? null,
        access_expires_at: expiresAt,
        refresh_config: refreshShape,
        status: result?.status,
        has_refresh_token: hasRefresh,
        refresh_status: refreshStatus,
        mcp_probe: probe,
        hint,
        raw: result,
      });
    }
  }

  if (OPT_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // 人間向け出力
  console.log(`\n=== mcp_oauth_validate 診断結果 (${report.length} credential) ===\n`);
  for (const r of report) {
    if (r.error) {
      console.log(`${r.vault_id}\n  ERROR: ${r.error}\n`);
      continue;
    }
    console.log(`${r.vault_id} (${r.vault_meta})`);
    console.log(
      `  ${r.credential_id}  type=${r.auth_type}  status=${r.status}` +
        `  has_refresh_token=${r.has_refresh_token}  refresh=${r.refresh_status}  probe=${r.mcp_probe}`,
    );
    const expNote = (() => {
      if (!r.access_expires_at) return '';
      const exp = new Date(r.access_expires_at).getTime();
      const mins = Math.round((exp - Date.now()) / 60000);
      return mins < 0 ? ` (期限切れ ${-mins}分前)` : ` (あと${mins}分)`;
    })();
    console.log(`  access_expires_at=${r.access_expires_at}${expNote}`);
    console.log(`  refresh_config=${JSON.stringify(r.refresh_config)}`);
    if (r.hint) console.log(`  => ${r.hint}`);
    console.log('');
  }

  // 集計
  const noRefresh = report.filter((r) => r.has_refresh_token === false).length;
  const invalid = report.filter((r) => r.status === 'invalid').length;
  console.log('--- まとめ ---');
  console.log(`has_refresh_token=false : ${noRefresh} 件 (= 仮説A 該当)`);
  console.log(`status=invalid          : ${invalid} 件`);
  if (noRefresh > 0) {
    console.log(
      '\n仮説A が濃厚。次手: token 交換レスポンスに refresh_token が含まれるか、' +
        'cybozu.com OAuth クライアントの refresh_token 発行設定 / scope を確認。',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
