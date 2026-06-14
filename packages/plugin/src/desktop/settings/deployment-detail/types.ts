import type { DeploymentView } from '../../../core/deployments/view';

/** DeploymentDetailModal の開き方。 */
export type DeploymentModalMode =
  | { kind: 'create' }
  | { kind: 'edit'; deployment: DeploymentView };
