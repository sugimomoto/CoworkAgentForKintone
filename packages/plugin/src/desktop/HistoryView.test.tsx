import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listUserSessions } from '../core/bootstrap/resolveSession';
import { makeSession } from '../test/fixtures';

import { HistoryView } from './HistoryView';

vi.mock('../core/bootstrap/resolveSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../core/bootstrap/resolveSession')>()),
  listUserSessions: vi.fn(),
}));
vi.mock('../core/kintone/user', () => ({
  getCurrentSessionContext: vi.fn(() => ({
    kintoneUserCode: 'sato',
    kintoneDomain: 'example.cybozu.com',
  })),
}));

const mockList = vi.mocked(listUserSessions);

beforeEach(() => {
  mockList.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HistoryView', () => {
  it('マウント時に loading 表示 → 一覧表示に遷移する', async () => {
    let resolve!: (v: ReturnType<typeof makeSession>[]) => void;
    mockList.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );

    render(<HistoryView agentId="agent_1" onSelect={() => {}} />);

    expect(screen.getByText(/読み込み中/)).toBeInTheDocument();

    resolve([makeSession({ id: 'sess_a', title: '新規会話 - 2026-04-25 10:00' })]);

    await waitFor(() => {
      expect(screen.getByText('新規会話 - 2026-04-25 10:00')).toBeInTheDocument();
    });
  });

  it('listUserSessions に agentId + kctx が渡される', async () => {
    mockList.mockResolvedValue([]);
    render(<HistoryView agentId="agent_x" onSelect={() => {}} />);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith({
        agentId: 'agent_x',
        kintoneDomain: 'example.cybozu.com',
        kintoneUserCode: 'sato',
      });
    });
  });

  it('Session が空なら "まだ会話がありません" が表示される', async () => {
    mockList.mockResolvedValue([]);
    render(<HistoryView agentId="agent_1" onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/まだ会話がありません/)).toBeInTheDocument();
    });
  });

  it('fetch 失敗時はエラーメッセージと再試行ボタンを出す', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'));
    render(<HistoryView agentId="agent_1" onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/履歴の取得に失敗しました/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /再試行/ })).toBeInTheDocument();

    // 再試行で再フェッチされる
    mockList.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /再試行/ }));

    await waitFor(() => {
      expect(screen.getByText(/まだ会話がありません/)).toBeInTheDocument();
    });
  });

  it('エントリクリックで onSelect(sessionId) が呼ばれる', async () => {
    mockList.mockResolvedValue([
      makeSession({ id: 'sess_first', title: 'first' }),
      makeSession({ id: 'sess_second', title: 'second' }),
    ]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<HistoryView agentId="agent_1" onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('first')).toBeInTheDocument();
    });

    await user.click(screen.getByText('second'));
    expect(onSelect).toHaveBeenCalledWith('sess_second');
  });

  it('title が空のエントリは "(無題)" として表示される', async () => {
    const s = makeSession({ id: 'sess_x' });
    delete (s as { title?: string }).title;
    mockList.mockResolvedValue([s]);
    render(<HistoryView agentId="agent_1" onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('(無題)')).toBeInTheDocument();
    });
  });
});
