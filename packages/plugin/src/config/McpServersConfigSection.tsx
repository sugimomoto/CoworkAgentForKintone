// #42 M1: Plugin Config に追加する「MCP サーバー」カタログ管理セクション（admin・テナント共有）。
// 既存 ConfigScreen に増設（案A）。セットアップ・ウィザードとは独立した継続 CRUD ゾーン。
//
// - 登録済みサーバー定義（mcpServers）の一覧 + 追加 / 編集 / 削除。
// - client_secret は config に保存せず、OAuth confidential(basic) のとき setProxyConfig で per-server 注入。
// - 保存は getConfig をマージして setConfig（workerUrl 等を壊さない）。

import { useEffect, useState } from 'react';

import { PLUGIN_CONFIG_KEYS, serializeMcpServers } from '../core/kintone/pluginConfig';
import { setProxyConfigAsync } from '../core/kintone/setProxyConfigAsync';
import { fetchMcpToolsViaOAuth } from '../core/mcp/connectMcpOAuth';
import {
  MCP_AUTH,
  TOKEN_AUTH,
  buildRedirectUri,
  canSaveServerDef,
  isHttpsUrl,
  needsClientSecret,
  type McpAuthType,
  type McpServerDef,
  type McpTool,
  type TokenEndpointAuthType,
} from '../core/mcp/registry';
import { fetchMcpTools } from '../core/mcp/toolsList';
import { sleep, toErrorMessage } from '../core/utils';
import { PasswordInput } from '../desktop/components/ui/PasswordInput';

import { buildMcpProxySteps } from './buildMcpProxySteps';

const PROXY_STEP_DELAY_MS = 700;

// confidential のツール取得で保存済み client_secret を読み戻せなかったときの sentinel。
// これを受けた行 UI は secret 入力欄にフォールバックする（入力値は直接 token 交換に使う）。
const NEED_CLIENT_SECRET = 'NEED_CLIENT_SECRET';

export interface McpServersConfigSectionProps {
  pluginId: string;
  /** Worker URL（redirect_uri 表示 + per-server upsert proxy 登録に使う）。未設定なら OAuth 登録は不可。 */
  workerUrl: string | null;
  initialServers: McpServerDef[];
}

interface Draft {
  id: string;
  name: string;
  url: string;
  authType: McpAuthType;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scope: string;
  tokenEndpointAuthType: TokenEndpointAuthType;
  hasSecret: boolean;
  /** 入力中の client_secret（保存時のみ proxy 注入。state にだけ一時保持）。 */
  clientSecret: string;
}

function emptyDraft(): Draft {
  return {
    id: '',
    name: '',
    url: '',
    authType: 'none',
    authorizationEndpoint: '',
    tokenEndpoint: '',
    clientId: '',
    scope: '',
    tokenEndpointAuthType: 'none',
    hasSecret: false,
    clientSecret: '',
  };
}

function draftFromDef(d: McpServerDef): Draft {
  return {
    id: d.id,
    name: d.name,
    url: d.url,
    authType: d.authType,
    authorizationEndpoint: d.authorizationEndpoint ?? '',
    tokenEndpoint: d.tokenEndpoint ?? '',
    clientId: d.clientId ?? '',
    scope: d.scope ?? '',
    tokenEndpointAuthType: d.tokenEndpointAuthType ?? 'none',
    hasSecret: d.hasSecret ?? false,
    clientSecret: '',
  };
}

function slugId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
  return `mcp-${base || 'server'}-${Date.now().toString(36)}`;
}

function draftToDef(d: Draft): McpServerDef {
  const def: McpServerDef = {
    id: d.id || slugId(d.name),
    name: d.name.trim(),
    url: d.url.trim(),
    authType: d.authType,
  };
  if (d.authType === 'oauth') {
    def.authorizationEndpoint = d.authorizationEndpoint.trim();
    def.tokenEndpoint = d.tokenEndpoint.trim();
    def.clientId = d.clientId.trim();
    if (d.scope.trim()) def.scope = d.scope.trim();
    def.tokenEndpointAuthType = d.tokenEndpointAuthType;
    def.hasSecret = d.hasSecret || d.clientSecret.trim().length > 0;
  }
  return def;
}

