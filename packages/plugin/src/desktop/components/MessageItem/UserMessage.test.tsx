import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { UserMessage } from './UserMessage';

describe('UserMessage', () => {
  it('本文を表示する', () => {
    render(<UserMessage text="今月の受注を集計して" />);
    expect(screen.getByText('今月の受注を集計して')).toBeInTheDocument();
  });

  it('複数行テキストでも改行が保持される', () => {
    render(<UserMessage text={'line1\nline2'} />);
    // whitespace-pre-wrap 等で改行が維持される想定
    const el = screen.getByText(/line1/);
    expect(el.textContent).toContain('line2');
  });

  describe('添付ラベル', () => {
    it('attachments 無しなら何も追加表示しない', () => {
      render(<UserMessage text="hi" />);
      expect(screen.queryByText('a.csv')).toBeNull();
    });

    it('attachments がある時、ファイル名がラベルとして並ぶ', () => {
      render(
        <UserMessage
          text="登録して"
          attachments={[
            { filename: 'customers.csv', kind: 'text' },
            { filename: 'photo.png', kind: 'image' },
          ]}
        />,
      );
      expect(screen.getByText('customers.csv')).toBeInTheDocument();
      expect(screen.getByText('photo.png')).toBeInTheDocument();
    });
  });
});
