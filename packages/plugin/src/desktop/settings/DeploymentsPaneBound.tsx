// DeploymentsListPane / RunHistory / DetailModal を chatStore + Anthropic API に束ねるアダプタ。
// 状態 (一覧 / モーダル / 履歴 / スコープ) は本コンポーネントの local state に閉じる
// (既存 skills と同じ流儀。store スライスは作らない)。

import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveBootstrapEnvironment } from '../../core/bootstrap/resolveEnvironment';
import { deploymentToView, draftToCreateParams, draftToUpdateParams, visibleDeployments } from '../../core/deployments/view';
import { getCurrentSessionContext } from '../../core/kintone/user';
import {
  archiveDeployment,
  createDeployment,
  listDeploymentRuns,
  listDeployments,
  pauseDeployment,
  runDeployment,
  unpauseDeployment,
  updateDeployment,
} from '../../core/managed-agents/resources';
import { useChatStore } from '../../store/chatStore';

import { DeploymentDetailModal } from './deployment-detail/DeploymentDetailModal';
import { DeploymentRunHistory } from './DeploymentRunHistory';
import { DeploymentsListPane } from './DeploymentsListPane';

import type { DeploymentModalMode } from './deployment-detail/types';
import type { DeploymentDraft, DeploymentView } from '../../core/deployments/view';
import type { DeploymentRun } from '../../core/managed-agents/types';

function currentUserCode(): string {
  try {
    return getCurrentSessionContext().kintoneUserCode;
  } catch {
    return '';
  }
}

export interface DeploymentsPaneBoundProps {
  /** run の生成セッションを会話ビューで開く */
  onOpenSession?: (sessionId: string) => void;
}

export function DeploymentsPaneBound({ onOpenSession }: DeploymentsPaneBoundProps = {}): JSX.Element {
  const agents = useChatStore((s) => s.builtInAgents);
  const isAdmin = useChatStore((s) => s.isAdmin) === true;
  const vaultId = useChatStore((s) => s.vaultId);
  const currentUser = currentUserCode();

  const [all, setAll] = useState<DeploymentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [modal, setModal] = useState<DeploymentModalMode | null>(null);
  const [history, setHistory] = useState<DeploymentView | null>(null);
  const [runs, setRuns] = useState<DeploymentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runFilter, setRunFilter] = useState<'all' | 'failed'>('all');

  // 世代トークン: 後発の reload / mutation が先発の in-flight reload を stale 化し、
  // 古い応答による上書き (archive 済み行の復活など) を防ぐ。
  const reloadToken = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const token = ++reloadToken.current;
    setLoading(true);
    try {
      const res = await listDeployments({ limit: 100 });
      const views = await Promise.all(
        res.data
          .filter((d) => d.status !== 'archived')
          .map(async (d) => {
            let lastRun: DeploymentRun | undefined;
            try {
              const rr = await listDeploymentRuns({ deployment_id: d.id, limit: 1 });
              lastRun = rr.data[0];
            } catch {
              lastRun = undefined;
            }
            return deploymentToView(d, lastRun ?? null);
          }),
      );
      if (!mounted.current || token !== reloadToken.current) return; // stale
      setAll(views);
      setLoadError(null);
    } catch (e) {
      if (!mounted.current || token !== reloadToken.current) return;
      setLoadError(e instanceof Error ? e.message : '定期実行の読み込みに失敗しました');
    } finally {
      if (mounted.current && token === reloadToken.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = useCallback(
    async (draft: DeploymentDraft, mode: DeploymentModalMode) => {
      // 通知 (#13): デプロイ対象 Agent に Webhook が登録済なら通知 Vault も vault_ids に含める。
      const notifyVaultId = agents.find((a) => a.id === draft.agentId)?.notifyVaultId ?? null;
      if (mode.kind === 'edit') {
        // vault は「自分の deployment を編集するとき」だけ更新 (admin が他人の vault を
        // 自分のものに差し替える事故を防ぐ)。
        const own = mode.deployment.owner === currentUser;
        await updateDeployment(
          mode.deployment.id,
          draftToUpdateParams(draft, own ? { vaultId, notifyVaultId } : undefined),
        );
      } else {
        if (!vaultId) {
          throw new Error(
            'kintone との連携が必要です。先にチャット画面で kintone に接続してから作成してください。',
          );
        }
        const env = await resolveBootstrapEnvironment();
        await createDeployment(
          draftToCreateParams(draft, {
            environmentId: env.id,
            owner: currentUser,
            vaultId,
            notifyVaultId,
          }),
        );
      }
      setModal(null);
      await reload();
    },
    [agents, currentUser, vaultId, reload],
  );

  const handleRun = useCallback(async (d: DeploymentView) => {
    await runDeployment(d.id);
  }, []);

  const handleToggleStatus = useCallback(
    async (d: DeploymentView) => {
      if (d.status === 'active') await pauseDeployment(d.id);
      else await unpauseDeployment(d.id);
      await reload();
    },
    [reload],
  );

  const handleArchive = useCallback(async (d: DeploymentView) => {
    await archiveDeployment(d.id);
    // 進行中の reload を stale 化してから楽観削除 (古い応答での復活を防ぐ)
    reloadToken.current++;
    setAll((prev) => prev.filter((x) => x.id !== d.id));
  }, []);

  const openHistory = useCallback(async (d: DeploymentView) => {
    setHistory(d);
    setRunFilter('all');
    setRunsLoading(true);
    try {
      const rr = await listDeploymentRuns({ deployment_id: d.id, limit: 100 });
      setRuns(rr.data);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  if (history) {
    return (
      <DeploymentRunHistory
        deployment={history}
        runs={runs}
        loading={runsLoading}
        filter={runFilter}
        onFilterChange={setRunFilter}
        onBack={() => setHistory(null)}
        {...(onOpenSession ? { onOpenSession } : {})}
      />
    );
  }

  const visible = visibleDeployments(all, isAdmin ? 'admin' : 'user', currentUser, scope);
  const mineCount = all.filter((d) => d.owner === currentUser).length;

  return (
    <>
      <DeploymentsListPane
        deployments={visible}
        loading={loading}
        loadError={loadError}
        agents={agents}
        isAdmin={isAdmin}
        currentUser={currentUser}
        scope={scope}
        onScopeChange={setScope}
        scopeCounts={{ all: all.length, mine: mineCount }}
        onCreate={() => setModal({ kind: 'create' })}
        onEdit={(d) => setModal({ kind: 'edit', deployment: d })}
        onRun={handleRun}
        onToggleStatus={handleToggleStatus}
        onArchive={handleArchive}
        onOpenHistory={openHistory}
      />
      {modal && (
        <DeploymentDetailModal
          mode={modal}
          agents={agents}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
