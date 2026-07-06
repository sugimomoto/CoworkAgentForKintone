// #42 M4: Agent 詳細編集の「MCP」セクション（Surface C）。
// 登録済み MCP サーバーの attach ON/OFF + attach 済みサーバーの tool 単位 ON/OFF。
// controlled: value=McpAttachment[] / onChange。接続状態は控えめな参考表示（操作はさせない）。
// 出所: docs/design-handoff/mcp-registration/McpAttachSection.tsx（import を core/mcp/registry に、
// React 名前空間を named import に調整）。

import { useMemo, useState, type SVGProps } from 'react';

import { MCP_AUTH, attachHeadState, type McpAttachment, type McpConnection, type McpServerDef } from '../../core/mcp/registry';

export interface McpAttachSectionProps {
  servers: McpServerDef[];
  connections?: Record<string, McpConnection>;
  value: McpAttachment[];
  onChange: (next: McpAttachment[]) => void;
}

export function McpAttachSection({
  servers,
  connections = {},
  value,
  onChange,
}: McpAttachSectionProps): JSX.Element {
  const byId = useMemo(() => Object.fromEntries(value.map((a) => [a.serverId, a])), [value]);

  const replace = (serverId: string, next: McpAttachment | null): void => {
    const rest = value.filter((a) => a.serverId !== serverId);
    onChange(next ? [...rest, next] : rest);
  };
  const setAll = (serverId: string): void => replace(serverId, { serverId, mode: 'all', enabledTools: [] });
  const setSubset = (serverId: string, enabledTools: string[]): void =>
    replace(serverId, { serverId, mode: 'subset', enabledTools });
  const detach = (serverId: string): void => replace(serverId, null);

  return (
    <div data-testid="mcp-attach-section">
      <div className="mb-[9px] ml-[2px] flex items-center gap-[8px] text-[10.5px] font-bold uppercase tracking-[0.6px] text-muted">
        <PlugIcon className="text-accent" /> MCP サーバー
        <span className="text-[9.5px] font-normal normal-case tracking-normal text-subtle">
          このエージェントで使うツールを選択
        </span>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">
        {servers.length === 0 ? (
          <div className="px-[18px] py-[22px] text-center">
            <div className="mb-[4px] text-[12px] text-muted">登録済みの MCP サーバーがありません</div>
            <div className="text-[10.5px] text-subtle">
              Plugin Config でサーバーを追加すると、ここで割り当てられます。
            </div>
          </div>
        ) : (
          servers.map((s) => (
            <AttachRow
              key={s.id}
              server={s}
              attachment={byId[s.id]}
              connection={connections[s.id]}
              onSetAll={() => setAll(s.id)}
              onSetSubset={(tools) => setSubset(s.id, tools)}
              onDetach={() => detach(s.id)}
            />
          ))
        )}
      </div>

      {servers.length > 0 && (
        <p className="mt-[10px] text-[10.5px] leading-[1.5] text-subtle">
          ここで有効化したツールは、<strong className="text-muted">実行するユーザーがそのサーバーに接続済みのときだけ</strong>
          動作します。接続は各ユーザーが「設定 → MCP サーバー」で行います。
        </p>
      )}
    </div>
  );
}

