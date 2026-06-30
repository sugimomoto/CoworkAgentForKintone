// 追加 MCP Server 登録 + 接続管理（#42）の型 + ヘルパー。
// フレームワーク非依存。McpServersPane / McpServerForm / McpAttachSection が依存する。
// 出所: docs/design-handoff/mcp-registration/mcpRegistry.ts（REDIRECT_URI のみ workerUrl から動的算出に変更）。
//
// 3 層モデル（Model A）:
//   ① McpServerDef  : サーバー定義（カタログ）  — テナント共有 / Plugin Config 保存
//   ② McpConnection : 接続（認証情報）          — per-user
//   ③ McpAttachment : attach（利用範囲）        — Agent ごと

export type McpAuthType = 'none' | 'bearer' | 'oauth';
export type TokenEndpointAuthType = 'none' | 'basic' | 'post'; // none = PKCE public（secret 不要）

export interface McpTool {
  name: string;
  description?: string;
  /** 実行前にユーザー承認を要する（破壊的操作など）。 */
  ask?: boolean;
}

/** ① カタログ（テナント / Plugin Config 保存）。client_secret は config に保存しない。 */
export interface McpServerDef {
  id: string;
  name: string;
  url: string; // https のみ
  authType: McpAuthType;
  /** tools/list キャッシュ（表示用）。 */
  tools?: McpTool[];
  // ── oauth のときのみ ──
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId?: string;
  scope?: string;
  tokenEndpointAuthType?: TokenEndpointAuthType;
  /** client_secret が保存済みか（生値は返さない＝伏字運用の判定に使う）。 */
  hasSecret?: boolean;
}

/** ② 接続状態（per-user）。 */
export type McpConnectionStatus = 'unconnected' | 'connected' | 'invalid';
export interface McpConnection {
  serverId: string;
  status: McpConnectionStatus; // 'invalid' = mcp_oauth_validate=invalid 由来
  /** 接続したアカウント表記（oauth=外部アカウント / bearer=鍵ラベル）。 */
  account?: string;
  /** 接続日時。 */
  at?: string;
}

/** ③ attach（agent ごと）。
 *  - `mode: 'all'`    : サーバーの全ツールを許可（ツール一覧を知らなくても attach 可能・既定）。
 *  - `mode: 'subset'` : `enabledTools` のツールのみ許可（カタログに tools がある場合のみ選べる）。
 *  attach 自体の ON/OFF は「この配列に存在するか」で表す（存在＝ON）。 */
export interface McpAttachment {
  serverId: string;
  mode: 'all' | 'subset';
  /** mode='subset' のとき有効化するツール名。mode='all' では未使用（[]）。 */
  enabledTools: string[];
}

// ── 認証方式メタ（識別の差し色 — 同一 chroma 帯で揃える） ──
export interface AuthMeta {
  label: string;
  short: string;
  color: string;
  soft: string;
  glyph: 'globe' | 'key' | 'shield';
}
export const MCP_AUTH: Record<McpAuthType, AuthMeta> = {
  none: { label: 'NO AUTH', short: '認証なし', color: '#64748b', soft: 'rgba(100,116,139,0.10)', glyph: 'globe' },
  bearer: { label: 'API KEY', short: 'API キー', color: '#b45309', soft: 'rgba(180,83,9,0.10)', glyph: 'key' },
  oauth: { label: 'OAUTH', short: 'OAuth', color: '#0d9488', soft: 'rgba(13,148,136,0.10)', glyph: 'shield' },
};

export const TOKEN_AUTH: Record<TokenEndpointAuthType, { label: string; hint: string }> = {
  none: { label: 'PKCE (public)', hint: 'client_secret 不要。public クライアント向け（推奨）。' },
  basic: { label: 'Basic 認証', hint: 'client_id / client_secret を Authorization ヘッダで送信。' },
  post: { label: 'POST body', hint: 'client_id / client_secret をリクエストボディで送信。' },
};

/** Worker 固定 redirect_uri を組み立てる（third-party の OAuth アプリに登録させる）。 */
export function buildRedirectUri(workerUrl: string): string {
  return `${workerUrl.replace(/\/$/, '')}/oauth/callback`;
}

/** 伏字（client_secret / API キー / token の保存後表示）。 */
export const maskedSecret = (n = 16): string => '●'.repeat(n);

// ── バリデーション ──
export function isHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** client_secret が必須か（oauth かつ basic|post）。 */
export function needsClientSecret(d: Pick<McpServerDef, 'authType' | 'tokenEndpointAuthType'>): boolean {
  return d.authType === 'oauth' && (d.tokenEndpointAuthType === 'basic' || d.tokenEndpointAuthType === 'post');
}

/** Plugin Config フォームの保存可否（カタログ定義）。 */
export function canSaveServerDef(d: Partial<McpServerDef> & { _secretEntered?: boolean }): boolean {
  if (!d.name?.trim()) return false;
  if (!d.url || !isHttpsUrl(d.url)) return false;
  if (d.authType === 'oauth') {
    if (!d.authorizationEndpoint || !isHttpsUrl(d.authorizationEndpoint)) return false;
    if (!d.tokenEndpoint || !isHttpsUrl(d.tokenEndpoint)) return false;
    if (!d.clientId?.trim()) return false;
    // basic|post で secret 未保存かつ未入力なら不可
    if (needsClientSecret(d as McpServerDef) && !d.hasSecret && !d._secretEntered) return false;
  }
  return true;
}

/** Settings(B) の接続フェーズ（行 UI の内部状態）。 */
export type ConnectPhase =
  | 'idle'
  | 'none-connecting'
  | 'bearer-input'
  | 'bearer-verifying'
  | 'oauth-authorizing'
  | 'oauth-exchanging';

/** authType → 未接続時の接続ボタン文言。 */
export function connectLabel(authType: McpAuthType): string {
  return authType === 'oauth' ? '認可して接続' : '接続';
}

/** attach のヘッダ「すべてのツール」チェック状態（全 ON / 一部 / OFF）。 */
export function attachHeadState(att: McpAttachment | null, allTools: string[]): 'on' | 'off' | 'indeterminate' {
  if (!att) return 'off';
  if (att.mode === 'all') return 'on';
  if (att.enabledTools.length === 0) return 'off';
  if (allTools.length > 0 && att.enabledTools.length === allTools.length) return 'on';
  return 'indeterminate';
}
