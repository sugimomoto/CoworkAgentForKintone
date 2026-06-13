// Cowork Agent for kintone — Anthropic Files API (managed-agents scope) クライアント
//
// セッション内で Agent が `/mnt/session/outputs/` 等に書き出したファイルは Anthropic 側で
// 自動的に session スコープの file_id が払い出される。Plugin はこれを list / download
// することで「Agent が出力した binary ファイル」をユーザーに届ける。
//
// kintone runtime の x-api-key 注入は client.ts と同じ transport 経路を使うため、
// fetch を直接呼ばずに `apiRequest` を経由する。
//
// **download だけは Worker 中継を使う**: kintone.plugin.app.proxy は response body を
// string で返してしまい binary が UTF-8 decode で破損するため、Worker で base64 化した
// JSON を介して受け取る。

import { joinUrl } from '../utils';

import { apiRequest } from './client';

/** Files API レスポンスの 1 件 (必要なフィールドだけ抽出) */
export interface SessionFile {
  id: string;
  /** ファイル名 (拡張子込み)。Agent がコンテナに書き出したパスから取られる */
  filename: string;
  /** MIME。Anthropic 側で推定される (拡張子ベース) */
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
}

/** List レスポンス (Files API の一覧形式) */
interface FilesListResponse {
  data: SessionFile[];
  has_more?: boolean;
  first_id?: string | null;
  last_id?: string | null;
}

/**
 * セッションスコープのファイル一覧を取得する。
 * Agent が `/workspace/` 等に書き出したファイルが対象。
 *
 * GET /v1/files?scope_id=<session_id>
 */
export async function listSessionFiles(sessionId: string): Promise<SessionFile[]> {
  const path = `/v1/files?scope_id=${encodeURIComponent(sessionId)}`;
  const res = await apiRequest<FilesListResponse>('GET', path);
  return Array.isArray(res?.data) ? res!.data : [];
}

interface WorkerDownloadResponse {
  contentBase64: string;
  mime: string;
  sizeBytes: number;
}

/** base64 string → Uint8Array */
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface DownloadSessionFileArgs {
  pluginId: string;
  workerUrl: string;
  fileId: string;
}

/**
 * Worker 経由で Anthropic Files API からファイル本体を Blob として取得する。
 *
 * 経路: Plugin → kintone.plugin.app.proxy (X-Anthropic-Api-Key 注入)
 *       → Worker `/files/<id>/content` → Anthropic `/v1/files/<id>/content`
 *       → base64 化 JSON → Plugin で decode → Blob
 *
 * 直接 `fetch` だと CORS で弾かれるため必ず kintone proxy を経由する。
 */
export async function downloadSessionFile(args: DownloadSessionFileArgs): Promise<Blob> {
  if (typeof kintone === 'undefined' || !kintone?.plugin?.app?.proxy) {
    throw new Error('kintone JavaScript API is not available');
  }
  const url = joinUrl(
    args.workerUrl.replace(/\/$/, ''),
    `files/${encodeURIComponent(args.fileId)}/content`,
  );
  const [respBody, status] = await kintone.plugin.app.proxy(
    args.pluginId,
    url,
    'GET',
    {}, // X-Anthropic-Api-Key は setProxyConfig 由来
    '',
  );
  if (status < 200 || status >= 300) {
    throw new Error(`Worker file download failed (${status}): ${respBody}`);
  }
  let json: WorkerDownloadResponse;
  try {
    json = JSON.parse(respBody);
  } catch {
    throw new Error(`Worker returned invalid JSON: ${respBody.slice(0, 200)}`);
  }
  if (!json || typeof json.contentBase64 !== 'string') {
    throw new Error('Worker returned malformed download response');
  }
  const bytes = base64ToBytes(json.contentBase64);
  return new Blob([bytes], { type: json.mime || 'application/octet-stream' });
}
