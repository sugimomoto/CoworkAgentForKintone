// AccessPicker のテスト (#47)

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccessPicker } from './AccessPicker';

import type { AccessEntry, AccessValue } from '../../core/access/accessControl';

const EMPTY: AccessValue = {
  allowedUsers: [],
  allowedGroups: [],
  allowedOrganizations: [],
};

function makeSearchFn(entries: AccessEntry[]): ReturnType<typeof vi.fn> {
  return vi.fn(async (query: string, opts: { exclude: readonly string[] }) => {
    const excludeSet = new Set(opts.exclude);
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !excludeSet.has(e.code))
      .filter(
        (e) =>
          q.length === 0 ||
          e.name.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q),
      );
  });
}

// kintone のログイン名 = メアド前提 (userLabel が「名前（code）」で整形する)
const SATO: AccessEntry = { code: 'sato@example.com', name: '佐藤太郎' };
const TANAKA: AccessEntry = { code: 'tanaka', name: '田中花子' };
const SALES: AccessEntry = { code: 'sales-dept', name: '営業部' };
const ORG_TOKYO: AccessEntry = { code: 'org-tokyo', name: '東京本社' };

describe('AccessPicker', () => {
  it('全 0 → 「全員に公開」バナー', () => {
    render(
      <AccessPicker
        value={EMPTY}
        onChange={vi.fn()}
        searchUsers={makeSearchFn([SATO])}
        searchGroups={makeSearchFn([SALES])}
        searchOrganizations={makeSearchFn([ORG_TOKYO])}
      />,
    );
    expect(screen.getByText('全員に公開')).toBeInTheDocument();
  });

  it('指定あり → 「指定したメンバーに公開」バナー + 合計件数', () => {
    render(
      <AccessPicker
        value={{
          allowedUsers: ['sato', 'tanaka'],
          allowedGroups: ['sales-dept'],
          allowedOrganizations: [],
        }}
        onChange={vi.fn()}
        searchUsers={makeSearchFn([SATO, TANAKA])}
        searchGroups={makeSearchFn([SALES])}
        searchOrganizations={makeSearchFn([])}
      />,
    );
    expect(screen.getByText(/指定したメンバーに公開/)).toBeInTheDocument();
    expect(screen.getByText(/合計 3 件/)).toBeInTheDocument();
  });

  it('検索 input にフォーカス → 候補ドロップダウンが開く', async () => {
    const user = userEvent.setup();
    const searchUsers = makeSearchFn([SATO, TANAKA]);
    render(
      <AccessPicker
        value={EMPTY}
        onChange={vi.fn()}
        searchUsers={searchUsers}
        searchGroups={makeSearchFn([])}
        searchOrganizations={makeSearchFn([])}
      />,
    );
    const input = screen.getByLabelText('ユーザーを検索');
    await user.click(input);
    await waitFor(() => expect(searchUsers).toHaveBeenCalled());
    expect(screen.getByText(/佐藤太郎/)).toBeInTheDocument();
  });

  it('候補クリックでチップ追加 + onChange 呼出 + 入力クリア', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccessPicker
        value={EMPTY}
        onChange={onChange}
        searchUsers={makeSearchFn([SATO])}
        searchGroups={makeSearchFn([])}
        searchOrganizations={makeSearchFn([])}
      />,
    );
    const input = screen.getByLabelText('ユーザーを検索') as HTMLInputElement;
    await user.click(input);
    await screen.findByText(/佐藤太郎/);
    await user.click(screen.getByText(/佐藤太郎/));
    expect(onChange).toHaveBeenCalledWith({
      allowedUsers: ['sato@example.com'],
      allowedGroups: [],
      allowedOrganizations: [],
    });
  });

  it('既存チップの × ボタンで onChange (code 除去)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccessPicker
        value={{
          allowedUsers: ['sato@example.com'],
          allowedGroups: [],
          allowedOrganizations: [],
        }}
        onChange={onChange}
        searchUsers={makeSearchFn([SATO])}
        searchGroups={makeSearchFn([])}
        searchOrganizations={makeSearchFn([])}
      />,
    );
    // 初期 value は code のみなので、resolveEntries 渡さない場合は code が表示される
    // resolveEntries 未指定 → entry name = code = 'sato@example.com' (aria-label が code)
    const removeBtn = screen.getByLabelText(/sato@example\.com を削除/);
    await user.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith({
      allowedUsers: [],
      allowedGroups: [],
      allowedOrganizations: [],
    });
  });

  it('exclude に既選択を渡す (重複防止)', async () => {
    const user = userEvent.setup();
    const searchUsers = makeSearchFn([SATO, TANAKA]);
    render(
      <AccessPicker
        value={{
          allowedUsers: ['sato@example.com'],
          allowedGroups: [],
          allowedOrganizations: [],
        }}
        onChange={vi.fn()}
        searchUsers={searchUsers}
        searchGroups={makeSearchFn([])}
        searchOrganizations={makeSearchFn([])}
      />,
    );
    const input = screen.getByLabelText('ユーザーを検索');
    await user.click(input);
    await waitFor(() => expect(searchUsers).toHaveBeenCalled());
    // 最後の呼出の exclude に既選択が入っている (= 重複防止)
    const lastCall = searchUsers.mock.calls.at(-1)!;
    expect(lastCall[1]).toEqual({ exclude: ['sato@example.com'] });
  });

  it('resolveEntries で初期 code を name に解決して表示', async () => {
    const resolveEntries = vi.fn(async () => [SATO]);
    render(
      <AccessPicker
        value={{
          allowedUsers: ['sato@example.com'],
          allowedGroups: [],
          allowedOrganizations: [],
        }}
        onChange={vi.fn()}
        searchUsers={makeSearchFn([SATO])}
        searchGroups={makeSearchFn([])}
        searchOrganizations={makeSearchFn([])}
        resolveEntries={resolveEntries}
      />,
    );
    await waitFor(() => expect(resolveEntries).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText(/佐藤太郎（sato@example.com）/)).toBeInTheDocument();
    });
  });

  it('API エラー時に「再試行」ボタンが表示される', async () => {
    const user = userEvent.setup();
    const searchUsers = vi.fn().mockRejectedValue(new Error('500'));
    render(
      <AccessPicker
        value={EMPTY}
        onChange={vi.fn()}
        searchUsers={searchUsers}
        searchGroups={makeSearchFn([])}
        searchOrganizations={makeSearchFn([])}
      />,
    );
    const input = screen.getByLabelText('ユーザーを検索');
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByText(/候補を取得できませんでした/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });
});