export function McpServersConfigSection({
  pluginId,
  workerUrl,
  initialServers,
}: McpServersConfigSectionProps): JSX.Element {
  const [servers, setServers] = useState<McpServerDef[]>(initialServers);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 保存/削除はこの欄だけで即時 setConfig される（他の項目と挙動が異なる）。
  // 「保存された」ことが分かるよう、成功時に一時メッセージを出す。
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!savedMsg) return;
    const t = setTimeout(() => setSavedMsg(null), 4000);
    return () => clearTimeout(t);
  }, [savedMsg]);

  const workerRootUrl = workerUrl ? `${workerUrl.replace(/\/$/, '')}/` : '';
  const redirectUri = workerUrl ? buildRedirectUri(workerUrl) : '';
  const isEditing = draft !== null;
  const editingExisting = isEditing && draft!.id !== '' && servers.some((s) => s.id === draft!.id);

  const draftValid =
    draft !== null &&
    canSaveServerDef({
      ...draftToDef(draft),
      _secretEntered: draft.clientSecret.trim().length > 0,
      hasSecret: draft.hasSecret,
    }) &&
    // OAuth は Worker URL（redirect/secret proxy）が前提
    (draft.authType !== 'oauth' || workerUrl !== null);

  // 「保存してツールを取得」を出せる条件（bearer はフォームにトークンが無いので対象外）:
  //   none / oauth public は無条件、oauth confidential は secret がメモリにある（入力済み）とき。
  const canSaveAndFetch =
    draftValid &&
    draft !== null &&
    (draft.authType === 'none' ||
      (draft.authType === 'oauth' &&
        (draft.tokenEndpointAuthType === 'none' || draft.clientSecret.trim().length > 0)));

  async function persist(next: McpServerDef[], secretDraft: Draft | null): Promise<void> {
    if (typeof kintone === 'undefined' || !kintone) return;
    const k = kintone; // await をまたぐと global の絞り込みが解けるためキャプチャ
    // OAuth の token_endpoint 等に per-server proxy を登録（ランタイムの kintone.plugin.app.proxy 用）。
    // - public(PKCE): Content-Type だけ登録（secret 不要）。これが無いと runtime で Content-Type が
    //   付かず token エンドポイントがボディを解釈できず invalid_grant になる。
    // - confidential(basic): Basic + per-server upsert URL（Anthropic キーを getProxyConfig で読戻し同梱）。
    // secret 入力が無い confidential の再保存では buildMcpProxySteps が [] を返し、既存登録を保つ。
    if (secretDraft && workerRootUrl && draftToDef(secretDraft).authType === 'oauth') {
      const anthropicApiKey =
        k.plugin.app.getProxyConfig?.(workerRootUrl, 'POST')?.headers?.['X-Anthropic-Api-Key'] ?? '';
      const steps = buildMcpProxySteps({
        server: draftToDef(secretDraft),
        clientSecret: secretDraft.clientSecret.trim(),
        anthropicApiKey,
        workerRootUrl,
      });
      for (const step of steps) {
        await setProxyConfigAsync(step.url, step.method, step.headers, {});
        await sleep(PROXY_STEP_DELAY_MS);
      }
    }
    const existing = k.plugin.app.getConfig(pluginId) ?? {};
    await new Promise<void>((resolve) => {
      k.plugin.app.setConfig(
        { ...existing, [PLUGIN_CONFIG_KEYS.MCP_SERVERS]: serializeMcpServers(next) },
        () => resolve(),
      );
    });
  }

  // 保存フォーム内でその場ツール取得（cfDeploy と同型）。secret がまだ draft にある間に
  // in-memory の値で token 交換 → tools/list。proxyConfig の読み戻し/デプロイ反映に依存しない。
  // oauth の場合は認可 popup が走るので OAuth 疎通確認も兼ねる。bearer はフォームにトークンが
  // 無いため対象外（行の「ツール取得」で入力する）。
  async function probeToolsForDraft(def: McpServerDef, clientSecret: string): Promise<McpTool[]> {
    if (def.authType === 'oauth') {
      if (!workerUrl) throw new Error('Worker URL が未設定です');
      return fetchMcpToolsViaOAuth({ workerUrl, server: def, ...(clientSecret ? { clientSecret } : {}) });
    }
    return fetchMcpTools({ url: def.url }); // none
  }

  async function handleSave(alsoFetchTools = false): Promise<void> {
    if (!draft || !draftValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      let def = draftToDef(draft);
      if (alsoFetchTools) {
        const tools = await probeToolsForDraft(def, draft.clientSecret);
        def = { ...def, tools };
      }
      const next = editingExisting
        ? servers.map((s) => (s.id === def.id ? def : s))
        : [...servers, def];
      await persist(next, draft);
      setServers(next);
      setDraft(null);
      setSavedMsg(
        alsoFetchTools
          ? `「${def.name}」を保存し、ツールを ${def.tools?.length ?? 0} 件取得しました`
          : `「${def.name}」を保存しました`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (saving) return;
    if (!window.confirm('この MCP サーバー定義を削除しますか？（接続済みユーザーは再接続できなくなります）')) return;
    setSaving(true);
    setError(null);
    try {
      const removed = servers.find((s) => s.id === id);
      const next = servers.filter((s) => s.id !== id);
      await persist(next, null);
      setServers(next);
      if (draft?.id === id) setDraft(null);
      setSavedMsg(removed ? `「${removed.name}」を削除しました` : '削除しました');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // confidential(basic) の client_secret は保存時に per-server proxy へ登録済み。
  // 設定画面では getProxyConfig で伏字なしに読み戻せる（Anthropic キーと同じ流儀・再入力不要）。
  // 2 経路を試す:
  //   ① per-server upsert URL の X-Mcp-OAuth-Client-Secret（worker のサブパス）
  //   ② token_endpoint の Authorization: Basic をデコード（別ホストなので独立に読める）
  // サブパスが親プレフィックスに吸収されて読めない環境でも ② で復元できる。
  function readStoredClientSecret(server: McpServerDef): { secret: string; diag: string } {
    if (typeof kintone === 'undefined' || !kintone) return { secret: '', diag: 'kintone 不在' };
    if (!workerRootUrl) return { secret: '', diag: 'workerUrl 未設定' };
    const gpc = kintone.plugin.app.getProxyConfig;
    if (!gpc) return { secret: '', diag: 'getProxyConfig 使用不可' };

    const upsertUrl = `${workerRootUrl}credentials/upsert/${server.id}`;
    const up = gpc(upsertUrl, 'POST');
    let secret = up?.headers?.['X-Mcp-OAuth-Client-Secret'] ?? '';

    // ② token_endpoint の Basic から復元
    let tokDiag = 'n/a';
    if (!secret && server.tokenEndpoint) {
      const tok = gpc(server.tokenEndpoint, 'POST');
      const authz = tok?.headers?.['Authorization'] ?? tok?.headers?.['authorization'] ?? '';
      tokDiag = tok ? `登録あり[${Object.keys(tok.headers ?? {}).join('|') || '空'}]` : '登録なし';
      if (authz.startsWith('Basic ')) {
        try {
          const dec = atob(authz.slice(6)); // clientId:clientSecret
          const i = dec.indexOf(':');
          if (i >= 0) secret = dec.slice(i + 1);
        } catch {
          /* base64 でない場合は無視 */
        }
      }
    }

    const upKeys = up?.headers ? Object.keys(up.headers).join('|') || '(空)' : '(登録なし)';
    const rootKey = gpc(workerRootUrl, 'POST')?.headers?.['X-Anthropic-Api-Key'] ? '読める' : '読めない';
    return {
      secret,
      diag: `upsert=${up ? 'あり' : 'なし'}[${upKeys}] / token_endpoint=${tokDiag} / root.Anthropic=${rootKey}`,
    };
  }

  // ツール一覧を tools/list で取得してカタログ（McpServerDef.tools）に保存する。
  // none=トークン不要 / bearer=admin が一度トークンを入れる（保存はしない） / oauth=1回認可（使い捨て）。
  // confidential(basic) は保存済み client_secret を getProxyConfig で読み戻して使う（再入力不要）。
  async function fetchAndSaveTools(server: McpServerDef, secret?: string): Promise<McpTool[]> {
    let tools: McpTool[];
    if (server.authType === 'oauth') {
      if (!workerUrl) throw new Error('Worker URL が未設定です');
      let clientSecret = secret;
      if (!clientSecret && server.tokenEndpointAuthType === 'basic') {
        // まず保存済み secret の読み戻しを試す（再入力不要の速い経路）。
        // 読み戻せない（proxy 未登録 / 未デプロイ等）ときは診断付きで行 UI に返す。
        const r = readStoredClientSecret(server);
        clientSecret = r.secret;
        if (!clientSecret) throw new Error(`${NEED_CLIENT_SECRET}: ${r.diag}`);
      }
      tools = await fetchMcpToolsViaOAuth({ workerUrl, server, ...(clientSecret ? { clientSecret } : {}) });
    } else {
      tools = await fetchMcpTools({ url: server.url, ...(secret ? { bearerToken: secret } : {}) });
    }
    const next = servers.map((s) => (s.id === server.id ? { ...s, tools } : s));
    await persist(next, null);
    setServers(next);
    setSavedMsg(`「${server.name}」のツールを ${tools.length} 件取得しました`);
    return tools;
  }

  return (
    <section className="mb-[20px] rounded-[12px] border border-card-border bg-card p-[16px]">
      <h2 className="mb-[4px] text-[14px] font-semibold">追加 MCP サーバー</h2>
      <p className="mb-[8px] text-[11px] leading-[1.6] text-muted">
        kintone 以外のリモート MCP サーバーをテナント共有で登録します。各ユーザーは Chat Panel の設定 → MCP から
        自分のアカウントで接続します。
      </p>
      <p className="mb-[10px] rounded-[6px] bg-bg px-[10px] py-[7px] text-[10.5px] leading-[1.6] text-subtle">
        ※ この欄の <strong>追加・更新・削除はボタンを押した時点で即時保存</strong>されます（画面下部の保存ボタンとは独立）。
        各ユーザーの画面に反映するには、保存後に <strong>アプリの更新（運用環境へ反映）</strong> が必要です。
      </p>

      {savedMsg && (
        <p
          data-testid="mcp-saved-msg"
          className="mb-[10px] rounded-[8px] border border-ok/30 bg-ok-soft px-[12px] py-[8px] text-[11px] font-medium text-ok"
        >
          ✓ {savedMsg}
        </p>
      )}

      {/* 一覧 */}
      {servers.length === 0 ? (
        <p className="mb-[10px] rounded-[8px] bg-bg px-[12px] py-[10px] text-[11px] text-subtle">
          まだ登録がありません。
        </p>
      ) : (
        <ul className="mb-[10px] flex flex-col gap-[6px]">
          {servers.map((s) => (
            <ServerRow
              key={s.id}
              server={s}
              workerReady={s.authType !== 'oauth' || workerUrl !== null}
              onEdit={() => setDraft(draftFromDef(s))}
              onDelete={() => void handleDelete(s.id)}
              onFetchTools={(token) => fetchAndSaveTools(s, token)}
            />
          ))}
        </ul>
      )}

      {!isEditing && (
        <button
          type="button"
          data-testid="mcp-add-button"
          onClick={() => setDraft(emptyDraft())}
          className="rounded-[8px] bg-accent px-[12px] py-[7px] text-[12px] font-semibold text-white disabled:opacity-50"
        >
          + MCP サーバーを追加
        </button>
      )}

      {/* 追加 / 編集フォーム */}
      {draft && (
        <div className="mt-[12px] rounded-[10px] border border-card-border bg-bg p-[12px]">
          <McpField label="表示名">
            <input
              data-testid="mcp-name-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] text-[12px] text-text outline-none focus:border-accent"
            />
          </McpField>
          <McpField label="サーバー URL (https)">
            <input
              data-testid="mcp-url-input"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://example.com/mcp"
              spellCheck={false}
              className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] font-mono text-[12px] text-text outline-none focus:border-accent"
            />
            {draft.url.length > 0 && !isHttpsUrl(draft.url) && (
              <p className="mt-[2px] text-[10.5px] text-warn">https:// の URL を入力してください</p>
            )}
          </McpField>
          <McpField label="認証方式">
            <div className="flex gap-[4px]">
              {(['none', 'bearer', 'oauth'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft({ ...draft, authType: t })}
                  className={`flex-1 rounded-[6px] border px-[8px] py-[6px] text-[11px] ${
                    draft.authType === t
                      ? 'border-accent bg-accent text-white'
                      : 'border-card-border bg-card text-muted'
                  }`}
                >
                  {MCP_AUTH[t].short}
                </button>
              ))}
            </div>
          </McpField>

          {draft.authType === 'oauth' && (
            <div className="mt-[8px] rounded-[8px] border border-accent/30 p-[10px]">
              {workerUrl === null && (
                <p className="mb-[8px] rounded-[6px] bg-warn-soft px-[8px] py-[6px] text-[10.5px] text-warn">
                  OAuth 登録には Step 1 の Worker URL が必要です。
                </p>
              )}
              <McpField label="authorization_endpoint">
                <input
                  data-testid="mcp-oauth-authz"
                  value={draft.authorizationEndpoint}
                  onChange={(e) => setDraft({ ...draft, authorizationEndpoint: e.target.value })}
                  spellCheck={false}
                  className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] font-mono text-[11.5px] text-text outline-none focus:border-accent"
                />
              </McpField>
              <McpField label="token_endpoint">
                <input
                  data-testid="mcp-oauth-token"
                  value={draft.tokenEndpoint}
                  onChange={(e) => setDraft({ ...draft, tokenEndpoint: e.target.value })}
                  spellCheck={false}
                  className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] font-mono text-[11.5px] text-text outline-none focus:border-accent"
                />
              </McpField>
              <McpField label="client_id">
                <input
                  data-testid="mcp-oauth-clientid"
                  value={draft.clientId}
                  onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
                  spellCheck={false}
                  className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] font-mono text-[11.5px] text-text outline-none focus:border-accent"
                />
              </McpField>
              <McpField label="scope (任意)">
                <input
                  value={draft.scope}
                  onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                  spellCheck={false}
                  className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] font-mono text-[11.5px] text-text outline-none focus:border-accent"
                />
              </McpField>
              <McpField label="client 認証方式">
                <select
                  data-testid="mcp-oauth-authtype"
                  value={draft.tokenEndpointAuthType}
                  onChange={(e) =>
                    setDraft({ ...draft, tokenEndpointAuthType: e.target.value as TokenEndpointAuthType })
                  }
                  className="w-full rounded-[7px] border border-card-border bg-card px-[10px] py-[7px] text-[12px] text-text"
                >
                  <option value="none">{TOKEN_AUTH.none.label}</option>
                  <option value="basic">{TOKEN_AUTH.basic.label}</option>
                </select>
                <p className="mt-[2px] text-[10.5px] text-subtle">
                  {TOKEN_AUTH[draft.tokenEndpointAuthType]?.hint}
                </p>
              </McpField>
              {needsClientSecret(draftToDef(draft)) && (
                <McpField label={`client_secret${draft.hasSecret ? '（保存済み・再入力で更新）' : ''}`}>
                  <PasswordInput
                    id="mcp-oauth-secret"
                    value={draft.clientSecret}
                    onChange={(v) => setDraft({ ...draft, clientSecret: v })}
                    placeholder={draft.hasSecret ? '●●●●●●●● (再入力で更新)' : ''}
                  />
                </McpField>
              )}
              {redirectUri && (
                <McpField label="リダイレクト URI（OAuth アプリに登録）">
                  <code className="block truncate rounded-[6px] bg-card px-[8px] py-[6px] font-mono text-[10.5px] text-muted">
                    {redirectUri}
                  </code>
                </McpField>
              )}
            </div>
          )}

          {error && <p className="mt-[8px] text-[11px] text-warn">⚠ {error}</p>}

          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            <button
              type="button"
              data-testid="mcp-save-button"
              onClick={() => void handleSave()}
              disabled={!draftValid || saving}
              className="rounded-[7px] bg-accent px-[12px] py-[6px] text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? '保存中…' : editingExisting ? '更新' : '追加'}
            </button>
            {canSaveAndFetch && (
              <button
                type="button"
                data-testid="mcp-save-fetch-button"
                onClick={() => void handleSave(true)}
                disabled={saving}
                className="rounded-[7px] border border-accent bg-accent-soft px-[12px] py-[6px] text-[12px] font-semibold text-accent disabled:opacity-50"
              >
                {saving ? '処理中…' : draft?.authType === 'oauth' ? '保存して認可 → ツール取得' : '保存してツールを取得'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="rounded-[7px] border border-card-border px-[12px] py-[6px] text-[12px] text-muted"
            >
              キャンセル
            </button>
          </div>
          {draft?.authType === 'oauth' && (
            <p className="mt-[6px] text-[10.5px] leading-[1.5] text-subtle">
              「保存して認可 → ツール取得」を押すと、いま入力した client_secret を使って認可・token 交換・ツール取得まで一度に行います（OAuth 疎通確認を兼ねます）。
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// 一覧の 1 行。ツール取得（カタログへの tools/list キャッシュ）導線を内包する。
function ServerRow({
  server,
  workerReady,
  onEdit,
  onDelete,
  onFetchTools,
}: {
  server: McpServerDef;
  workerReady: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFetchTools: (bearerToken?: string) => Promise<McpTool[]>;
}): JSX.Element {
  const meta = MCP_AUTH[server.authType];
  const toolCount = server.tools?.length ?? 0;
  const [phase, setPhase] = useState<'idle' | 'token' | 'busy'>('idle');
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // bearer は取得時にトークンを一度入力する（保存しない）。
  // oauth confidential(basic) の再取得は保存済み client_secret を getProxyConfig で読み戻して使う。
  // 読み戻せないとき（NEED_CLIENT_SECRET）は入力を促さず、編集フォームの「保存して認可 → ツール取得」へ誘導する。
  const isOAuthBasic = server.authType === 'oauth' && server.tokenEndpointAuthType === 'basic';
  const inputLabel = 'API キー / トークン（取得のみに使用・保存しません）';

  async function run(secret?: string): Promise<void> {
    setPhase('busy');
    setErr(null);
    try {
      await onFetchTools(secret);
      setToken('');
      setPhase('idle');
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(NEED_CLIENT_SECRET)) {
        const diag = e.message.slice(NEED_CLIENT_SECRET.length).replace(/^:\s*/, '');
        setErr(
          `保存済みの client_secret を読み戻せませんでした（アプリ未更新の可能性）。「編集」→ client_secret を入れ直して「保存して認可 → ツール取得」を使ってください。［診断: ${diag}］`,
        );
        setPhase('idle');
        return;
      }
      setErr(toErrorMessage(e));
      setPhase(server.authType === 'bearer' ? 'token' : 'idle');
    }
  }
  const onFetchClick = (): void => {
    if (server.authType === 'bearer') setPhase('token');
    else void run(); // none / oauth（confidential は保存済み secret を読み戻し）
  };
  const fetchDisabled = phase === 'busy' || (server.authType === 'oauth' && !workerReady);

  return (
    <li className="flex flex-col gap-[6px] rounded-[8px] border border-card-border bg-bg px-[10px] py-[8px]">
      <div className="flex items-center gap-[8px]">
        <span className="flex-1 truncate">
          <span className="text-[12px] font-medium text-text">{server.name}</span>
          <span className="ml-[6px] font-mono text-[10.5px] text-muted">{server.url}</span>
        </span>
        <span
          className="rounded-[3px] px-[6px] py-[1px] text-[9.5px] font-semibold"
          style={{ background: meta.soft, color: meta.color }}
        >
          {meta.label}
        </span>
        <span
          title="カタログに保存済みのツール数（エージェント編集の絞り込みに使う）"
          className={`rounded-[3px] px-[6px] py-[1px] text-[9.5px] ${toolCount > 0 ? 'bg-ok-soft text-ok' : 'bg-card text-subtle'}`}
        >
          {toolCount > 0 ? `${toolCount} ツール` : 'ツール未取得'}
        </span>
        <button
          type="button"
          data-testid="mcp-fetch-tools-button"
          onClick={onFetchClick}
          disabled={fetchDisabled}
          className="rounded-[6px] border border-card-border px-[8px] py-[3px] text-[11px] text-muted hover:text-accent disabled:opacity-50"
        >
          {phase === 'busy' ? '取得中…' : toolCount > 0 ? 'ツール再取得' : 'ツール取得'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-[6px] border border-card-border px-[8px] py-[3px] text-[11px] text-muted hover:text-accent"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-[6px] border border-warn/40 px-[8px] py-[3px] text-[11px] text-warn hover:bg-warn-soft"
        >
          削除
        </button>
      </div>

      {server.authType === 'oauth' && !workerReady && (
        <p className="text-[10px] text-warn">ツール取得には Step 1 の Worker URL が必要です。</p>
      )}

      {phase === 'token' && (
        <div className="flex items-center gap-[6px]">
          <input
            data-testid="mcp-fetch-token-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={inputLabel}
            className="flex-1 rounded-[6px] border border-card-border bg-card px-[8px] py-[5px] font-mono text-[11px] text-text outline-none focus:border-accent"
          />
          <button
            type="button"
            data-testid="mcp-fetch-token-submit"
            onClick={() => void run(token.trim())}
            disabled={!token.trim()}
            className="rounded-[6px] bg-accent px-[10px] py-[5px] text-[11px] font-semibold text-white disabled:opacity-50"
          >
            取得
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase('idle');
              setErr(null);
            }}
            className="rounded-[6px] border border-card-border px-[10px] py-[5px] text-[11px] text-muted"
          >
            キャンセル
          </button>
        </div>
      )}

      {server.authType === 'oauth' && phase === 'idle' && (
        <p className="text-[10px] text-subtle">
          OAuth: 「ツール取得」で一度だけ認可します（トークンは保存しません）。
          {isOAuthBasic && ' confidential は保存済みの client_secret を使います（再入力不要）。'}
        </p>
      )}

      {err && <p className="text-[10.5px] text-warn">⚠ {err}</p>}
    </li>
  );
}

function McpField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-[8px]">
      <label className="mb-[3px] block text-[11px] font-medium text-text">{label}</label>
      {children}
    </div>
  );
}
