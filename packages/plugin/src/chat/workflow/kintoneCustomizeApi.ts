// Cowork Agent for kintone — Customizer wedge kintone REST API 連携 (#20 V2 Phase 1)
//
// preview / apply / rollback / cancel の各操作で実際に呼ぶ kintone REST API ラッパー。
// CustomizerArtifactView から useApplyWorkflow.callbacks として注入される。
//
// V1 は no-op だった buildCustomizeUpdate を本実装に置換:
//   - bundle.files を file.json で upload (UUID fileKey 取得)
//   - 既存 customize.json を GET → 同 path は置換 / それ以外は保持 で merge
//   - PUT preview/customize.json (revision 楽観ロック)
//   - apply 時のみ POST deploy.json (live 反映) + status ポーリング
//   - apply 直前に chatStore.workflowHistory に旧 customize を snapshot (Phase 1 in-memory)
//   - rollback は snapshot を PUT + deploy で復元
//   - cancel は POST deploy.json {revert:true} で preview を live と同期
//
// 仕様: .steering/20260518-customizer-wedge-actualization/design.md §3.1

import { useCallback } from 'react';

import { useChatStore } from '../../store/chatStore';

import { detectMissingScopes, OAuthScopeError } from './OAuthScopeError';

import type { CustomizeBundleContent, CustomizeFilePath } from '../../core/artifacts/types';
import type { WorkflowCallbacks } from './useApplyWorkflow';

// ─── kintone REST API 型 ──────────────────────────────────────────────────

export type KintoneApiFn = (
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  params: unknown,
) => Promise<unknown>;

/** file upload 用 (kintone.api は multipart 未対応のため fetch + FormData を別途使う想定) */
export type FileUploadFn = (fileName: string, content: string) => Promise<string>;

/** customize.json 1 entry */
export type CustomizeFileEntry =
  | { type: 'URL'; url: string }
  | {
      type: 'FILE';
      file: {
        fileKey: string;
        name?: string;
        contentType?: string;
        size?: string;
      };
    };

/** GET /k/v1/preview/app/customize.json レスポンス */
export interface CustomizeJsonResponse {
  scope: 'ALL' | 'ADMIN' | 'NONE';
  desktop: { js?: CustomizeFileEntry[]; css?: CustomizeFileEntry[] };
  mobile: { js?: CustomizeFileEntry[]; css?: CustomizeFileEntry[] };
  revision?: string;
}

/** chatStore.workflowHistory に保存する snapshot (Phase 1 in-memory) */
export interface CustomizeSnapshot {
  /** apply 直前の preview customize.json (rollback 時に PUT で書き戻す) */
  customize: CustomizeJsonResponse;
  /** snapshot を取った時刻 */
  capturedAt: number;
}

export interface KintoneCustomizeApiDeps {
  appId: number;
  apiFn: KintoneApiFn;
  /** file.json upload。kintone.api は multipart 不可のため別経路 (fetch + FormData) で呼ぶ */
  uploadFile: FileUploadFn;
  /** deploy.json status ポーリング間隔 (ms)。default 2000 */
  pollIntervalMs?: number;
  /** deploy.json status ポーリング上限回数。default 30 (= 60s) */
  pollMaxAttempts?: number;
}

// ─── public API ────────────────────────────────────────────────────────────

export interface CustomizerWorkflowParams {
  /** 対象 bundle artifact id (snapshot 識別子になる) */
  artifactId: string;
  /** bundle 本体 (CustomizerArtifactView が artifact から parse して渡す) */
  bundle: CustomizeBundleContent;
}

/**
 * preview/apply/rollback/cancel の callback set を生成する factory。
 * useApplyWorkflow に渡す WorkflowCallbacks を返す。
 */
export function makeKintoneCustomizeWorkflow(
  params: CustomizerWorkflowParams,
  deps: KintoneCustomizeApiDeps,
): WorkflowCallbacks {
  const { artifactId, bundle } = params;

  return {
    preview: async () => {
      await pushBundleToPreview(bundle, deps);
    },
    apply: async () => {
      // apply 直前に旧 customize を snapshot (preview = live = 直前の状態と仮定)
      const current = await getCustomize(deps, /* preview */ true);
      saveSnapshot(artifactId, current);
      await pushBundleToPreview(bundle, deps);
      await deployAndWait(deps);
    },
    rollback: async () => {
      const snap = loadSnapshot(artifactId);
      if (!snap) {
        throw new Error(
          'ロールバック履歴が見つかりません (Plugin リロードで失われた可能性があります)。永続的なロールバックは Phase 2 で GitHub 連携と統合予定です。',
        );
      }
      // snapshot 内の revision は apply 直前 (= 古い) の値なので、そのまま PUT に
      // 渡すと楽観ロック失敗 (409 Conflict) になる。rollback は「強制的に過去状態を
      // 書き戻す」操作なので revision を skip (= '-1' 相当) で上書きする。
      const { revision: _staleRevision, ...customizeWithoutRevision } = snap.customize;
      void _staleRevision;
      await putCustomize(deps, customizeWithoutRevision as CustomizeJsonResponse);
      await deployAndWait(deps);
      // 1 回 rollback したら snapshot を消す (再 apply で別 snapshot を取り直す)
      clearSnapshot(artifactId);
    },
    cancel: async () => {
      // POST deploy.json {revert: true} = preview を live と同期 (preview 編集を破棄)
      const result = await callApi(deps, '/k/v1/preview/app/deploy.json', 'POST', {
        apps: [{ app: deps.appId }],
        revert: true,
      });
      void result;
    },
  };
}

