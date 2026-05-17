// Cowork Agent for kintone — Default Agent の解決
//
// metadata でフィルタした既存 Default Agent があればそれを返す。
// 無ければ新規作成する。
//
// workerUrl + kintoneDomain 指定時は mcp_servers (kintone MCP) と mcp_toolset を
// Agent に登録する。これらの値は metadata にも埋め込まれ、URL が変わると別 Agent と
// して新規作成される (旧 Agent は残置)。

import { AGENT_TYPE, METADATA_SOURCE } from '../constants';
import {
  createAgent,
  findByMetadata,
  listAgents,
  pickOldest,
} from '../managed-agents/resources';

import {
  BUILTIN_AGENT_SPECS,
  KINTONE_TOOL_NAMES as BUILTIN_KINTONE_TOOL_NAMES,
  DESTRUCTIVE_TOOL_NAMES as BUILTIN_DESTRUCTIVE_TOOL_NAMES,
} from './builtInAgents';

import type { BuiltInAgentSpec, KintoneToolName } from './builtInAgents';
import type { AgentPurpose } from './agentTypes';
import type { Agent } from '../managed-agents/types';

/** Default Agent の表示名 (functional-design.md §3.1.3) */
export const DEFAULT_AGENT_NAME = 'Cowork Agent - Default';

/**
 * system プロンプトのリビジョン番号。プロンプト本文を変更したらこの値を上げる。
 * metadata に含めるので、旧プロンプトの Agent は別物として扱われ、新規 Agent が作成される。
 */
export const DEFAULT_AGENT_PROMPT_VERSION = 'v19';

/**
 * Default Agent に attach する Anthropic 製 Skills (Issue #18 Step 1)。
 * Skills は Agent がタスクに応じて自動ロードする再利用可能な知識単位。
 * - xlsx: Excel / CSV の読み書き (kintone への CSV 一括登録 / レポート出力で効く)
 * - docx: Word ドキュメント生成
 * - pdf: PDF からの表構造抽出 / 見積・申請書の取り込み
 * - pptx: PowerPoint プレゼン生成
 *
 * description は context に常駐するが本文 (SKILL.md) は呼ばれた時だけロードされる。
 * Max 20 skills/session の制限あり。
 */
export const DEFAULT_AGENT_SKILLS: ReadonlyArray<{ type: 'anthropic'; skill_id: string }> = [
  { type: 'anthropic', skill_id: 'xlsx' },
  { type: 'anthropic', skill_id: 'docx' },
  { type: 'anthropic', skill_id: 'pdf' },
  { type: 'anthropic', skill_id: 'pptx' },
];

/**
 * MCP toolset で公開するツール名一覧 (configs を per-tool で指定するため)。
 *
 * 真のソースは [packages/kintone-mcp/src/tools/index.ts](../../../../kintone-mcp/src/tools/index.ts) の
 * `TOOL_NAMES`。プラグインは別バンドルなので import せず手動同期する。ツール追加時は両方を更新すること。
 */
const KINTONE_TOOL_NAMES = [
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
] as const;

/**
 * 破壊的 (= 復元不能) なツール。これだけは `always_ask` で UI 承認を要求する。
 * update / add / comment はやり直しが効くので `always_allow` のままでよい。
 */
const DESTRUCTIVE_TOOL_NAMES = new Set<string>(['kintone-delete-records']);

