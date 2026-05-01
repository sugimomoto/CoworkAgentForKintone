// 開発時の観測ログ。
// 本番でも常時 console.info/warn を流すと邪魔なので、`window.__coworkDebug = true` の
// ときだけ詳細ログ、そうでなければ warn / error のみ出すようにする。
//
// Console フィルタ用に `[CoworkAgent:<scope>]` プレフィックスで統一する。

type Scope =
  | 'CustomTool'
  | 'Poller'
  | 'Session'
  | 'Banner'
  | 'SessionFiles'
  | 'BinaryArtifact';

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { __coworkDebug?: boolean }).__coworkDebug);
}

function prefix(scope: Scope): string {
  return `[CoworkAgent:${scope}]`;
}

export function debug(scope: Scope, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(prefix(scope), ...args);
}

export function warn(scope: Scope, ...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.warn(prefix(scope), ...args);
}

export function error(scope: Scope, ...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error(prefix(scope), ...args);
}
