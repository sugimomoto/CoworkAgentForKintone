// Cowork Agent for kintone — Customizer wedge kintone API 連携 (V1 P4.4)
//
// preview / apply / rollback の各操作で実際に呼ぶ kintone REST API ラッパー。
// WorkflowFooter から useApplyWorkflow.callbacks として注入される。
//
// API:
//   - preview: iframe sandbox で artifact.content (JS) を実行 (host kintone には触れない)
//   - apply  : GET preview/app/customize で旧 JS を取得 → snapshot → PUT 新 JS → POST deploy
//   - rollback: snapshot を PUT で書き戻し → POST deploy
//
// V1 の制限:
//   - rollback の snapshot は chatStore.workflowHistory (in-memory)。Plugin リロードで失われる。
//   - 403 (アプリ管理権限不足) は WorkflowFooter の status line で表示される。
//
// 仕様: requirements.md §15.5 / design.md §6.3 / Risk R2, R3

import { useCallback } from 'react';

import { useChatStore } from '../../store/chatStore';

import type { WorkflowCallbacks } from './useApplyWorkflow';

/**
 * kintone REST API を呼ぶ薄いラッパー (kintone.api() を経由)。
 * テスト容易性のため呼出側で di できる shape にしている。
 */
export type KintoneApiFn = (
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  params: unknown,
) => Promise<unknown>;

interface KintoneCustomizeJsResponse {
  /** kintone preview/customize の正規レスポンス */
  scope?: 'ALL' | 'ADMIN' | 'NONE';
  desktop?: {
    js?: Array<{ type: 'URL' | 'FILE'; url?: string; file?: { fileKey: string } }>;
    css?: Array<{ type: 'URL' | 'FILE'; url?: string; file?: { fileKey: string } }>;
  };
  mobile?: {
    js?: Array<{ type: 'URL' | 'FILE'; url?: string; file?: { fileKey: string } }>;
  };
  revision?: string;
}

/** sandbox preview 用の引数 */
export interface PreviewArgs {
  /** artifact.content (JavaScript) */
  jsContent: string;
  /** preview を出すコンテナ要素 (任意)。なければ new iframe を内部生成 */
  sandboxParent?: HTMLElement;
}

export interface KintoneCustomizeApiDeps {
  /** kintone.api() に相当する関数 (テスト時に注入) */
  apiFn: KintoneApiFn;
  /** 対象アプリ ID */
  appId: number;
  /** preview 用 sandbox 実行 (テスト時に注入) */
  runSandbox?: (jsContent: string) => Promise<void>;
}

/**
 * preview/apply/rollback の callback set を生成するファクトリ。
 *
 * - chatStore.workflowHistory に snapshot を保存/取得する。
 * - apply 直前に既存 customize.js を取得して保存、その後 PUT で新 JS を設定 → deploy。
 * - rollback は snapshot を取り出し PUT → deploy。
 */
export function makeKintoneCustomizeWorkflow(
  artifactId: string,
  deps: KintoneCustomizeApiDeps,
): WorkflowCallbacks {
  const { apiFn, appId, runSandbox } = deps;
  const store = useChatStore.getState;

  return {
    preview: async () => {
      if (runSandbox) {
        await runSandbox(getJsContentFromStore(artifactId));
      } else {
        // V1 default: sandbox 実装は呼出側で注入。default は no-op (UI 検証用)。
      }
    },
    apply: async () => {
      const jsContent = getJsContentFromStore(artifactId);

      // 1) 既存の customize 設定を取得 (snapshot 用)
      const existing = (await apiFn(
        kintoneApiUrl('/k/v1/preview/app/customize.json'),
        'GET',
        { app: appId },
      )) as KintoneCustomizeJsResponse;

      // snapshot を chatStore に保存 (rollback で書き戻す用)
      const snapshot = JSON.stringify({
        desktop: existing.desktop ?? { js: [], css: [] },
        mobile: existing.mobile ?? { js: [] },
        scope: existing.scope ?? 'ALL',
      });
      store().saveWorkflowSnapshot(artifactId, snapshot);

      // 2) 新 JS を URL 形式で desktop.js に追加 (URL は呼出側で生成、今は inline 想定で
      //    実装は将来拡張。V1 では既存設定に追加せず、artifact 経由でファイルキー方式を採る)。
      //    NOTE: kintone customize.json は url 配列 + file 配列の構造。V1 では sandbox 経由で
      //    動作確認のみ。実機への JS deploy は MCP ツール kintone-update-customize-js (V3) 経由。
      //    本 V1 では PUT を「最小サンプルで成功確認」レベルで実行する。
      const newCustomize = buildCustomizeUpdate(existing, jsContent);
      await apiFn(kintoneApiUrl('/k/v1/preview/app/customize.json'), 'PUT', {
        app: appId,
        ...newCustomize,
      });

      // 3) deploy
      await apiFn(kintoneApiUrl('/k/v1/preview/app/deploy.json'), 'POST', { apps: [{ app: appId }] });
    },
    rollback: async () => {
      const snapshot = store().workflowHistory.get(artifactId);
      if (!snapshot) {
        throw new Error('ロールバック用のスナップショットが見つかりません (Plugin リロード等で失われた可能性)');
      }
      const parsed = JSON.parse(snapshot) as KintoneCustomizeJsResponse;
      await apiFn(kintoneApiUrl('/k/v1/preview/app/customize.json'), 'PUT', {
        app: appId,
        scope: parsed.scope ?? 'ALL',
        desktop: parsed.desktop ?? { js: [], css: [] },
        mobile: parsed.mobile ?? { js: [] },
      });
      await apiFn(kintoneApiUrl('/k/v1/preview/app/deploy.json'), 'POST', { apps: [{ app: appId }] });
      store().clearWorkflowSnapshot(artifactId);
    },
  };
}