function AttachRow({
  server,
  attachment,
  connection,
  onSetAll,
  onSetSubset,
  onDetach,
}: {
  server: McpServerDef;
  attachment?: McpAttachment | undefined;
  connection?: McpConnection | undefined;
  onSetAll: () => void;
  onSetSubset: (tools: string[]) => void;
  onDetach: () => void;
}): JSX.Element {
  const allNames = (server.tools ?? []).map((t) => t.name);
  const hasToolList = allNames.length > 0;
  const attached = !!attachment;
  // 実効的に有効なツール集合（mode='all' は全ツール扱い）。
  const enabled = new Set(attachment?.mode === 'all' ? allNames : (attachment?.enabledTools ?? []));
  const [open, setOpen] = useState(attached && hasToolList);
  const head = attachHeadState(attachment ?? null, allNames);
  const meta = MCP_AUTH[server.authType];
  const connected = connection?.status === 'connected';
  const canExpand = attached && hasToolList;

  const toggleAttach = (): void => {
    if (attached) onDetach();
    else {
      onSetAll();
      if (hasToolList) setOpen(true);
    }
  };
  // ツール一覧が分かるときのみ呼ばれる。全選択なら mode='all'、それ以外は subset。
  const applyEnabled = (next: Set<string>): void => {
    if (next.size === allNames.length) onSetAll();
    else onSetSubset([...next]);
  };
  const toggleTool = (name: string): void => {
    const n = new Set(enabled);
    if (n.has(name)) n.delete(name);
    else n.add(name);
    applyEnabled(n);
  };

  const sub = !hasToolList
    ? attached
      ? '全ツール有効（一覧未取得）'
      : 'ツール未取得'
    : attached
      ? attachment?.mode === 'all'
        ? `全 ${allNames.length} ツール有効`
        : `${enabled.size} / ${allNames.length} ツール有効`
      : `${allNames.length} ツール`;

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-[10px] px-[14px] py-[11px]">
        <button
          type="button"
          onClick={() => canExpand && setOpen((v) => !v)}
          disabled={!canExpand}
          aria-label="ツール一覧"
          className={`flex text-subtle transition-transform ${open && canExpand ? 'rotate-90' : ''} ${canExpand ? '' : 'opacity-30'}`}
        >
          <ChevronIcon />
        </button>
        <span
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] font-mono text-[11px] font-extrabold"
          style={{ background: meta.soft, color: meta.color }}
        >
          {server.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[6px]">
            <span className="text-[12.5px] font-semibold text-text">{server.name}</span>
            <span
              className="rounded-[3px] px-[6px] py-[1px] font-mono text-[9px] font-bold"
              style={{ background: meta.soft, color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
          <div className="mt-[2px] text-[9.5px] text-subtle">{sub}</div>
        </div>
        <span
          title={connected ? 'あなたは接続済み' : 'あなたは未接続 — 設定 → MCP で接続できます'}
          className={`inline-flex items-center gap-[4px] text-[9px] ${connected ? 'text-ok' : 'text-subtle'}`}
        >
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: connected ? '#22c55e' : 'var(--cw-subtle)' }}
          />
          {connected ? '接続済' : '未接続'}
        </span>
        <button
          type="button"
          data-testid="mcp-attach-toggle"
          data-server-id={server.id}
          data-on={attached ? '1' : '0'}
          onClick={toggleAttach}
          className="flex"
          aria-label={attached ? 'attach 解除' : 'attach する'}
        >
          <span
            className={`relative h-[18px] w-[32px] rounded-full transition-colors ${attached ? 'bg-accent' : 'bg-border'}`}
          >
            <span
              className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all"
              style={{ left: attached ? 16 : 2 }}
            />
          </span>
        </button>
      </div>

      {attached && open && hasToolList && (
        <div className="bg-card-hi px-[14px] pb-[12px] pl-[50px] pt-[4px]">
          <button
            type="button"
            onClick={() => (head === 'on' ? onSetSubset([]) : onSetAll())}
            className="mb-[2px] flex w-full items-center gap-[8px] py-[6px]"
          >
            <Checkbox state={head} />
            <span className="text-[10px] font-bold uppercase tracking-[0.4px] text-subtle">すべてのツール</span>
            <span className="flex-1" />
            <span className="font-mono text-[9.5px] text-subtle">tools/list 由来</span>
          </button>
          {(server.tools ?? []).map((t) => {
            const on = enabled.has(t.name);
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => toggleTool(t.name)}
                className="flex w-full items-center gap-[10px] py-[5px] text-left"
              >
                <Checkbox state={on ? 'on' : 'off'} />
                <code className={`font-mono text-[11px] text-text ${on ? 'font-semibold' : 'font-medium'}`}>
                  {t.name}
                </code>
                <span className="flex-1 truncate text-right text-[10px] text-muted">{t.description}</span>
              </button>
            );
          })}
        </div>
      )}

      {attached && !hasToolList && (
        <div className="bg-card-hi px-[14px] pb-[10px] pl-[50px] pt-[2px] text-[9.5px] leading-[1.5] text-subtle">
          全ツールが対象です。Plugin Config でこのサーバーの「ツール取得」を行うと、ツール単位で選べます。
        </div>
      )}
    </div>
  );
}

function Checkbox({ state }: { state: 'on' | 'off' | 'indeterminate' }): JSX.Element {
  return (
    <span
      className={`flex h-[15px] w-[15px] flex-none items-center justify-center rounded border-[1.5px] ${
        state === 'off' ? 'border-border bg-card' : 'border-accent bg-accent'
      }`}
    >
      {state === 'on' && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <path d="M1.5 4.5l2 2L7.5 2" />
        </svg>
      )}
      {state === 'indeterminate' && <span className="h-[1.6px] w-[7px] bg-white" />}
    </span>
  );
}

type Ico = SVGProps<SVGSVGElement>;
function PlugIcon(p: Ico): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 2v3.5M10 2v3.5" />
      <rect x="4" y="5.5" width="8" height="4" rx="1.2" />
      <path d="M8 9.5v2.5a2 2 0 002 2h1.5" />
    </svg>
  );
}
function ChevronIcon(p: Ico): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}