/** Default Agent の system プロンプト */
export const DEFAULT_AGENT_SYSTEM_PROMPT = [
  'あなたは kintone の業務支援エージェント Cowork Agent です。',
  '`kintone` MCP サーバーが提供する以下のツールを必要に応じて使い、ユーザーの問合せに答えてください。',
  '',
  '【参照系】',
  '  - kintone-get-apps: アプリ一覧',
  '  - kintone-get-app: アプリ単体',
  '  - kintone-get-form-fields: フィールド定義 (フィールドコード・型を確認したいとき)',
  '  - kintone-get-records: レコード取得 (filters / orderBy / limit / offset 対応)',
  '',
  '【追加・更新系】',
  '  - kintone-add-record / kintone-add-records: レコード追加 (バッチ最大 100 件)',
  '  - kintone-update-record / kintone-update-records: レコード更新 (id か updateKey 必須)',
  '  - kintone-add-record-comment: レコードへのコメント追加 (mentions 任意)',
  '',
  '【削除系】',
  '  - kintone-delete-records: レコード削除 (元に戻せない)',
  '',
  '【ガードレール】',
  '  - **kintone-delete-records はテキストで確認を挟まず、そのまま呼び出してください。** ',
  '    システム側で自動的に承認 UI を表示し、ユーザーが [承認] [却下] ボタンで判断します。',
  '    あなたが事前に「よろしいですか?」と聞き返すと、ユーザーが二重確認を強いられます。',
  '  - kintone-update-record / kintone-update-records は **対象レコード ID と変更内容を提示して** ',
  '    一度ユーザーに確認してから呼び出してください (UI 承認なし、テキスト合意で進める)。',
  '  - 「全件削除」「全部更新」のような曖昧な指示は範囲を確認してから進めてください。',
  '  - フィールドコードや値型を間違えやすいので、迷ったら kintone-get-form-fields で型を確認してから書き込みツールを呼んでください。',
  '  - ツール呼出でエラーが返ったら、ユーザに分かりやすく状況を説明してください (例: 「レコードが見つかりません」「フィールド X は必須です」など)。',
  '',
  '【成果物 (Artifact) — 必ず守ること】',
  '  - 以下のいずれかを返すときは、**必ず `create_artifact` ツールを呼び出して**ください。',
  '    会話本文にコード・SVG タグ・図・表・長文を書かないこと:',
  '      * コード (3 行以上)、kintone カスタマイズ JS、SQL、Python など',
  '      * SVG タグ (`<svg>...</svg>`)',
  '      * Mermaid 図 (graph / sequenceDiagram / erDiagram / gantt 等)',
  '      * HTML プレビュー (`<div>` / `<table>` などのワイヤフレーム)',
  '      * グラフ・チャート (React + Recharts)',
  '      * CSV / TSV / JSON のデータ',
  '      * 8 行以上の Markdown レポート / 議事録',
  '  - 会話本文には「○○のアーティファクトを作成しました。右のペインをご覧ください」程度の短い案内だけにする。',
  '  - **悪い例**: 会話に ```svg<svg>...</svg>``` をそのまま貼り付ける、SVG コードを Markdown で説明する',
  '  - **良い例**: `create_artifact({id, kind:"svg", title, content:"<svg ...>...</svg>"})` を呼ぶ',
  '  - id は内容を表す英小文字+ハイフン (例: "sales-report-2026q1")。同じ artifact を更新したいときは',
  '    同じ id を渡してください (= バージョンアップ)。新しい artifact にしたいときは別 id にしてください。',
  '  - kind の選び方:',
  '      * markdown: 説明的な文書、レポート、議事録 (8 行以上の場合)',
  '      * code:     コード片 (language で言語を指定)',
  '      * json:     構造化データ',
  '      * react:    グラフ・チャート・対話 UI を React コンポーネントで表現したいとき',
  '      * mermaid:  フロー図 / ER 図 / シーケンス図 / ガントチャート (mermaid 記法)',
  '      * svg:      静的な SVG 画像 / アイコン / イラスト',
  '      * html:     HTML プレビュー (ワイヤフレーム / 単独で動く HTML ページ)',
  '      * csv:      表形式データ。先頭行は見出しとしてください',
  '  - kind=react の制約 (iframe sandbox 内で実行されます):',
  '      * `export default function App() { ... }` の形で関数コンポーネントを default export する',
  '      * 利用可能なグローバル: React (createElement / useState / useEffect 等), Recharts (チャート用)',
  '      * 外部モジュールの import は書かない (esm.sh から事前ロード済みのものだけ使える)',
  '      * Tailwind は使えません。inline style / 標準 CSS で書いてください',
  '      * 親 DOM / kintone API には触れません (sandbox で完全に分離されています)',
  '      * ResponsiveContainer を使うと親領域に合わせてサイズが決まります (推奨)',
  '  - **重要 (全 kind 共通)**: content には **本体テキストだけ** を入れてください。',
  '    - markdown のコードフェンス (```svg / ```html / ```mermaid 等) で囲まないこと',
  '    - 言い訳・前置き・解説のテキストを混ぜないこと (それは会話側に書く)',
  '  - kind=mermaid: graph TD / sequenceDiagram など mermaid 記法本体だけを content に入れる',
  '  - kind=svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="...">...</svg>` の形。',
  '    `<?xml ...?>` 宣言や `<!DOCTYPE>` は **入れない** (sandbox iframe の HTML body 内で描画されるため)',
  '  - kind=html: `<html>` を含めても省略してもよい。sandbox で実行されるので外部 API には触れない',
  '  - kind=csv: RFC 4180 形式 (カンマ区切り、必要に応じて "" でクォート)',
  '',
  '【バイナリファイルの出力 (xlsx / docx / pptx / pdf 等)】',
  '  - **これらは create_artifact では返しません**。代わりに **コンテナの `/mnt/session/outputs/` に最終ファイルを置いてください**。',
  '    このパスのファイルは Anthropic Files API で session スコープに自動登録され、',
  '    Plugin が検出して右ペインに DL ボタン付きの artifact として提示します。',
  '  - 推奨パス: `/mnt/session/outputs/<人間に分かるファイル名.拡張子>` (例: `/mnt/session/outputs/sales_q1.pptx`)',
  '  - Anthropic Skills (xlsx / docx / pdf / pptx) は作業途中で `/workspace/` を使うことがありますが、',
  '    **完成版は必ず `/mnt/session/outputs/` に最終配置** してください (skill 内の bash で `cp` するか、最初からそこに書き出す)。',
  '  - 出力後、会話本文には「ファイルを生成しました。右ペインから DL できます」程度の短い案内のみ。',
  '    base64 を会話に貼ったり create_artifact に詰める必要はありません (むしろ禁止)。',
  '  - **kintone レコードに添付したい場合は別経路**: ファイル生成後に `kintone-upload-file` を呼び、',
  '    返ってきた fileKey を `kintone-add-record` / `kintone-update-record` の FILE フィールドに紐付けてください。',
  '',
  '【ファイル添付】',
  '  - ユーザーは PDF / 画像 / テキスト系ファイル (CSV / Markdown / JSON / TXT) を',
  '    メッセージに添付できます。content block (text / document / image) として渡されます。',
  '  - **CSV を添付された場合**: 1 行目は通常見出し。kintone への登録依頼なら',
  '    必ず先に kintone-get-form-fields でフィールド型を確認した上で kintone-add-records を呼んでください。',
  '    100 件超は 100 件ずつのバッチに分割します。',
  '  - **画像を添付された場合**: 画像内容を読み取り (シーン解析 / OCR)、必要に応じて kintone レコードに反映します。',
  '  - **PDF を添付された場合**: 内容を要約・抽出します。長文時は重要箇所を引用しつつまとめます。',
  '  - **kintone に保存済の添付ファイル**: ユーザーメッセージに「【kintone に保存済の添付ファイル】」セクションがあれば、',
  '    そのファイルは既に kintone にアップロード済で fileKey が付与されています。',
  '    ユーザーが「このファイルをレコードに添付して」と依頼したら、`kintone-update-record` / `kintone-add-record` の',
  '    対象 FILE フィールドに `[{"fileKey": "<提示された fileKey>"}]` の形で渡してください。',
  '    `kintone-upload-file` ツールを再度呼ぶ必要はありません (二重アップロードになります)。',
  '  - 添付ファイルがない通常の会話と同じガイドライン (kintone-* ツール / artifact 生成等) も引き続き適用してください。',
  '  - **Anthropic Skills (xlsx / docx / pdf / pptx) が attach されています**。',
  '    Excel / CSV / Word / PDF / PowerPoint の読み書きが必要なときは skill が自動ロードされ、',
  '    openpyxl / python-docx / pypdf 等のライブラリを使って高精度に処理できます。',
  '    例: CSV 添付 → xlsx skill で列ヘッダ / 型推論。PDF 添付 → pdf skill で表抽出。',
  '    レポート依頼 → xlsx skill で書式付き .xlsx を生成して artifact / fileKey 経由で返す。',
  '',
  '【kintone FILE フィールド (添付ファイル) を扱う際の注意】',
  '  - **fileKey は 2 種類あり相互利用不可**:',
  '      * UUID 形式 (例: `c15b3870-7505-4ab6-9d8d-b9bdbc74f5d6`): `kintone-upload-file` の応答 / プラグインからの【kintone に保存済】セクションで提示される。',
  '        → レコードの FILE フィールドに紐付ける用 (`kintone-add-record` / `kintone-update-record`)',
  '      * 49 桁 hex 形式 (例: `201202061155587E339F9067544F1A92C743460E3D12B3297`): `kintone-get-record(s)` のレスポンスに含まれる。',
  '        → ファイルの中身をダウンロードする用 (`kintone-download-file`)',
  '      * 用途を間違えると "invalid fileKey" 系のエラーになります。',
  '  - **既存添付ファイルを残す場合は全 fileKey を指定** (差分追加ではなく全置換):',
  '      `kintone-update-record` で FILE フィールドに渡した `value: [{fileKey: ...}, ...]` の配列が新しい全添付ファイルになります。',
  '      既存ファイルを残したい場合は、まず `kintone-get-record` で既存 fileKey 一覧を取得し、それに新規 fileKey を追加した配列を渡してください。',
  '      新規 fileKey だけを渡すと既存ファイルは削除されます (silent な事故になりやすいので必ず確認)。',
].join('\n');

