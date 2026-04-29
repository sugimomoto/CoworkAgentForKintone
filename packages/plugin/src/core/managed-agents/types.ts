// Cowork Agent for kintone — Managed Agents API の型定義

/** Managed Agents API リソースに付与する metadata */
export type ManagedAgentsMetadata = Record<string, string>;

/** Agent リソース */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  system?: string;
  model: { id: string; speed?: 'standard' | 'fast' };
  tools?: unknown[];
  metadata: ManagedAgentsMetadata;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  version: number;
  type: 'agent';
}

/** Environment リソース */
export interface Environment {
  id: string;
  name: string;
  description?: string;
  config: {
    type: 'cloud';
    networking?: NetworkingConfig;
    packages?: PackagesConfig;
  };
  metadata: ManagedAgentsMetadata;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  type: 'environment';
}

export type NetworkingConfig =
  | { type: 'unrestricted' }
  | {
      type: 'limited';
      allow_mcp_servers?: boolean;
      allow_package_managers?: boolean;
      allowed_hosts?: string[];
    };

export interface PackagesConfig {
  apt?: string[];
  cargo?: string[];
  gem?: string[];
  go?: string[];
  npm?: string[];
  pip?: string[];
}

/** Vault リソース (シークレットの値そのものは含まれない) */
export interface Vault {
  id: string;
  display_name: string;
  metadata: ManagedAgentsMetadata;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  type: 'vault';
}

/**
 * Vault Credential の auth 設定。
 * - static_bearer: 固定 Bearer トークン (kintone-mcp の MCP server 用に使う)
 * - mcp_oauth: 将来用 (本 Phase では未使用)
 */
export type VaultCredentialAuth =
  | {
      type: 'static_bearer';
      mcp_server_url: string;
      /** 書込み専用。create / update リクエスト body にだけ含む。レスポンスでは返らない */
      token?: string;
    }
  | {
      type: 'mcp_oauth';
      mcp_server_url: string;
      access_token?: string;
      expires_at?: string;
      // 簡易宣言。Phase 1c 以降で必要なら詳細化
    };

/** Vault Credential リソース (シークレット値はレスポンスに返らない) */
export interface VaultCredential {
  id: string;
  vault_id: string;
  display_name: string;
  /** auth.type と mcp_server_url のみ含む。token / access_token は write-only */
  auth: VaultCredentialAuth;
  metadata?: ManagedAgentsMetadata;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  type: 'credential';
}

/** Session リソース */
export interface Session {
  id: string;
  agent: { id: string; type: 'agent'; version?: number };
  environment_id: string;
  vault_ids: string[];
  metadata: ManagedAgentsMetadata;
  status: 'rescheduling' | 'running' | 'idle' | 'terminated';
  title?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  type: 'session';
}

/** ページネーション付きの一覧レスポンス */
export interface ListResponse<T> {
  data: T[];
  next_page: string | null;
}

/** Managed Agents API のエラーレスポンス */
export interface ApiErrorBody {
  type?: string;
  error?: {
    type?: string;
    message?: string;
  };
}

/** Session.status_idle の stop_reason */
export interface StopReason {
  /** 'end_turn' | 'tool_confirmation_required' | 'custom_tool_use' | 'max_tokens' | 'error' | 'retries_exhausted' など */
  type: string;
  /** tool_confirmation_required / custom_tool_use 時の pending tool_use_id 群 */
  event_ids?: string[];
  [k: string]: unknown;
}

/** イベント (Session 上のメッセージ・ツール呼び出しなど) */
export type SessionEvent =
  | { type: 'user.message'; id: string; content: unknown; processed_at?: string }
  | { type: 'agent.message'; id: string; content: unknown; processed_at: string }
  | { type: 'agent.thinking'; id: string; processed_at: string }
  | { type: 'agent.tool_use'; id: string; name: string; input: unknown; processed_at: string }
  | {
      type: 'agent.tool_result';
      id: string;
      tool_use_id: string;
      content?: unknown;
      is_error?: boolean;
      processed_at: string;
    }
  | { type: 'agent.mcp_tool_use'; id: string; name: string; input: unknown; processed_at: string }
  | {
      type: 'agent.mcp_tool_result';
      id: string;
      /** MCP ツール結果は tool_use_id ではなく mcp_tool_use_id で参照する (Anthropic 仕様) */
      mcp_tool_use_id: string;
      content?: unknown;
      is_error?: boolean;
      processed_at: string;
    }
  /**
   * Custom Tool 呼出 (e.g. create_artifact)。Agent が plugin 側に処理を依頼する。
   * `event.id` がそのまま custom_tool_use_id (= 結果返却時の参照キー) になる。
   * Plugin は `user.custom_tool_result` を返さないとターンが止まる。
   */
  | {
      type: 'agent.custom_tool_use';
      id: string;
      name: string;
      input: unknown;
      processed_at: string;
    }
  /**
   * Plugin が返した Custom Tool 結果 (events stream に user 発信として記録される)。
   * Replay 時にこれを観測したら同じ custom_tool_use_id への再送信を抑止する。
   */
  | {
      type: 'user.custom_tool_result';
      id: string;
      custom_tool_use_id: string;
      content?: unknown;
      is_error?: boolean;
      processed_at?: string;
    }
  | {
      type: 'session.status_idle';
      id: string;
      stop_reason: StopReason;
      processed_at: string;
    }
  | { type: 'session.status_running'; id: string; processed_at: string }
  | { type: 'session.status_terminated'; id: string; processed_at: string }
  | { type: 'session.error'; id: string; error: unknown; processed_at: string }
  | { type: string; id: string; [k: string]: unknown };
