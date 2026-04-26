// OAuth popup を開いて Worker /oauth/callback からの postMessage を受け取る。
//
// 検証 (3 段):
//   - event.origin === expectedOrigin (Worker の origin)
//   - payload.source === OAUTH_POSTMESSAGE_SOURCE (Worker /oauth/callback と同じ定数)
//   - payload.state === expectedState (CSRF 防御)
// 失敗時: popup blocker / ユーザクローズ / OAuth error / timeout

import { OAUTH_POSTMESSAGE_SOURCE } from '../constants';

export interface OAuthCallbackPayload {
  source: typeof OAUTH_POSTMESSAGE_SOURCE;
  code: string | null;
  state: string;
  error: string | null;
  error_description: string | null;
}

export interface OpenOAuthPopupOptions {
  authorizationUrl: string;
  expectedState: string;
  expectedOrigin: string;
  /** ms, default 300_000 (5min) */
  timeoutMs?: number;
}

const POPUP_FEATURES = 'popup,width=480,height=720,resizable=yes,scrollbars=yes';
const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 300_000;

export function openOAuthPopup(opts: OpenOAuthPopupOptions): Promise<OAuthCallbackPayload> {
  const popup = window.open(opts.authorizationUrl, '_blank', POPUP_FEATURES);
  if (!popup) {
    return Promise.reject(new Error('popup blocked: failed to open OAuth popup window'));
  }

  return new Promise<OAuthCallbackPayload>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      window.removeEventListener('message', onMessage);
      clearInterval(pollHandle);
      clearTimeout(timeoutHandle);
      try {
        if (!popup.closed) popup.close();
      } catch {
        // ignore
      }
    };

    const settleResolve = (value: OAuthCallbackPayload): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const settleReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== opts.expectedOrigin) return;
      const data = event.data as Partial<OAuthCallbackPayload> | null;
      if (!data || typeof data !== 'object') return;
      if (data.source !== OAUTH_POSTMESSAGE_SOURCE) return;
      if (data.state !== opts.expectedState) return;
      if (data.error) {
        settleReject(
          new Error(`OAuth error: ${data.error}${data.error_description ? ` (${data.error_description})` : ''}`),
        );
        return;
      }
      if (typeof data.code !== 'string' || !data.code) {
        settleReject(new Error('OAuth callback payload missing code'));
        return;
      }
      settleResolve(data as OAuthCallbackPayload);
    };

    window.addEventListener('message', onMessage);

    const pollHandle = setInterval(() => {
      if (popup.closed) {
        settleReject(new Error('OAuth popup was closed (cancelled by user)'));
      }
    }, POLL_INTERVAL_MS);

    const timeoutHandle = setTimeout(() => {
      settleReject(new Error('OAuth popup timeout'));
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  });
}
