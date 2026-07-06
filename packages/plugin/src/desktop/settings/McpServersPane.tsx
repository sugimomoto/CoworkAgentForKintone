// #42 M2: Chat Panel Settings → MCP タブの per-user 接続管理ペイン。
// テナント定義済みカタログ × 本人の接続状態を表示し、本人が接続/解除する。
// none/bearer を実装。oauth は M3（connectMcpOAuth）で結線する。

import { useState } from 'react';

import { MCP_AUTH, connectLabel, type McpServerDef, type McpTool } from '../../core/mcp/registry';
import { toErrorMessage } from '../../core/utils';
import { useMcpConnections } from '../hooks/useMcpConnections';

export interface McpServersPaneProps {
  pluginId: string | null;
}

export function McpServersPane({ pluginId }: McpServersPaneProps): JSX.Element {
  const { servers, connections, loading, error, connectBearer, connectOAuth, disconnect } =
    useMcpConnections(pluginId);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-bg p-[22px]" data-testid="mcp-pane">
      <h2 className="mb-[4px] text-[13px] font-semibold text-text">MCP サーバー</h2>
      <p className="mb-[14px] text-[11px] leading-[1.6] text-muted">
        管理者が登録したリモート MCP サーバーに、<strong>あなた個人のアカウント</strong>で接続します。
      </p>

      {loading && <div className="text-[12px] text-muted">読み込み中…</div>}
      {error && (
        <div className="rounded-[8px] border border-warn/30 bg-warn-soft px-[12px] py-[10px] text-[12px] text-warn">
          {error}
        </div>
      )}

      {!loading && !error && servers.length === 0 && (
        <div
          data-testid="mcp-pane-empty"
          className="rounded-[8px] bg-card-hi px-[12px] py-[14px] text-[12px] text-subtle"
        >
          接続できる MCP サーバーがありません。管理者がプラグイン設定で登録すると、ここに表示されます。
        </div>
      )}

      {!loading && !error && servers.length > 0 && (
        <ul className="flex flex-col gap-[8px]">
          {servers.map((s) => (
            <McpServerRow
              key={s.id}
              server={s}
              connected={connections[s.id]?.status === 'connected'}
              onConnectBearer={(token) => connectBearer(s, token)}
              onConnectOAuth={() => connectOAuth(s)}
              onDisconnect={() => disconnect(s)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type RowPhase = 'idle' | 'bearer-input' | 'verifying' | 'confirm-disconnect';

function McpServerRow({
  server,
  connected,
  onConnectBearer,
  onConnectOAuth,
  onDisconnect,
}: {
  server: McpServerDef;
  connected: boolean;
  onConnectBearer: (token: string) => Promise<McpTool[]>;
  onConnectOAuth: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}): JSX.Element {
  const [phase, setPhase] = useState<RowPhase>('idle');
  const [token, setToken] = useState('');
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = MCP_AUTH[server.authType];

  async function handleBearerConnect(): Promise<void> {
    if (!token.trim() || busy) return;
    setBusy(true);
    setRowError(null);
    setPhase('verifying');
    try {
      const fetched = await onConnectBearer(token.trim());
      setTools(fetched);
      setToken('');
      setPhase('idle');
    } catch (err) {
      setRowError(toErrorMessage(err));
      setPhase('bearer-input');
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuthConnect(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    setPhase('verifying');
    try {
      await onConnectOAuth();
      setPhase('idle');
    } catch (err) {
      setRowError(toErrorMessage(err));
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    try {
      await onDisconnect();
      setTools(null);
      setPhase('idle');
    } catch (err) {
      setRowError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      data-testid="mcp-server-row"
      data-server-id={server.id}
      className="rounded-[11px] border border-card-border bg-card px-[14px] py-[12px]"
    >
      <div className="flex items-center gap-[8px]">
        <span className="flex-1 truncate">
          <span className="text-[13px] font-medium text-text">{server.name}</span>
          <span className="ml-[6px] font-mono text-[10.5px] text-muted">{server.url}</span>
        </span>
        <span
          className="rounded-[3px] px-[6px] py-[1px] text-[9.5px] font-semibold"
          style={{ background: meta.soft, color: meta.color }}
        >
          {meta.label}
        </span>
        {/* none は credential を持たない（接続/解除の概念が無い）ので「利用可（認証不要）」を優先表示。
            bearer/oauth のみ per-user credential の有無で「接続済み」を出す。 */}
        {server.authType === 'none' ? (
          <span className="text-[11px] text-muted">利用可（認証不要）</span>
        ) : connected ? (
          <span className="flex items-center gap-[4px] text-[11px] text-text">
            <span className="h-[7px] w-[7px] rounded-full bg-[#22c55e]" /> 接続済み
          </span>
        ) : null}
      </div>

      {/* 未接続: 接続ボタン */}
      {!connected && server.authType !== 'none' && phase === 'idle' && (
        <div className="mt-[8px]">
          <button
            type="button"
            data-testid="mcp-connect-button"
            onClick={() => (server.authType === 'oauth' ? void handleOAuthConnect() : setPhase('bearer-input'))}
            className="rounded-[7px] bg-accent px-[12px] py-[6px] text-[12px] font-semibold text-white"
          >
            {connectLabel(server.authType)}
          </button>
          {server.tools && server.tools.length > 0 && (
            <span className="ml-[8px] text-[10.5px] text-subtle">接続後に {server.tools.length} ツール</span>
          )}
        </div>
      )}

      {/* bearer 入力 */}
      {phase === 'bearer-input' && (
        <div className="mt-[8px]">
          <label className="mb-[3px] block text-[11px] text-text">API キー / トークン</label>
          <input
            data-testid="mcp-bearer-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-[7px] border border-card-border bg-bg px-[10px] py-[7px] font-mono text-[12px] text-text outline-none focus:border-accent"
          />
          <div className="mt-[8px] flex gap-[8px]">
            <button
              type="button"
              data-testid="mcp-bearer-submit"
              onClick={() => void handleBearerConnect()}
              disabled={!token.trim() || busy}
              className="rounded-[7px] bg-accent px-[12px] py-[6px] text-[12px] font-semibold text-white disabled:opacity-50"
            >
              接続して確認
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('idle');
                setRowError(null);
              }}
              className="rounded-[7px] border border-card-border px-[12px] py-[6px] text-[12px] text-muted"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {phase === 'verifying' && (
        <div className="mt-[8px] text-[11px] text-muted">接続を確認中…（tools/list 疎通）</div>
      )}

      {/* 接続済み: ツール一覧 + 解除（none は credential が無く解除対象が無いので出さない） */}
      {connected && server.authType !== 'none' && (
        <div className="mt-[8px]">
          {tools && tools.length > 0 && (
            <details className="mb-[6px]">
              <summary className="cursor-pointer text-[11px] text-accent">公開ツール {tools.length} 件</summary>
              <ul className="mt-[4px] flex flex-col gap-[2px] pl-[8px]">
                {tools.map((t) => (
                  <li key={t.name} className="font-mono text-[10.5px] text-muted">
                    {t.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {phase === 'confirm-disconnect' ? (
            <div className="rounded-[8px] border border-[#f0c98a] bg-warn-soft px-[10px] py-[8px]">
              <p className="mb-[6px] text-[11px] text-warn">
                接続を解除しますか？（エージェントへの attach 設定は残ります）
              </p>
              <div className="flex gap-[8px]">
                <button
                  type="button"
                  data-testid="mcp-disconnect-confirm"
                  onClick={() => void handleDisconnect()}
                  disabled={busy}
                  className="rounded-[7px] bg-warn px-[10px] py-[5px] text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  解除する
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('idle')}
                  className="rounded-[7px] border border-card-border px-[10px] py-[5px] text-[11px] text-muted"
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="mcp-disconnect-button"
              onClick={() => setPhase('confirm-disconnect')}
              className="text-[11px] font-medium text-warn"
            >
              解除
            </button>
          )}
        </div>
      )}

      {rowError && <p className="mt-[6px] text-[11px] text-warn">⚠ {rowError}</p>}
    </li>
  );
}
