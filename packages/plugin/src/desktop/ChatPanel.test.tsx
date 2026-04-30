import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatPanel } from './ChatPanel';

import { _resetResolveDefaultAgentCache } from '../core/bootstrap/resolveAgent';
import { useChatStore } from '../store/chatStore';
import { makeAgent, makeEnv, makeSession } from '../test/fixtures';

vi.mock('../core/bootstrap/resolveAgent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/bootstrap/resolveAgent')>()),
  resolveDefaultAgent: vi.fn(),
}));
vi.mock('../core/bootstrap/resolveEnvironment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/bootstrap/resolveEnvironment')>()),
  resolveBootstrapEnvironment: vi.fn(),
}));
vi.mock('../core/bootstrap/resolveSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/bootstrap/resolveSession')>()),
  createUserSession: vi.fn(),
  listUserSessions: vi.fn(),
}));
vi.mock('../core/kintone/user', () => ({
  getCurrentSessionContext: vi.fn(() => ({
    kintoneUserCode: 'sato',
    kintoneDomain: 'example.cybozu.com',
  })),
}));
vi.mock('../core/managed-agents/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/managed-agents/events')>()),
  fetchAllEventsSince: vi.fn(),
  postUserMessage: vi.fn(),
  postToolConfirmation: vi.fn(),
  postUserInterrupt: vi.fn(),
}));
// useUserBinding は副作用 (listVaults / listEnvironments) を持つため、ChatPanel の
// テストでは明示的にモック化して bindingStatus / bind を直接コントロールする。
vi.mock('./hooks/useUserBinding', () => ({
  useUserBinding: vi.fn(),
}));

import { resolveDefaultAgent } from '../core/bootstrap/resolveAgent';
import { resolveBootstrapEnvironment } from '../core/bootstrap/resolveEnvironment';
import { createUserSession, listUserSessions } from '../core/bootstrap/resolveSession';
import {
  fetchAllEventsSince,
  postToolConfirmation,
  postUserInterrupt,
  postUserMessage,
} from '../core/managed-agents/events';
import { useUserBinding } from './hooks/useUserBinding';

const mockAgent = vi.mocked(resolveDefaultAgent);
const mockEnv = vi.mocked(resolveBootstrapEnvironment);
const mockCreateSession = vi.mocked(createUserSession);
const mockListSessions = vi.mocked(listUserSessions);
const mockFetch = vi.mocked(fetchAllEventsSince);
const mockPost = vi.mocked(postUserMessage);
const mockPostToolConfirmation = vi.mocked(postToolConfirmation);
const mockPostUserInterrupt = vi.mocked(postUserInterrupt);
const mockUseUserBinding = vi.mocked(useUserBinding);

const mockConnect = vi.fn().mockResolvedValue(undefined);

function setBootstrapOk(): void {
  mockAgent.mockResolvedValue(makeAgent({ id: 'agent_1' }));
  mockEnv.mockResolvedValue(makeEnv({ id: 'env_1' }));
}

function setBindingStatus(status: 'bound' | 'unbound' | 'binding' | 'error' | 'unknown' | 'checking', error: string | null = null): void {
  mockUseUserBinding.mockReturnValue({ status, error, connect: mockConnect });
}

/**
 * mid-session 状態 (sessionId + 1 件以上のメッセージ) を render 前にセットする。
 * 「会話途中で起きた事象」(OAuth 失効バナー / terminated バナー / tool retry 等) のテスト用。
 */
function seedMidSession(sessionId = 'sess_1'): void {
  useChatStore.getState().setSessionId(sessionId);
  useChatStore.getState().addMessage({ id: 'm-seed', kind: 'user', text: 'seed' });
}

