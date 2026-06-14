import { defaultSchedule, scheduleFromCron } from '../../../core/deployments/schedule';

import type { DeploymentModalMode } from './types';
import type { DeploymentDraft } from '../../../core/deployments/view';

/** モーダルの初期 draft を mode から生成。create は既定値 + 先頭 agent。 */
export function buildDeploymentDraft(
  mode: DeploymentModalMode,
  defaultAgentId: string,
): DeploymentDraft {
  if (mode.kind === 'edit') {
    const d = mode.deployment;
    return {
      name: d.name,
      agentId: d.agentId,
      initialMessage: d.initialMessage,
      schedule: scheduleFromCron(d.cron, d.tz),
    };
  }
  return {
    name: '',
    agentId: defaultAgentId,
    initialMessage: '',
    schedule: defaultSchedule(),
  };
}