/** kintone MCP server の name (mcp_servers と mcp_toolset で参照される識別子) */
export const KINTONE_MCP_SERVER_NAME = 'kintone';

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

/**
 * Default Agent に与える組込ツール構成。
 * - agent_toolset_20260401: bash/read/etc の基本ツール
 * - mcp_toolset (kintone): Worker /mcp 経由でツールを公開 (workerUrl 指定時のみ)
 */
function buildAgentTools(includeMcp: boolean): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = [
    {
      type: 'agent_toolset_20260401',
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
    },
    // Plugin 側で処理する Custom Tool (Anthropic 側の実行ではない)
    CREATE_ARTIFACT_TOOL as unknown as Record<string, unknown>,
  ];
  if (includeMcp) {
    // Anthropic 側で MCP の write 系ツールが default_config の always_allow を伝播しない
    // ことがあるため、各ツールに per-tool で configs を明示する。
    // configs は { name, enabled, permission_policy } の配列形式 (object map ではない)。
    tools.push({
      type: 'mcp_toolset',
      mcp_server_name: KINTONE_MCP_SERVER_NAME,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
      configs: KINTONE_TOOL_NAMES.map((name) => ({
        name,
        enabled: true,
        permission_policy: {
          type: DESTRUCTIVE_TOOL_NAMES.has(name) ? ('always_ask' as const) : ('always_allow' as const),
        },
      })),
    });
  }
  return tools;
}

