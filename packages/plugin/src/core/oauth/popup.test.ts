import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openOAuthPopup, type OAuthCallbackPayload } from './popup';

const EXPECTED_ORIGIN = 'https://worker.example.com';
const EXPECTED_STATE = 'state-xyz';
const AUTH_URL = 'https://kintone.example.com/oauth2/authorization?...';

interface FakePopup {
  closed: boolean;
  close: () => void;
}

let fakePopup: FakePopup;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let openSpy: any;

beforeEach(() => {
  fakePopup = { closed: false, close: vi.fn(() => { fakePopup.closed = true; }) };
  openSpy = vi.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);
});

afterEach(() => {
  openSpy.mockRestore();
  vi.restoreAllMocks();
});

function dispatchMessage(data: OAuthCallbackPayload, origin = EXPECTED_ORIGIN): void {
  const event = new MessageEvent('message', { data, origin });
  window.dispatchEvent(event);
}

const VALID_PAYLOAD: OAuthCallbackPayload = {
  source: 'cowork-agent-kintone-mcp',
  code: 'auth-code',
  state: EXPECTED_STATE,
  error: null,
  error_description: null,
};

describe('openOAuthPopup', () => {
  it('正常系: postMessage 受信で payload が resolve、popup が close', async () => {
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
    });

    expect(openSpy).toHaveBeenCalledWith(AUTH_URL, '_blank', expect.stringContaining('popup'));

    setTimeout(() => dispatchMessage(VALID_PAYLOAD), 0);

    const result = await promise;
    expect(result.code).toBe('auth-code');
    expect(fakePopup.close).toHaveBeenCalled();
  });

  it('不正な origin の message は無視', async () => {
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
      timeoutMs: 100,
    });

    setTimeout(() => dispatchMessage(VALID_PAYLOAD, 'https://evil.example.com'), 0);
    await expect(promise).rejects.toThrow(/timeout/i);
  });

  it('state 不一致の message は無視', async () => {
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
      timeoutMs: 100,
    });

    setTimeout(() => dispatchMessage({ ...VALID_PAYLOAD, state: 'different' }), 0);
    await expect(promise).rejects.toThrow(/timeout/i);
  });

  it('source 違いの message は無視', async () => {
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
      timeoutMs: 100,
    });

    setTimeout(
      () => dispatchMessage({ ...VALID_PAYLOAD, source: 'other-app' as 'cowork-agent-kintone-mcp' }),
      0,
    );
    await expect(promise).rejects.toThrow(/timeout/i);
  });

  it('error クエリ付き payload は cancelled 扱いで reject', async () => {
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
    });
    setTimeout(
      () =>
        dispatchMessage({
          ...VALID_PAYLOAD,
          code: null,
          error: 'access_denied',
          error_description: 'User declined',
        }),
      0,
    );
    await expect(promise).rejects.toThrow(/access_denied/);
  });

  it('user が popup を閉じたら reject', async () => {
    vi.useFakeTimers();
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
    });
    fakePopup.closed = true;
    vi.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow(/cancelled|closed/i);
    vi.useRealTimers();
  });

  it('window.open が null を返したら reject', async () => {
    openSpy.mockReturnValueOnce(null);
    await expect(
      openOAuthPopup({
        authorizationUrl: AUTH_URL,
        expectedState: EXPECTED_STATE,
        expectedOrigin: EXPECTED_ORIGIN,
      }),
    ).rejects.toThrow(/popup/i);
  });

  it('timeout で reject', async () => {
    const promise = openOAuthPopup({
      authorizationUrl: AUTH_URL,
      expectedState: EXPECTED_STATE,
      expectedOrigin: EXPECTED_ORIGIN,
      timeoutMs: 50,
    });
    await expect(promise).rejects.toThrow(/timeout/i);
  });
});
