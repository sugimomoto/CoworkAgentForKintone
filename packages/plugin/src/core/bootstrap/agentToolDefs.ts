// Cowork Agent for kintone — Agent ツール定義の共有プリミティブ
//
// Default Agent と Built-in Agent の両解決パスが共有する定数・Custom Tool 定義・
// MCP サーバー構築を 1 箇所に集約する (resolveAgent / resolveBuiltInAgents から参照)。
// builtInAgents には依存しない (循環回避)。

/** kintone MCP server の name (mcp_servers と mcp_toolset で参照される識別子) */
export const KINTONE_MCP_SERVER_NAME = 'kintone';

/**
 * MCP toolset で公開するツール名一覧 (configs を per-tool で指定するため)。
 *
 * 真のソースは [packages/kintone-mcp/src/tools/index.ts](../../../../kintone-mcp/src/tools/index.ts) の
 * `TOOL_NAMES`。プラグインは別バンドルなので import せず手動同期する。ツール追加時は両方を更新すること。
 */
export const KINTONE_TOOL_NAMES = [
  'kintone-get-apps',
  'kintone-get-app',
  'kintone-get-form-fields',
  'kintone-get-records',
  'kintone-add-record',
  'kintone-add-records',
  'kintone-update-record',
  'kintone-update-records',
  'kintone-delete-records',
  'kintone-add-record-comment',
  // プロセス管理 (ワークフロー, #22)
  'kintone-update-record-status',
  'kintone-update-records-statuses',
  'kintone-update-record-assignees',
] as const;

/**
 * 破壊的 (= 復元不能) なツール。これだけは `always_ask` で UI 承認を要求する。
 * update / add / comment はやり直しが効くので `always_allow` のままでよい。
 */
export const DESTRUCTIVE_TOOL_NAMES = new Set<string>(['kintone-delete-records']);

/**
 * `propose_agent` Custom Tool 定義 — エージェントデザイナー (#48) 専用。
 * LLM がインタビュー完了時に 1 度だけ呼ぶ。Plugin 側で受領すると:
 *   1. chatStore.pendingAgentProposal にセット → ChatPanel が AgentDetailModal を開く
 *   2. kind='agent-draft' アーティファクトを生成して履歴に残す
 *   3. tool_result は `{ success: true }` で返し LLM のクロージング発話につなぐ
 * 仕様: .steering/20260607-agent-designer-builtin/design.md §3.1
 */
export const PROPOSE_AGENT_TOOL_NAME = 'propose_agent';

export const PROPOSE_AGENT_TOOL = {
  type: 'custom',
  name: PROPOSE_AGENT_TOOL_NAME,
  description:
    'インタビュー完了後、ユーザーが Cowork Agent に新たに登録すべき' +
    'エージェント設計案を提出する。呼出と同時に作成画面 (admin 用モーダル) が' +
    '全項目入力済の状態で開かれる。1 セッションで複数回呼ぶことは想定しない。',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'エージェント表示名 (10〜20 字)' },
      description: { type: 'string', description: '1 行説明 (20〜35 字)' },
      iconKind: {
        type: 'string',
        enum: ['biz', 'cust', 'dev', 'analytics', 'mail', 'calendar', 'ops', 'ai', 'doc'],
      },
      iconColor: {
        type: 'string',
        enum: ['teal', 'emerald', 'amber', 'rose', 'indigo', 'slate', 'sky', 'fuchsia'],
      },
      model: { type: 'string', enum: ['opus', 'sonnet'] },
      systemPrompt: {
        type: 'string',
        description: 'エージェント本体の system prompt 全文 (テンプレ非推奨)',
      },
      quickActions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 4,
        maxItems: 5,
        description: 'PresetAgentLanding に並ぶ 1 クリック実行ボタンの文言',
      },
      enabledTools: {
        type: 'array',
        items: { type: 'string' },
        description: 'kintone MCP ツール名。get 系を基本、書込が必要なときのみ追加',
      },
      anthropicSkillIds: {
        type: 'array',
        items: { type: 'string', enum: ['xlsx', 'docx', 'pdf', 'pptx'] },
        description: '出力形式に応じて attach する Anthropic 製 skill',
      },
      rationale: {
        type: 'string',
        description: 'この設計に至った理由 (3〜5 文)。業務文脈で書く',
      },
    },
    required: [
      'name',
      'description',
      'iconKind',
      'iconColor',
      'model',
      'systemPrompt',
      'quickActions',
      'enabledTools',
      'anthropicSkillIds',
      'rationale',
    ],
  },
} as const;