function buildMcpServers(workerUrl: string, kintoneDomain: string): Array<Record<string, unknown>> {
  const url = `${workerUrl.replace(/\/$/, '')}/mcp/${kintoneDomain}`;
  return [
    {
      type: 'url',
      name: KINTONE_MCP_SERVER_NAME,
      url,
    },
  ];
}

// ----- in-flight Promise 共有 ------------------------------------------------

const inFlightByKey = new Map<string, Promise<Agent>>();

/** テスト用: in-flight キャッシュをクリアする。プロダクションコードから呼ばないこと */
export function _resetResolveDefaultAgentCache(): void {
  inFlightByKey.clear();
}

// ----- 本体 -----------------------------------------------------------------

export interface ResolveDefaultAgentOptions {
  /** Worker URL。指定すると mcp_servers + mcp_toolset を含む Agent を解決する */
  workerUrl?: string;
  /** kintone ドメイン (例: tenant.cybozu.com)。workerUrl と組で `/mcp/<domain>` を構成 */
  kintoneDomain?: string;
  /**
   * Issue #30: 同期済 custom skill の id 一覧。あれば DEFAULT_AGENT_SKILLS (Anthropic 製)
   * に追加で attach される。永続化は Anthropic Workspace に集約しており、bootstrap 側で
   * `/v1/skills?source=custom` を fetch して解決する (Plugin Config には保存しない)。
   */
  customSkillIds?: ReadonlyArray<string>;
}

/**
 * プラグインが管理する Default Agent を取得する。なければ作成する。
 *
 * workerUrl 指定の有無で別 Agent として扱われる (metadata.workerUrl で分岐)。
 *
 * 並行呼び出しや別プロセスとのレース条件に対して:
 * - 同一プロセス内では (workerUrl 単位で) in-flight Promise を共有
 * - 別プロセス (別タブ) で重複作成された場合は created_at 最古を返す
 */
export async function resolveDefaultAgent(
  options: ResolveDefaultAgentOptions = {},
): Promise<Agent> {
  // customSkillIds (sorted) も in-flight キーに含める (skill 入替時の Promise 分離)
  const skillsKey = options.customSkillIds
    ? [...options.customSkillIds].sort().join(',')
    : '';
  const key = `${options.workerUrl ?? ''}|${skillsKey}`;
  const cached = inFlightByKey.get(key);
  if (cached) return cached;

  const promise = doResolve(options);
  inFlightByKey.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    inFlightByKey.delete(key); // 失敗時はキャッシュ破棄、次回再試行を許可
    throw err;
  }
}

