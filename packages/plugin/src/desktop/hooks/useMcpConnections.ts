// #42 M2: per-user の MCP 接続状態を管理するフック。
//
// カタログ（Plugin Config の mcpServers, テナント共有）× ユーザーの Vault credential を突合し、
// 各サーバーの接続状態（unconnected/connected）を返す。bearer の接続/解除をここで行う。
// （oauth 接続は M3 の connectMcpOAuth が担う。none は per-user credential 不要 = 常に利用可。）

import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveUserVault } from '../../core/bootstrap/resolveVault';
import { getPluginConfig } from '../../core/kintone/pluginConfig';
import { getCurrentSessionContext } from '../../core/kintone/user';
import { archiveVaultCredential, listVaultCredentials } from '../../core/managed-agents/resources';
import { connectMcpOAuth } from '../../core/mcp/connectMcpOAuth';
import { fetchMcpTools } from '../../core/mcp/toolsList';
import { upsertStaticBearerCredential } from '../../core/oauth/credentialsUpsertClient';
import { toErrorMessage } from '../../core/utils';

import type { McpConnection, McpServerDef, McpTool } from '../../core/mcp/registry';

export interface McpConnectionEntry extends McpConnection {
  /** archive 用。connected のときのみ。 */
  credentialId?: string;
  /** 接続時に取得した公開ツール（表示用キャッシュ）。 */
  tools?: McpTool[];
}

export interface UseMcpConnectionsResult {
  servers: McpServerDef[];
  connections: Record<string, McpConnectionEntry>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** bearer: トークン検証(tools/list) → per-user Vault に static_bearer 保存。 */
  connectBearer: (server: McpServerDef, token: string) => Promise<McpTool[]>;
  /** oauth: 認可フロー → per-user Vault に mcp_oauth 保存。 */
  connectOAuth: (server: McpServerDef) => Promise<void>;
  /** 接続解除（Vault credential を archive）。 */
  disconnect: (server: McpServerDef) => Promise<void>;
}

export function useMcpConnections(pluginId: string | null): UseMcpConnectionsResult {
  const [servers, setServers] = useState<McpServerDef[]>([]);
  const [connections, setConnections] = useState<Record<string, McpConnectionEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vaultIdRef = useRef<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const cfg = pluginId ? getPluginConfig(pluginId) : { mcpServers: [] as McpServerDef[] };
        const catalog = cfg.mcpServers ?? [];
        const ctx = getCurrentSessionContext();
        const vault = await resolveUserVault({
          kintoneDomain: ctx.kintoneDomain,
          kintoneUserCode: ctx.kintoneUserCode,
        });
        if (cancelled) return;
        vaultIdRef.current = vault.id;
        const creds = await listVaultCredentials(vault.id);
        if (cancelled) return;

        // mcp_server_url → 非 archive credential
        const byUrl = new Map<string, { id: string }>();
        for (const c of creds.data) {
          if (c.archived_at) continue;
          const url = (c.auth as { mcp_server_url?: string }).mcp_server_url;
          if (url) byUrl.set(url, { id: c.id });
        }

        const map: Record<string, McpConnectionEntry> = {};
        for (const s of catalog) {
          if (s.authType === 'none') {
            map[s.id] = { serverId: s.id, status: 'connected' }; // 認証不要 = 常に利用可
            continue;
          }
          const cred = byUrl.get(s.url);
          map[s.id] = cred
            ? { serverId: s.id, status: 'connected', credentialId: cred.id }
            : { serverId: s.id, status: 'unconnected' };
        }
        if (cancelled) return;
        setServers(catalog);
        setConnections(map);
      } catch (err) {
        if (!cancelled) setError(toErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pluginId, reloadKey]);

  const connectBearer = useCallback(
    async (server: McpServerDef, token: string): Promise<McpTool[]> => {
      const cfg = pluginId ? getPluginConfig(pluginId) : { workerUrl: null };
      const workerUrl = cfg.workerUrl;
      if (!pluginId || !workerUrl) throw new Error('Worker URL が未設定です');
      const vaultId = vaultIdRef.current;
      if (!vaultId) throw new Error('Vault が未解決です');
      // 1. トークン検証 + ツール取得（疎通確認）
      const tools = await fetchMcpTools({ url: server.url, bearerToken: token });
      // 2. per-user Vault に static_bearer で保存（token はブラウザ→Worker→Anthropic、JS に残さない）
      await upsertStaticBearerCredential({
        pluginId,
        workerUrl,
        vaultId,
        mcpServerUrl: server.url,
        token,
      });
      reload();
      return tools;
    },
    [pluginId, reload],
  );

  const connectOAuth = useCallback(
    async (server: McpServerDef): Promise<void> => {
      const cfg = pluginId ? getPluginConfig(pluginId) : { workerUrl: null };
      const workerUrl = cfg.workerUrl;
      if (!pluginId || !workerUrl) throw new Error('Worker URL が未設定です');
      const vaultId = vaultIdRef.current;
      if (!vaultId) throw new Error('Vault が未解決です');
      await connectMcpOAuth({ pluginId, workerUrl, vaultId, server });
      reload();
    },
    [pluginId, reload],
  );

  const disconnect = useCallback(
    async (server: McpServerDef): Promise<void> => {
      const vaultId = vaultIdRef.current;
      const entry = connections[server.id];
      if (!vaultId || !entry?.credentialId) {
        reload();
        return;
      }
      await archiveVaultCredential(vaultId, entry.credentialId);
      reload();
    },
    [connections, reload],
  );

  return { servers, connections, loading, error, reload, connectBearer, connectOAuth, disconnect };
}