/**
 * kintone 動作テスト環境 URL を組み立てる。WorkflowFooter の「動作テスト環境を開く」リンク用。
 * 例: https://example.cybozu.com/k/admin/preview/3/
 */
export function getPreviewUrl(appId: number, baseUrl?: string): string {
  const origin =
    baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/k/admin/preview/${appId}/`;
}

// ─── 内部実装 ─────────────────────────────────────────────────────────────

/** bundle.files を upload して preview customize.json に merge PUT する */
async function pushBundleToPreview(
  bundle: CustomizeBundleContent,
  deps: KintoneCustomizeApiDeps,
): Promise<void> {
  // 各 file を file.json で upload
  const uploaded = await Promise.all(
    bundle.files.map(async (f) => ({
      path: f.path,
      fileKey: await deps.uploadFile(`cowork-agent-${f.path}`, f.content),
    })),
  );

  // 現状の preview customize.json を取得
  const current = await getCustomize(deps, /* preview */ true);

  // bundle.files の path と一致する既存 entry を置換、それ以外は保持
  const next = mergeCustomize(current, uploaded);
  await putCustomize(deps, next);
}

/** snapshot を chatStore.workflowHistory に保存 */
function saveSnapshot(artifactId: string, customize: CustomizeJsonResponse): void {
  const snap: CustomizeSnapshot = {
    customize,
    capturedAt: Date.now(),
  };
  useChatStore.getState().saveWorkflowSnapshot(artifactId, JSON.stringify(snap));
}

function loadSnapshot(artifactId: string): CustomizeSnapshot | null {
  const raw = useChatStore.getState().workflowHistory.get(artifactId);
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as CustomizeSnapshot;
  } catch {
    return null;
  }
}

function clearSnapshot(artifactId: string): void {
  useChatStore.getState().clearWorkflowSnapshot?.(artifactId);
}

/** customize.json の merge: bundle path に対応する既存 entry を置換、それ以外は保持 */
export function mergeCustomize(
  current: CustomizeJsonResponse,
  uploaded: ReadonlyArray<{ path: CustomizeFilePath; fileKey: string }>,
): CustomizeJsonResponse {
  // path → fileKey の lookup
  const byPath = new Map<CustomizeFilePath, string>();
  for (const u of uploaded) byPath.set(u.path, u.fileKey);

  // 各 area (desktop.js, desktop.css, mobile.js, mobile.css) を merge
  const result: CustomizeJsonResponse = {
    scope: current.scope ?? 'ALL',
    desktop: {
      js: mergeFileArray(current.desktop?.js ?? [], byPath.get('desktop.js')),
      css: mergeFileArray(current.desktop?.css ?? [], byPath.get('desktop.css')),
    },
    mobile: {
      js: mergeFileArray(current.mobile?.js ?? [], byPath.get('mobile.js')),
      css: mergeFileArray(current.mobile?.css ?? [], byPath.get('mobile.css')),
    },
  };
  if (current.revision) {
    result.revision = current.revision;
  }
  return result;
}

/**
 * 既存配列に新 fileKey を merge:
 *   - newFileKey が undefined: 既存配列を保持
 *   - newFileKey 指定: 既存の最初の FILE エントリで `name` が cowork-agent-* なら **置換**、
 *                       無ければ末尾に **追加**
 *   - URL タイプは常に保持 (admin が手動登録した CDN リンクなど)
 */
function mergeFileArray(
  existing: CustomizeFileEntry[],
  newFileKey: string | undefined,
): CustomizeFileEntry[] {
  if (!newFileKey) return existing;
  const result: CustomizeFileEntry[] = [];
  let replaced = false;
  for (const e of existing) {
    if (
      !replaced &&
      e.type === 'FILE' &&
      typeof e.file.name === 'string' &&
      e.file.name.startsWith('cowork-agent-')
    ) {
      // 同名の Cowork Agent 生成 entry を置換
      result.push({ type: 'FILE', file: { fileKey: newFileKey } });
      replaced = true;
    } else {
      result.push(e);
    }
  }
  if (!replaced) {
    result.push({ type: 'FILE', file: { fileKey: newFileKey } });
  }
  return result;
}

async function getCustomize(
  deps: KintoneCustomizeApiDeps,
  preview: boolean,
): Promise<CustomizeJsonResponse> {
  const path = preview
    ? '/k/v1/preview/app/customize.json'
    : '/k/v1/app/customize.json';
  return (await callApi(deps, path, 'GET', { app: deps.appId })) as CustomizeJsonResponse;
}

async function putCustomize(
  deps: KintoneCustomizeApiDeps,
  body: CustomizeJsonResponse,
): Promise<void> {
  await callApi(deps, '/k/v1/preview/app/customize.json', 'PUT', {
    app: deps.appId,
    scope: body.scope,
    desktop: body.desktop,
    mobile: body.mobile,
    // revision を渡せば楽観ロック、無ければ skip ('-1' 相当)
    ...(body.revision ? { revision: body.revision } : {}),
  });
}

async function deployAndWait(deps: KintoneCustomizeApiDeps): Promise<void> {
  await callApi(deps, '/k/v1/preview/app/deploy.json', 'POST', {
    apps: [{ app: deps.appId }],
  });
  await pollDeployStatus(deps);
}

interface DeployStatusResponse {
  apps?: Array<{ app: string; status: 'PROCESSING' | 'SUCCESS' | 'FAIL' | 'CANCEL' }>;
}

async function pollDeployStatus(deps: KintoneCustomizeApiDeps): Promise<void> {
  const interval = deps.pollIntervalMs ?? 2000;
  const max = deps.pollMaxAttempts ?? 30;
  for (let i = 0; i < max; i++) {
    await sleep(interval);
    const res = (await callApi(deps, '/k/v1/preview/app/deploy.json', 'GET', {
      apps: [deps.appId],
    })) as DeployStatusResponse;
    const status = res.apps?.[0]?.status;
    if (status === 'SUCCESS') return;
    if (status === 'FAIL' || status === 'CANCEL') {
      throw new Error(`deploy ${status}: kintone 側でデプロイが失敗しました`);
    }
  }
  throw new Error(`deploy status ポーリングがタイムアウトしました (${max * interval}ms)`);
}

/** kintone REST API 呼出ラッパー。403 + scope 文言で OAuthScopeError を throw */
async function callApi(
  deps: KintoneCustomizeApiDeps,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  params: unknown,
): Promise<unknown> {
  try {
    return await deps.apiFn(path, method, params);
  } catch (e) {
    if (e instanceof Error) {
      const body = (e as { responseBody?: string }).responseBody ?? e.message;
      if (typeof body === 'string') {
        const missing = detectMissingScopes(body);
        if (missing.length > 0) {
          throw new OAuthScopeError(missing, body);
        }
      }
    }
    throw e;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── React hook 形式の便利ラッパー (CustomizerArtifactView 用) ───────────────

export interface UseKintoneCustomizeWorkflowOptions {
  artifactId: string;
  bundle: CustomizeBundleContent;
  appId: number;
  apiFn: KintoneApiFn;
  uploadFile: FileUploadFn;
}

export function useKintoneCustomizeWorkflow(
  options: UseKintoneCustomizeWorkflowOptions,
): WorkflowCallbacks {
  const { artifactId, bundle, appId, apiFn, uploadFile } = options;
  const preview = useCallback(async () => {
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId, bundle },
      { appId, apiFn, uploadFile },
    );
    await cb.preview();
  }, [artifactId, bundle, appId, apiFn, uploadFile]);

  const apply = useCallback(async () => {
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId, bundle },
      { appId, apiFn, uploadFile },
    );
    await cb.apply();
  }, [artifactId, bundle, appId, apiFn, uploadFile]);

  const rollback = useCallback(async () => {
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId, bundle },
      { appId, apiFn, uploadFile },
    );
    await cb.rollback();
  }, [artifactId, bundle, appId, apiFn, uploadFile]);

  const cancel = useCallback(async () => {
    const cb = makeKintoneCustomizeWorkflow(
      { artifactId, bundle },
      { appId, apiFn, uploadFile },
    );
    await cb.cancel();
  }, [artifactId, bundle, appId, apiFn, uploadFile]);

  return { preview, apply, rollback, cancel };
}

// ─── デフォルトの file upload 実装 (Plugin runtime 用) ───────────────────────

/**
 * Plugin から kintone /k/v1/file.json に upload するヘルパー。
 * `kintone.api` は multipart 非対応のため fetch + FormData で直接叩く。
 *
 * kintone セッション認証 (Cookie ベース) が成立するには以下 2 つが必須:
 *   1. `X-Requested-With: XMLHttpRequest` ヘッダ — CSRF 対策で kintone が XHR/fetch
 *      発の正当な呼出かを確認するために要求 (無いと CB_JH01 認証エラー)
 *   2. `__REQUEST_TOKEN__` form field — CSRF token (POST 時必須)
 */
export async function defaultFileUpload(
  fileName: string,
  content: string,
): Promise<string> {
  if (typeof kintone === 'undefined') {
    throw new Error('kintone JavaScript API is not available (Plugin context 外)');
  }
  const formData = new FormData();
  formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
  formData.append(
    'file',
    new Blob([content], { type: 'application/javascript' }),
    fileName,
  );
  const url = kintone.api.url('/k/v1/file.json', /* detectGuestSpace */ true);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(
      `file.json upload failed: HTTP ${res.status} ${body.slice(0, 200)}`,
    );
    (err as { responseBody?: string }).responseBody = body;
    throw err;
  }
  const json = (await res.json()) as { fileKey: string };
  return json.fileKey;
}
