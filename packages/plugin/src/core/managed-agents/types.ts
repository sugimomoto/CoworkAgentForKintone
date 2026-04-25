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
  | {
      type: 'session.status_idle';
      id: string;
      stop_reason: { type: string; [k: string]: unknown };
      processed_at: string;
    }
  | { type: 'session.status_running'; id: string; processed_at: string }
  | { type: 'session.status_terminated'; id: string; processed_at: string }
  | { type: 'session.error'; id: string; error: unknown; processed_at: string }
  | { type: string; id: string; [k: string]: unknown };
