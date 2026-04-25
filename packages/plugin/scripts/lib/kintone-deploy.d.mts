export type AuthHeader = Record<string, string>;

export function basicAuthHeader(username: string, password: string): AuthHeader;

export interface DeployOpts {
  baseUrl: string;
  authHeader: AuthHeader;
  appId: number | string;
}

export function startDeploy(opts: DeployOpts): Promise<void>;

export function getDeployStatus(opts: DeployOpts): Promise<string>;

export interface DeployAndWaitOpts extends DeployOpts {
  timeoutMs?: number;
  intervalMs?: number;
  onStatus?: (status: string) => void;
}

export function deployAndWait(opts: DeployAndWaitOpts): Promise<void>;
