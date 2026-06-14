// DeploymentsListPane / RunHistory / DetailModal を chatStore + Anthropic API に束ねるアダプタ。
// 状態 (一覧 / モーダル / 履歴 / スコープ) は本コンポーネントの local state に閉じる
// (既存 skills と同じ流儀。store スライスは作らない)。

import { useCallback, useEffect, useState } from 'react';

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

export function DeploymentsPaneBound(): JSX.Element {
  const agents = useChatStore((s) => s.builtInAgents);
  const isAdmin = useChatStore((s) => s.isAdmin) === true;
  const currentUser = currentUserCode();

  const [all, setAll] = useState<DeploymentView[]>([]);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [modal, setModal] = useState<DeploymentModalMode | null>(null);
  const [history, setHistory] = useState<DeploymentView | null>(null);
  const [runs, setRuns] = useState<DeploymentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runFilter, setRunFilter] = useState<'all' | 'failed'>('all');

  const reload = useCallback(async () => {
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
    setAll(views);
  }, []);

  useEffect(() => {
    void reload().catch((e) => console.warn('[cowork-agent] listDeployments failed:', e));
  }, [reload]);

  const handleSave = useCallback(
    async (draft: DeploymentDraft, mode: DeploymentModalMode) => {
      if (mode.kind === 'edit') {
        await updateDeployment(mode.deployment.id, draftToUpdateParams(draft));
      } else {
        const env = await resolveBootstrapEnvironment();
        await createDeployment(draftToCreateParams(draft, { environmentId: env.id, owner: currentUser }));
      }
      setModal(null);
      await reload();
    },
    [currentUser, reload],
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

  const handleArchive = useCallback(
    async (d: DeploymentView) => {
      await archiveDeployment(d.id);
      setAll((prev) => prev.filter((x) => x.id !== d.id));
    },
    [],
  );

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
      />
    );
  }

  const visible = visibleDeployments(all, isAdmin ? 'admin' : 'user', currentUser, scope);
  const mineCount = all.filter((d) => d.owner === currentUser).length;

  return (
    <>
      <DeploymentsListPane
        deployments={visible}
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