/**
 * `create_artifact` Custom Tool 定義 (Anthropic Managed Agents 形式)。
 * Plugin 側で `agent.custom_tool_use` を観測したら chatStore に Artifact を upsert し、
 * `user.custom_tool_result` を返すことでターンを継続させる。
 */
export const CREATE_ARTIFACT_TOOL = {
  type: 'custom',
  name: 'create_artifact',
  description:
    '再利用可能な成果物 (レポート / コード / データ / グラフ) を作成・更新する。' +
    'ユーザーがコピー・参照・保存したい内容はここに渡すこと。同じ id を再度渡すと更新になる。',
  input_schema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: '安定識別子 (英小文字+ハイフン推奨)。同 id で再呼出すると更新扱い。',
      },
      kind: {
        type: 'string',
        enum: ['markdown', 'code', 'json', 'react', 'mermaid', 'svg', 'html', 'csv'],
        description:
          'markdown=レポート / code=コード片 / json=構造化データ / ' +
          'react=React コンポーネント (Recharts 利用可) / mermaid=フロー/ER 図 / ' +
          'svg=SVG 画像 / html=HTML プレビュー / csv=表形式データ。' +
          'xlsx/docx/pptx/pdf 等のバイナリは create_artifact ではなく /workspace/ にファイル出力すること',
      },
      title: { type: 'string', description: 'ユーザー向け表示名' },
      language: {
        type: 'string',
        description: 'kind=code 時の言語ヒント (例: javascript, python, sql)',
      },
      content: { type: 'string', description: '本体テキスト' },
      summary: { type: 'string', description: '1 行の要約 (任意)' },
    },
    required: ['id', 'kind', 'title', 'content'],
  },
} as const;

/** 通知 MCP server の name (mcp_servers と mcp_toolset で参照される識別子, #13) */
export const NOTIFY_MCP_SERVER_NAME = 'notify';

/**
 * 通知 MCP toolset (`send_notification`)。built-in / custom を問わず全 Agent に常設する (#13)。
 * Webhook 未登録の Agent では Worker が「未設定」を返すだけなので無害。
 * notify server には send_notification しか無いため、configs は付けず default_config で全公開する。
 */
export function buildNotifyToolset(): Record<string, unknown> {
  return {
    type: 'mcp_toolset',
    mcp_server_name: NOTIFY_MCP_SERVER_NAME,
    default_config: {
      enabled: true,
      permission_policy: { type: 'always_allow' },
    },
  };
}

/**
 * 通知 MCP サーバーの URL を組み立てる (`<workerUrl>/notify/<kintoneDomain>/<notifyKey>`)。
 * static_bearer credential の `mcp_server_url` と **完全一致** させる必要がある
 * (一致しないと Anthropic が Bearer を注入しない)。
 */
export function buildNotifyMcpUrl(
  workerUrl: string,
  kintoneDomain: string,
  notifyKey: string,
): string {
  return `${workerUrl.replace(/\/$/, '')}/notify/${kintoneDomain}/${notifyKey}`;
}

/** kintone MCP サーバー定義を組み立てる (`<workerUrl>/mcp/<kintoneDomain>`)。
 *  notifyKey 指定時は通知 MCP サーバー (`/notify/<domain>/<key>`) も併せて公開する (#13)。 */
export function buildMcpServers(
  workerUrl: string,
  kintoneDomain: string,
  notifyKey?: string,
): Array<Record<string, unknown>> {
  const url = `${workerUrl.replace(/\/$/, '')}/mcp/${kintoneDomain}`;
  const servers: Array<Record<string, unknown>> = [
    {
      type: 'url',
      name: KINTONE_MCP_SERVER_NAME,
      url,
    },
  ];
  if (notifyKey) {
    servers.push({
      type: 'url',
      name: NOTIFY_MCP_SERVER_NAME,
      url: buildNotifyMcpUrl(workerUrl, kintoneDomain, notifyKey),
    });
  }
  return servers;
}