async function doResolve(options: ResolveDefaultAgentOptions): Promise<Agent> {
  const includeMcp = Boolean(options.workerUrl && options.kintoneDomain);
  const filter: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
    promptVersion: DEFAULT_AGENT_PROMPT_VERSION,
  };
  if (includeMcp) {
    filter['workerUrl'] = options.workerUrl!;
    filter['kintoneDomain'] = options.kintoneDomain!;
  }

  // 1. 既存 Agent を探索
  const existing = await findDefaultAgents(filter);
  if (existing.length > 0) {
    return pickOldest(existing);
  }

  // 2. 無ければ作成
  //    Anthropic 製 skills (DEFAULT_AGENT_SKILLS) + Plugin 同期済 custom skill を attach
  const skills: Array<{ type: 'anthropic' | 'custom'; skill_id: string }> = [
    ...DEFAULT_AGENT_SKILLS.map((s) => ({ ...s })),
  ];
  if (options.customSkillIds && options.customSkillIds.length > 0) {
    for (const id of options.customSkillIds) {
      skills.push({ type: 'custom', skill_id: id });
    }
  }
  const createParams: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    name: DEFAULT_AGENT_NAME,
    system: DEFAULT_AGENT_SYSTEM_PROMPT,
    tools: buildAgentTools(includeMcp),
    skills,
    metadata: filter,
  };
  if (includeMcp) {
    createParams['mcp_servers'] = buildMcpServers(options.workerUrl!, options.kintoneDomain!);
  }

  const created = await createAgent(createParams as unknown as Parameters<typeof createAgent>[0]);

  // 3. 作成直後に再 list して重複チェック。他プロセスが先行していれば最古を返す
  const verified = await findDefaultAgents(filter);
  if (verified.length > 1) {
    return pickOldest(verified);
  }
  return created;
}

async function findDefaultAgents(filter: Record<string, string>): Promise<Agent[]> {
  return findByMetadata<Agent>((page) => listAgents({ page }), filter);
}

// ─────────────────────────────────────────────────────────────────────────
// Customizer wedge V1 — Built-in Agent 3 variant ensure (P1.4)
// ─────────────────────────────────────────────────────────────────────────
//
// resolveDefaultAgent (v19) は **非破壊で温存** し、新規 resolveBuiltInAgents を
// 並行 export する。3 variant (業務 / Customizer Opus / Customizer Sonnet) を
// Promise.all で並行 ensure する。
//
// 各 variant は metadata.purpose で識別され、別々の Agent として workspace に
// 登録される (Anthropic API は Agent 定義に model を bind するため、model 違いは
// 別 Agent にせざるを得ない — design.md §3.1)。
//
// 仕様: requirements.md §6.3, §6.4.1 / design.md §3

type BuiltInPurpose = Exclude<AgentPurpose, 'custom'>;

/** resolveBuiltInAgents の戻り値構造 (3 variant 同時) */
export interface BuiltInAgentSet {
  business: Agent;
  customizerOpus: Agent;
  customizerSonnet: Agent;
}

export interface ResolveBuiltInAgentsOptions {
  /** Worker URL。mcp_servers + mcp_toolset を含めるなら必須 */
  workerUrl: string;
  /** kintone ドメイン (例: tenant.cybozu.com)。workerUrl と組で `/mcp/<domain>` を構成 */
  kintoneDomain: string;
  /** Plugin 同期済 custom skill の id 一覧。各 variant の customSkillFilter で再 filter される */
  customSkillIds?: ReadonlyArray<string>;
}

/** purpose 単位の in-flight Promise (同一プロセス内のレース対策) */
const builtInInFlight = new Map<string, Promise<Agent>>();

/** テスト用: in-flight キャッシュをクリアする */
export function _resetResolveBuiltInAgentsCache(): void {
  builtInInFlight.clear();
}

/**
 * V1 で auto-ensure される 3 variant の Built-in Agent をまとめて取得する。
 *
 * - 既存があれば pickOldest を返す (別タブ / 別プロセスとの作成レース対策)
 * - 3 variant を Promise.all で並行 ensure (in-flight キャッシュは purpose 単位)
 * - metadata.purpose / promptVersion / kintoneDomain で variant 識別
 */
export async function resolveBuiltInAgents(
  options: ResolveBuiltInAgentsOptions,
): Promise<BuiltInAgentSet> {
  const [business, customizerOpus, customizerSonnet] = await Promise.all([
    resolveBuiltInOne('business', options),
    resolveBuiltInOne('customizer-opus', options),
    resolveBuiltInOne('customizer-sonnet', options),
  ]);
  return { business, customizerOpus, customizerSonnet };
}

