// Cowork Agent for kintone — OAuth 失効検知の観測ログ (Issue #124)
//
// 「再認可バナーが出た瞬間」に、何が引き金か (errorText / toolName) と、その時点で
// grant が本当に死んでいたか (mcp_oauth_validate) を localStorage に永続記録する。
// 挙動は一切変えない — 観測専用。console は揮発するため、後から証拠を吸い出せるよう
// localStorage のリングバッファに残し、window.__coworkAuthLog() で取得できるようにする。
//
// 設計意図: 現状 isOAuthFailureText は 401/unauthorized/CB_OA01 等の広いパターンで発火するが、
// 単純な access_token 失効は Anthropic が透過的にリフレッシュするため本来ここには到達しない。
// よって発火が「本物の grant 喪失」か「一過性/誤検知」かを、その瞬間の validate 結果で確定する。

import { debug, warn } from '../debug';
import { validateMcpOAuth } from '../managed-agents/resources';
import { toErrorMessage } from '../utils';

const STORAGE_KEY = 'cowork:authlog';
const MAX_ENTRIES = 50;
const MAX_ERROR_TEXT = 500;

export interface AuthDiagnosticEntry {
  /** ISO 8601 */
  at: string;
  toolName: string | null;
  toolUseId: string | null;
  /** isOAuthFailureText を発火させたエラーテキスト (先頭 MAX_ERROR_TEXT 文字) */
  errorText: string;
  /** バナーを倒す直前の bindingStatus */
  bindingStatusBefore: string;
  vaultId: string | null;
  credentialId: string | null;
  /** その瞬間の mcp_oauth_validate 結果。valid=誤検知/一過性, invalid=本物の失効 */
  validate:
    | { status?: string; hasRefreshToken?: boolean; refreshStatus?: string | null; mcpProbe?: unknown }
    | { error: string }
    | { skipped: string }
    | null;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(): AuthDiagnosticEntry[] {
  const ls = getStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthDiagnosticEntry[]) : [];
  } catch {
    return [];
  }
}

function write(list: AuthDiagnosticEntry[]): void {
  const ls = getStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    /* quota / private mode 等は無視 (観測専用なので失敗しても本機能に影響させない) */
  }
}

/** 1 件追記する (テスト用に公開)。 */
export function recordAuthEvent(entry: AuthDiagnosticEntry): void {
  const list = read();
  list.push(entry);
  write(list);
}

/** 記録された観測ログを返す。 */
export function dumpAuthLog(): AuthDiagnosticEntry[] {
  return read();
}

/** 観測ログを消す。 */
export function clearAuthLog(): void {
  const ls = getStorage();
  if (!ls) return;
  try {
    ls.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface CaptureAuthFailureInput {
  toolName: string | null;
  toolUseId: string | null;
  errorText: string | undefined;
  bindingStatusBefore: string;
  vaultId: string | null;
  credentialId: string | null;
}

/**
 * 再認可バナー発火点から呼ぶ観測フック。
 * その瞬間に validate を実行して grant の生死を確定し、引き金情報と併せて永続記録する。
 * await されず fire-and-forget で呼ばれる前提 (UI をブロックしない)。失敗しても握りつぶす。
 */
export async function captureAuthFailure(input: CaptureAuthFailureInput): Promise<void> {
  const entry: AuthDiagnosticEntry = {
    at: new Date().toISOString(),
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    errorText: (input.errorText ?? '').slice(0, MAX_ERROR_TEXT),
    bindingStatusBefore: input.bindingStatusBefore,
    vaultId: input.vaultId,
    credentialId: input.credentialId,
    validate: null,
  };

  if (input.vaultId && input.credentialId) {
    try {
      const v = await validateMcpOAuth(input.vaultId, input.credentialId);
      entry.validate = {
        status: v.status,
        hasRefreshToken: v.has_refresh_token,
        refreshStatus: v.refresh?.status ?? null,
        mcpProbe: v.mcp_probe ?? null,
      };
    } catch (e) {
      entry.validate = { error: toErrorMessage(e) };
    }
  } else {
    entry.validate = { skipped: 'vaultId/credentialId が未確定' };
  }

  recordAuthEvent(entry);
  debug('Banner', 'auth failure captured', entry);
  if (entry.validate && 'status' in entry.validate && entry.validate.status === 'valid') {
    warn(
      'Banner',
      '再認可バナー発火時に validate=valid (=誤検知/一過性の疑い)。window.__coworkAuthLog() で確認。',
    );
  }
}

/** window.__coworkAuthLog() で観測ログを吸い出せるように露出する (本番でも安全)。 */
export function installAuthLogInspector(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __coworkAuthLog?: () => AuthDiagnosticEntry[];
    __coworkClearAuthLog?: () => void;
  };
  w.__coworkAuthLog = dumpAuthLog;
  w.__coworkClearAuthLog = clearAuthLog;
}