beforeEach(() => {
  useChatStore.getState().reset();
  _resetResolveDefaultAgentCache();
  mockAgent.mockReset();
  mockEnv.mockReset();
  mockCreateSession.mockReset();
  mockListSessions.mockReset();
  mockFetch.mockReset();
  mockPost.mockReset();
  mockPostToolConfirmation.mockReset();
  mockPostUserInterrupt.mockReset();
  mockFetch.mockResolvedValue([]);
  mockPost.mockResolvedValue(undefined);
  mockPostToolConfirmation.mockResolvedValue(undefined);
  mockPostUserInterrupt.mockResolvedValue(undefined);
  mockListSessions.mockResolvedValue([]);
  mockConnect.mockReset();
  mockConnect.mockResolvedValue(undefined);
  // 既存テストは「バインド済」前提で書かれているのでデフォルト bound にする。
  // unbound / cancel をテストする箇所では個別に上書き。
  setBindingStatus('bound');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ChatPanel', () => {
  it('Header / MessageList / Composer を描画する', async () => {
    setBootstrapOk();
    render(<ChatPanel />);

    expect(screen.getByText('AGENT')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /送信/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(useChatStore.getState().status).toBe('ready');
    });
  });

  it('bootstrap 完了後は sessionId が無くても Composer が enabled になる', async () => {
    setBootstrapOk();
    render(<ChatPanel />);

    await waitFor(() => {
      expect(useChatStore.getState().status).toBe('ready');
    });
    expect(useChatStore.getState().sessionId).toBeNull();
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  it('sessionId 未設定で送信 → ensureSession で新規作成され、postUserMessage が呼ばれる', async () => {
    setBootstrapOk();
    mockCreateSession.mockResolvedValue(makeSession({ id: 'sess_new' }));

    const user = userEvent.setup();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    await user.type(screen.getByRole('textbox'), 'こんにちは{Enter}');

    expect(await screen.findByText('こんにちは')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith('sess_new', 'こんにちは');
    });
    expect(useChatStore.getState().sessionId).toBe('sess_new');
  });

  it('送信直後にオプティミスティック thinking が表示される (id プレフィックス pending-)', async () => {
    setBootstrapOk();
    mockCreateSession.mockResolvedValue(makeSession({ id: 'sess_new' }));

    const user = userEvent.setup();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    await user.type(screen.getByRole('textbox'), 'こんにちは{Enter}');

    await waitFor(() => {
      const msgs = useChatStore.getState().messages;
      const hasPending = msgs.some((m) => m.kind === 'thinking' && m.id.startsWith('pending-'));
      expect(hasPending).toBe(true);
    });
  });

  it('sessionId 既存のときは ensureSession で再作成しない', async () => {
    setBootstrapOk();
    const user = userEvent.setup();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));
    useChatStore.getState().setSessionId('sess_existing');

    await user.type(screen.getByRole('textbox'), 'やあ{Enter}');

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('sess_existing', 'やあ');
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('bootstrap エラー時はエラーメッセージを表示する', async () => {
    mockAgent.mockRejectedValue(new Error('API Key が無効です'));
    render(<ChatPanel />);

    await waitFor(() => {
      expect(screen.getByText(/API Key が無効です/)).toBeInTheDocument();
    });
  });

  it('bootstrapping 中は入力が disabled', () => {
    mockAgent.mockImplementation(() => new Promise(() => {}));
    render(<ChatPanel />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('view が history のとき HistoryView が表示され MessageList/Composer は描画されない', async () => {
    setBootstrapOk();
    mockListSessions.mockResolvedValue([
      makeSession({ id: 'sess_a', title: '新規会話 - 2026-04-25 10:00' }),
    ]);
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    useChatStore.getState().setView('history');

    await waitFor(() => {
      expect(screen.getByText(/過去の会話/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Header の履歴ボタンで view が chat ⇄ history に切替わる', async () => {
    setBootstrapOk();
    const user = userEvent.setup();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    await user.click(screen.getByLabelText('履歴'));
    expect(useChatStore.getState().view).toBe('history');

    await user.click(screen.getByLabelText('履歴'));
    expect(useChatStore.getState().view).toBe('chat');
  });

  it('messages 空 + sessionId 未確立のときは WelcomeMessage を表示する', async () => {
    setBootstrapOk();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    expect(screen.getByTestId('welcome-message')).toBeInTheDocument();
    expect(screen.getByText(/Cowork Agent へようこそ/)).toBeInTheDocument();
  });

  it('sessionId が確立されたら WelcomeMessage は非表示になる', async () => {
    setBootstrapOk();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));
    useChatStore.getState().setSessionId('sess_x');

    await waitFor(() => {
      expect(screen.queryByTestId('welcome-message')).toBeNull();
    });
  });

  it('bindingStatus=unbound で Composer の代わりに ConnectKintoneButton が表示され、postUserMessage は呼ばれない', async () => {
    setBootstrapOk();
    setBindingStatus('unbound');

    render(<ChatPanel />);
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    expect(await screen.findByTestId('connect-kintone')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('bindingStatus=error で再試行ボタンが表示される', async () => {
    setBootstrapOk();
    setBindingStatus('error', 'auth failed');

    render(<ChatPanel />);
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    expect(await screen.findByTestId('connect-kintone-error')).toBeInTheDocument();
    expect(screen.getByText(/auth failed/)).toBeInTheDocument();
  });

  it('Header の再連携ボタン押下で useUserBinding.connect() が呼ばれる (bound 状態)', async () => {
    setBootstrapOk();
    setBindingStatus('bound');
    mockConnect.mockClear();

    const user = userEvent.setup();
    render(<ChatPanel />);
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    const button = screen.getByLabelText('kintone を再連携');
    await user.click(button);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('Header の再連携ボタンは bindingStatus=unbound の時は表示しない (ConnectKintoneButton と重複しない)', async () => {
    setBootstrapOk();
    setBindingStatus('unbound');

    render(<ChatPanel />);
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    expect(screen.queryByLabelText('kintone を再連携')).not.toBeInTheDocument();
  });

  it('Header の再連携ボタンは bindingStatus=binding の時 disabled', async () => {
    setBootstrapOk();
    setBindingStatus('binding');

    render(<ChatPanel />);
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    const button = screen.getByLabelText('kintone を再連携');
    expect(button).toBeDisabled();
  });

  it('Header の設定アイコンクリックで onSettingsClick が呼ばれる', async () => {
    setBootstrapOk();
    setBindingStatus('bound');

    const onSettingsClick = vi.fn();
    const user = userEvent.setup();
    render(<ChatPanel onSettingsClick={onSettingsClick} />);
    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

    await user.click(screen.getByLabelText('設定'));
    expect(onSettingsClick).toHaveBeenCalled();
  });

  it('Header の新規会話ボタンで startNewConversation が呼ばれる (sessionId と messages がクリアされる)', async () => {
    setBootstrapOk();
    const user = userEvent.setup();
    render(<ChatPanel />);

    await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));
    useChatStore.getState().setSessionId('sess_a');
    useChatStore.getState().addMessage({ id: 'm1', kind: 'user', text: 'x' });
    useChatStore.getState().setView('history');

    await user.click(screen.getByLabelText('新規会話'));

    expect(useChatStore.getState().sessionId).toBeNull();
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().view).toBe('chat');
  });

  describe('F4-1 キャンセルボタン (Agent ターン中断)', () => {
    it('isAgentRunning=true で送信ボタンの代わりにキャンセルボタンが出る', async () => {
      setBootstrapOk();

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setAgentRunning(true);

      await waitFor(() => {
        expect(screen.getByLabelText('キャンセル')).toBeInTheDocument();
      });
    });

    it('キャンセルクリック → postUserInterrupt + isAgentRunning=false', async () => {
      const user = userEvent.setup();
      setBootstrapOk();

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().setAgentRunning(true);

      await user.click(await screen.findByLabelText('キャンセル'));

      expect(mockPostUserInterrupt).toHaveBeenCalledWith('sess_1');
      expect(useChatStore.getState().isAgentRunning).toBe(false);
    });
  });

  describe('F3-1 API Key 認証エラー → 設定画面 CTA', () => {
    it('status=error + auth キーワードで「プラグイン設定を開く」が出る', async () => {
      setBootstrapOk();
      const onSettingsClick = vi.fn();
      render(<ChatPanel onSettingsClick={onSettingsClick} />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setStatus('error', 'authentication_error: invalid api key');

      const user = userEvent.setup();
      const cta = await screen.findByRole('button', { name: 'プラグイン設定を開く' });
      await user.click(cta);
      expect(onSettingsClick).toHaveBeenCalled();
    });

    it('auth と無関係なエラーでは CTA は出ない', async () => {
      setBootstrapOk();
      render(<ChatPanel onSettingsClick={vi.fn()} />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setStatus('error', 'failed to fetch');

      await waitFor(() => expect(useChatStore.getState().error).toMatch(/failed/));
      expect(screen.queryByRole('button', { name: 'プラグイン設定を開く' })).toBeNull();
    });
  });

  describe('F3-2 OAuth 失効 → 再連携バナー (mid-session)', () => {
    it('mid-session (session 有り) で bindingStatus=error なら再連携バナーが出る', async () => {
      setBootstrapOk();
      setBindingStatus('error', 'token expired');
      seedMidSession();

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      const banner = await screen.findByText(/連携が切れています/);
      expect(banner).toBeInTheDocument();
      // mid-session では Composer は表示され続ける (ConnectKintoneButton ではない)
      expect(screen.queryByTestId('connect-kintone-error')).toBeNull();
    });

    it('初期未バインド (sessionId / messages なし) では再連携バナーは出ず ConnectKintoneButton 側で出る', async () => {
      setBootstrapOk();
      setBindingStatus('error', 'init failure');

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      expect(screen.queryByText(/連携が切れています/)).toBeNull();
      // ConnectKintoneButton 側のエラー表示は出る
      expect(await screen.findByTestId('connect-kintone-error')).toBeInTheDocument();
    });
  });

  describe('F3-4 session terminated → 新規セッションボタン', () => {
    it('sessionTerminated=true でバナーと「新しいセッションを開始」ボタンが出る', async () => {
      setBootstrapOk();

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().setSessionTerminated(true);

      const banner = await screen.findByText(/このセッションは終了しています/);
      expect(banner).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: '新しいセッションを開始' }));

      expect(useChatStore.getState().sessionTerminated).toBe(false);
      expect(useChatStore.getState().sessionId).toBeNull();
    });

    it('sessionTerminated=true 時は Composer が disabled', async () => {
      setBootstrapOk();
      setBindingStatus('bound');

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionTerminated(true);

      await waitFor(() => {
        expect(screen.getByLabelText('メッセージ入力')).toBeDisabled();
      });
    });
  });

  describe('F3-3 Worker 5xx → Retry ボタン (tool error)', () => {
    it('error 状態の tool カードで「もう一度試す」をクリック → postUserMessage が呼ばれる', async () => {
      const user = userEvent.setup();
      setBootstrapOk();

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().addMessage({
        id: 'tu_err',
        kind: 'tool',
        name: 'kintone-add-record',
        input: { app: '5' },
        status: 'error',
        errorText: 'Worker 503',
      });

      await user.click(await screen.findByRole('button', { name: 'もう一度試す' }));

      expect(mockPost).toHaveBeenCalledWith('sess_1', expect.stringMatching(/再試行|もう一度|失敗したツール/));
    });
  });

  describe('HITL 承認 UI', () => {
    it('承認ボタンクリック → postToolConfirmation(allow) が呼ばれて status=running に戻る', async () => {
      const user = userEvent.setup();
      setBootstrapOk();
      mockCreateSession.mockResolvedValue(makeSession({ id: 'sess_1', agent: { id: 'agent_1', type: 'agent' } }));

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      // セッションをセットして tool message を pending-confirmation で配置
      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().addMessage({
        id: 'tu_1',
        kind: 'tool',
        name: 'kintone-delete-records',
        input: { app: '5', ids: ['1', '2'] },
        status: 'pending-confirmation',
      });

      const approveBtn = await screen.findByRole('button', { name: '承認' });
      await user.click(approveBtn);

      expect(mockPostToolConfirmation).toHaveBeenCalledWith('sess_1', 'tu_1', 'allow');
      const m = useChatStore.getState().messages.find((x) => x.id === 'tu_1')!;
      expect(m.kind).toBe('tool');
      if (m.kind === 'tool') expect(m.status).toBe('running');
    });

    it('却下ボタンクリック → postToolConfirmation(deny) + tool が error 状態になる', async () => {
      const user = userEvent.setup();
      setBootstrapOk();
      mockCreateSession.mockResolvedValue(makeSession({ id: 'sess_1', agent: { id: 'agent_1', type: 'agent' } }));

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().addMessage({
        id: 'tu_2',
        kind: 'tool',
        name: 'kintone-delete-records',
        input: { app: '5', ids: ['9'] },
        status: 'pending-confirmation',
      });

      const rejectBtn = await screen.findByRole('button', { name: '却下' });
      await user.click(rejectBtn);

      expect(mockPostToolConfirmation).toHaveBeenCalledWith(
        'sess_1',
        'tu_2',
        'deny',
        expect.stringMatching(/却下/),
      );
      const m = useChatStore.getState().messages.find((x) => x.id === 'tu_2')!;
      expect(m.kind).toBe('tool');
      if (m.kind === 'tool') {
        // 却下時は `error` ではなく `rejected` 状態 (retry ボタンを出さない)
        expect(m.status).toBe('rejected');
      }
    });

    it('reject 失敗時は pending-confirmation に戻し errorText もクリアする', async () => {
      const user = userEvent.setup();
      setBootstrapOk();
      mockCreateSession.mockResolvedValue(makeSession({ id: 'sess_1', agent: { id: 'agent_1', type: 'agent' } }));
      mockPostToolConfirmation.mockRejectedValueOnce(new Error('network'));

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().addMessage({
        id: 'tu_4',
        kind: 'tool',
        name: 'kintone-delete-records',
        input: { app: '5', ids: ['1'] },
        status: 'pending-confirmation',
      });

      await user.click(await screen.findByRole('button', { name: '却下' }));

      await waitFor(() => {
        const m = useChatStore.getState().messages.find((x) => x.id === 'tu_4')!;
        if (m.kind === 'tool') {
          expect(m.status).toBe('pending-confirmation');
          // errorText: '却下しました' が残留しないこと
          expect(m.errorText).toBeUndefined();
        }
      });
    });

    it('postToolConfirmation 失敗時は pending-confirmation に戻して再試行可能', async () => {
      const user = userEvent.setup();
      setBootstrapOk();
      mockCreateSession.mockResolvedValue(makeSession({ id: 'sess_1', agent: { id: 'agent_1', type: 'agent' } }));
      mockPostToolConfirmation.mockRejectedValueOnce(new Error('network'));

      render(<ChatPanel />);
      await waitFor(() => expect(useChatStore.getState().status).toBe('ready'));

      useChatStore.getState().setSessionId('sess_1');
      useChatStore.getState().addMessage({
        id: 'tu_3',
        kind: 'tool',
        name: 'kintone-delete-records',
        input: { app: '5', ids: ['1'] },
        status: 'pending-confirmation',
      });

      await user.click(await screen.findByRole('button', { name: '承認' }));

      await waitFor(() => {
        const m = useChatStore.getState().messages.find((x) => x.id === 'tu_3')!;
        if (m.kind === 'tool') expect(m.status).toBe('pending-confirmation');
      });
    });
  });
});