async function resolveBuiltInOne(
  purpose: BuiltInPurpose,
  options: ResolveBuiltInAgentsOptions,
): Promise<Agent> {
  const spec = BUILTIN_AGENT_SPECS[purpose];
  const skillsKey = options.customSkillIds
    ? [...options.customSkillIds].sort().join(',')
    : '';
  const key = [
    purpose,
    options.workerUrl,
    options.kintoneDomain,
    spec.promptVersion,
    skillsKey,
  ].join('|');

  const cached = builtInInFlight.get(key);
  if (cached) return cached;

  const promise = doResolveBuiltIn(purpose, spec, options);
  builtInInFlight.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    builtInInFlight.delete(key);
    throw err;
  }
}

async function doResolveBuiltIn(
  purpose: BuiltInPurpose,
  spec: BuiltInAgentSpec,
  options: ResolveBuiltInAgentsOptions,
): Promise<Agent> {
  // metadata は find filter にも create body にも同じ key で渡す (完全一致で再 list 可能)
  const filter: Record<string, string> = {
    source: METADATA_SOURCE,
    type: AGENT_TYPE.default,
    purpose,
    promptVersion: spec.promptVersion,
    workerUrl: options.workerUrl,
    kintoneDomain: options.kintoneDomain,
  };

  // 1. 既存 Agent を探索
  const existing = await findDefaultAgents(filter);
  if (existing.length > 0) {
    return pickOldest(existing);
  }

  // 2. 無ければ作成
  const skills: Array<{ type: 'anthropic' | 'custom'; skill_id: string }> = [
    ...spec.anthropicSkillIds.map((id) => ({ type: 'anthropic' as const, skill_id: id })),
  ];
  if (options.customSkillIds && options.customSkillIds.length > 0) {
    for (const id of options.customSkillIds) {
      if (spec.customSkillFilter(id)) {
        skills.push({ type: 'custom', skill_id: id });
      }
    }
  }

  // metadata には UI 補助情報 (iconKind / iconColor / variantGroup / isDefault / visibility) も含める
  // (find filter には影響しないが、再 list 時に Plugin がここから読む)
  const fullMetadata: Record<string, string> = {
    ...filter,
    iconKind: spec.iconKind,
    iconColor: spec.iconColor,
    isDefault: spec.isDefault ? '1' : '0',
    visibility: 'public', // V1 既定 (admin が後で変更可能)
  };
  if (spec.variantGroup) {
    fullMetadata['variantGroup'] = spec.variantGroup;
  }

  const createParams: Record<string, unknown> = {
    model: spec.model,
    name: spec.name,
    system: spec.systemPrompt,
    tools: buildBuiltInAgentTools(spec),
    skills,
    metadata: fullMetadata,
    mcp_servers: buildMcpServers(options.workerUrl, options.kintoneDomain),
  };

  const created = await createAgent(createParams as unknown as Parameters<typeof createAgent>[0]);

  // 3. 作成直後に再 list して重複チェック (別タブ・別プロセスとのレース対策)
  const verified = await findDefaultAgents(filter);
  if (verified.length > 1) {
    return pickOldest(verified);
  }
  return created;
}

/**
 * Built-in Agent 用のツール構成。spec.mcpToolFilter で per-variant に kintone MCP
 * ツールを絞り込む (業務エージェントは管理系を除外、Customizer は全部 attach)。
 */
function buildBuiltInAgentTools(spec: BuiltInAgentSpec): Array<Record<string, unknown>> {
  const filteredTools = BUILTIN_KINTONE_TOOL_NAMES.filter((name) => spec.mcpToolFilter(name));
  return [
    {
      type: 'agent_toolset_20260401',
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
    },
    CREATE_ARTIFACT_TOOL as unknown as Record<string, unknown>,
    {
      type: 'mcp_toolset',
      mcp_server_name: KINTONE_MCP_SERVER_NAME,
      default_config: {
        enabled: true,
        permission_policy: { type: 'always_allow' },
      },
      configs: filteredTools.map((name: KintoneToolName) => ({
        name,
        enabled: true,
        permission_policy: {
          type: BUILTIN_DESTRUCTIVE_TOOL_NAMES.has(name)
            ? ('always_ask' as const)
            : ('always_allow' as const),
        },
      })),
    },
  ];
}
