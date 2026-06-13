// Cowork Agent for kintone — Customizer Bundle Artifact 表示 (#20 V2 Phase 1)
//
// kind=kintone-customize-bundle の artifact を表示する Customizer 専用ビュー。
// 構成:
//   左 FileTree (200px、bundle.files を表示) | 右 CodeViewer (activeFilePath の content)
// 下に WorkflowFooter (preview/apply/rollback/cancel ボタン)。
//
// 仕様: .steering/20260518-customizer-wedge-actualization/design.md §3.5

import { useMemo, useState } from 'react';

import { FileTree, bundleFilesToTreeEntries } from '../../../chat/workflow/FileTree';
import {
  defaultFileUpload,
  getPreviewUrl,
  useKintoneCustomizeWorkflow,
} from '../../../chat/workflow/kintoneCustomizeApi';
import { OAuthScopeError } from '../../../chat/workflow/OAuthScopeError';
import { WorkflowFooter } from '../../../chat/workflow/WorkflowFooter';
import { getBundleContent } from '../../../core/artifacts/types';
import { useUserBinding } from '../../hooks/useUserBinding';

import type { KintoneApiFn } from '../../../chat/workflow/kintoneCustomizeApi';
import type { WorkflowCallbacks } from '../../../chat/workflow/useApplyWorkflow';
import type { Artifact, CustomizeFilePath } from '../../../core/artifacts/types';

export interface CustomizerBundleViewProps {
  artifact: Artifact;
  /** Plugin が動いている host アプリの ID (kintone.app.getId() の結果)。bundle.appId が指定されていればそちらを優先 */
  appId: number;
  /** kintone REST API 呼出ラッパー */
  apiFn: KintoneApiFn;
  /** kintone のサブドメイン URL (動作テスト環境リンク生成用)。default は window.location.origin */
  baseUrl?: string;
}

export function CustomizerBundleView({
  artifact,
  appId: hostAppId,
  apiFn,
  baseUrl,
}: CustomizerBundleViewProps): JSX.Element {
  const bundle = useMemo(() => getBundleContent(artifact), [artifact]);
  const [activeFilePath, setActiveFilePath] = useState<CustomizeFilePath | null>(
    bundle?.files[0]?.path ?? null,
  );

  // 対象アプリ ID: bundle.appId が明示されていればそちらを優先 (Agent が
  // 別アプリ向けに生成したケース)、なければ host アプリ (= 現在 admin が
  // 開いているアプリ)。
  const targetAppId = bundle?.appId ?? hostAppId;

  // bundle のリビジョン (artifact.version) が変わったら activeFilePath を最初に戻す
  // → Agent が新版を出した場合に「無くなった path」を見続けないように
  useMemo(() => {
    if (!bundle) return;
    if (activeFilePath && bundle.files.some((f) => f.path === activeFilePath)) return;
    setActiveFilePath(bundle.files[0]?.path ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.version, bundle]);

  // WorkflowCallbacks 構築 (bundle と artifactId に依存)
  const rawCallbacks = useKintoneCustomizeWorkflow({
    artifactId: artifact.id,
    bundle: bundle ?? { files: [] },
    appId: targetAppId,
    apiFn,
    uploadFile: defaultFileUpload,
  });

  // OAuth scope 不足を検知して V1 #28 既存の再連携 UX (useUserBinding.connect) を
  // トリガーするラッパー。confirm で admin の意思確認 → connect (OAuth popup) →
  // 完了後 admin が再度ボタンを押す流れに誘導。
  const { connect: reconnectOAuth } = useUserBinding();
  const callbacks: WorkflowCallbacks = useMemo(
    () => ({
      preview: withScopeRecovery(rawCallbacks.preview, reconnectOAuth),
      apply: withScopeRecovery(rawCallbacks.apply, reconnectOAuth),
      rollback: withScopeRecovery(rawCallbacks.rollback, reconnectOAuth),
      cancel: withScopeRecovery(rawCallbacks.cancel, reconnectOAuth),
    }),
    [rawCallbacks, reconnectOAuth],
  );

  if (!bundle) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-[12px] text-muted">
        <span data-testid="customizer-bundle-invalid">
          bundle 形式の artifact ではありません (content が JSON parse できないか、files が無効)
        </span>
      </div>
    );
  }

  const treeEntries = bundleFilesToTreeEntries(bundle.files, activeFilePath);
  const activeFile = bundle.files.find((f) => f.path === activeFilePath);
  const previewUrl = getPreviewUrl(targetAppId, baseUrl);

  // host アプリと bundle 対象アプリの相違を admin に明示
  const showTargetAppHint = bundle.appId !== undefined && bundle.appId !== hostAppId;

  return (
    <div data-testid="customizer-bundle-view" className="flex h-full flex-col overflow-hidden">
      {showTargetAppHint && (
        <div
          data-testid="customizer-bundle-target-app-hint"
          className="shrink-0 border-b border-border bg-warn-soft px-[12px] py-[6px] text-[11px] text-warn"
        >
          ⚠ 対象アプリ ID = <strong>{targetAppId}</strong> (現在開いているアプリ {hostAppId} とは別です)
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <FileTree
          files={treeEntries}
          onSelect={(path) => setActiveFilePath(path as CustomizeFilePath)}
        />
        <div className="flex-1 overflow-auto">
          {activeFile ? (
            <CodeViewer path={activeFile.path} content={activeFile.content} />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-muted">
              ファイルが選択されていません
            </div>
          )}
        </div>
      </div>
      <WorkflowFooter
        artifactId={artifact.id}
        appName={`アプリ ${targetAppId}`}
        callbacks={callbacks}
        previewUrl={previewUrl}
      />
    </div>
  );
}

/**
 * WorkflowCallback を wrap し、OAuthScopeError を検知して再連携 UX をトリガーする。
 *   1. 元の callback を実行
 *   2. OAuthScopeError なら confirm で admin に再連携 (OAuth 再認可) を促す
 *   3. OK → connect (= OAuth popup) で再連携完了
 *   4. throw して useApplyWorkflow の state を戻す (admin が再度ボタンを押す)
 */
export function withScopeRecovery(
  fn: () => Promise<void>,
  connect: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof OAuthScopeError) {
        const ok =
          typeof window !== 'undefined' &&
          window.confirm(
            `kintone OAuth 権限が不足しています:\n  ${e.missingScopes.join(', ')}\n\n` +
              '再連携 (OAuth 再認可) を実行しますか?',
          );
        if (ok) {
          await connect();
          // 再連携完了。admin が再度ボタンを押す
          throw new Error('OAuth 再連携が完了しました。もう一度操作してください。');
        }
      }
      throw e;
    }
  };
}

interface CodeViewerProps {
  path: string;
  content: string;
}

function CodeViewer({ path, content }: CodeViewerProps): JSX.Element {
  return (
    <pre
      data-testid={`customizer-bundle-file-${path}`}
      className="h-full overflow-auto bg-slate-50 px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800"
    >
      <code>{content}</code>
    </pre>
  );
}
