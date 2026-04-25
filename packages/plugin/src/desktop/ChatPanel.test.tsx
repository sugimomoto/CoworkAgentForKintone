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
}));

import { resolveDefaultAgent } from '../core/bootstrap/resolveAgent';
import { resolveBootstrapEnvironment } from '../core/bootstrap/resolveEnvironment';
import { createUserSession, listUserSessions } from '../core/bootstrap/resolveSession';
import { fetchAllEventsSince, postUserMessage } from '../core/managed-agents/events';

const mockAgent = vi.mocked(resolveDefaultAgent);
const mockEnv = vi.mocked(resolveBootstrapEnvironment);
const mockCreateSession = vi.mocked(createUserSession);
const mockListSessions = vi.mocked(listUserSessions);
const mockFetch = vi.mocked(fetchAllEventsSince);
const mockPost = vi.mocked(postUserMessage);

function setBootstrapOk(): void {
  mockAgent.mockResolvedValue(makeAgent({ id: 'agent_1' }));
  mockEnv.mockResolvedValue(makeEnv({ id: 'env_1' }));
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
  mockFetch.mockResolvedValue([]);
  mockPost.mockResolvedValue(undefined);
  mockListSessions.mockResolvedValue([]);
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
});