// ─── 内部ヘルパ ───────────────────────────────────────────────────────────

function getJsContentFromStore(artifactId: string): string {
  const artifact = useChatStore.getState().artifacts.get(artifactId);
  if (!artifact) {
    throw new Error(`Artifact ${artifactId} が見つかりません`);
  }
  return artifact.content;
}

/**
 * 既存 customize 設定に「Cowork Agent が生成した JS」を **追記** する形で新設定を組む。
 * V1 では URL ベース (Worker でホストするか blob URL) ではなく、シンプルに inline で JS を
 * 文字列として保持する想定ではあるが、kintone customize.json は URL/FILE しか受け付けない。
 *
 * 実装方針 (V1 暫定):
 *   - Worker 経由でホストできないので、artifact.content は **直接 deploy できない**
 *   - 本関数は existing をそのまま返し (no-op)、UI 上 status は applied になるが
 *     実際の本番反映は MCP ツール kintone-update-customize-js (#24 V3) を待つ
 *   - これは V1 の wedge ループ UI 検証用 (実 deploy ロジックは V3 で完成)
 */
function buildCustomizeUpdate(
  existing: KintoneCustomizeJsResponse,
  _newJsContent: string,
): Pick<KintoneCustomizeJsResponse, 'scope' | 'desktop' | 'mobile'> {
  // V1: 既存設定をそのまま返す (deploy が空打ちになる)
  // V3 で MCP の kintone-update-customize-js が完成したら本関数を置き換える
  return {
    scope: existing.scope ?? 'ALL',
    desktop: existing.desktop ?? { js: [], css: [] },
    mobile: existing.mobile ?? { js: [] },
  };
}

function kintoneApiUrl(path: string): string {
  return path;
}

// ─── React hook 形式の便利ラッパー ────────────────────────────────────────

export interface UseKintoneCustomizeWorkflowOptions {
  artifactId: string;
  appId: number;
  apiFn: KintoneApiFn;
  runSandbox?: (jsContent: string) => Promise<void>;
}

/**
 * WorkflowFooter から `useApplyWorkflow.callbacks` として渡せる形に整える hook。
 * makeKintoneCustomizeWorkflow を useCallback でメモ化するだけ。
 */
export function useKintoneCustomizeWorkflow(
  options: UseKintoneCustomizeWorkflowOptions,
): WorkflowCallbacks {
  const { artifactId, appId, apiFn, runSandbox } = options;
  const preview = useCallback(async () => {
    if (runSandbox) {
      const content = useChatStore.getState().artifacts.get(artifactId)?.content;
      if (!content) throw new Error(`Artifact ${artifactId} が見つかりません`);
      await runSandbox(content);
    }
  }, [artifactId, runSandbox]);

  const apply = useCallback(async () => {
    const cb = makeKintoneCustomizeWorkflow(artifactId, { appId, apiFn, runSandbox });
    await cb.apply();
  }, [artifactId, appId, apiFn, runSandbox]);

  const rollback = useCallback(async () => {
    const cb = makeKintoneCustomizeWorkflow(artifactId, { appId, apiFn, runSandbox });
    await cb.rollback();
  }, [artifactId, appId, apiFn, runSandbox]);

  return { preview, apply, rollback };
}
