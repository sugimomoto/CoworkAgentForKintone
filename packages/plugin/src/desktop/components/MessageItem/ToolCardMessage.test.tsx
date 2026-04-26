import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ToolCardMessage } from './ToolCardMessage';

import type { ToolMessage } from '../MessageList';

function make(partial: Partial<ToolMessage> = {}): ToolMessage {
  return {
    id: 'tu_1',
    kind: 'tool',
    name: 'kintone-add-record',
    input: { app: '1', record: { title: { value: 'x' } } },
    status: 'running',
    ...partial,
  } as ToolMessage;
}

describe('ToolCardMessage', () => {
  describe('状態別レンダ', () => {
    it('running は data-tool-status=running + 「実行中…」', () => {
      const { container } = render(<ToolCardMessage message={make({ status: 'running' })} />);
      const card = container.querySelector('[data-tool-status]');
      expect(card?.getAttribute('data-tool-status')).toBe('running');
      expect(screen.getByText('実行中…')).toBeTruthy();
    });

    it('success は「完了」', () => {
      render(<ToolCardMessage message={make({ status: 'success', result: { id: '42' } })} />);
      expect(screen.getByText('完了')).toBeTruthy();
    });

    it('error は「失敗」+ errorText 表示', () => {
      render(
        <ToolCardMessage
          message={make({ status: 'error', errorText: 'kintone API error: app not found' })}
        />,
      );
      expect(screen.getByText('失敗')).toBeTruthy();
      expect(screen.getByText(/kintone API error/)).toBeTruthy();
    });

    it('pending-confirmation は承認/却下ボタンが出る', () => {
      render(<ToolCardMessage message={make({ status: 'pending-confirmation' })} />);
      expect(screen.getByRole('button', { name: '承認' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '却下' })).toBeTruthy();
    });

    it('pending-confirmation 以外ではボタンは出ない', () => {
      render(<ToolCardMessage message={make({ status: 'success' })} />);
      expect(screen.queryByRole('button', { name: '承認' })).toBeNull();
    });
  });

  describe('引数サマリ', () => {
    it('kintone-add-record: app + フィールドリスト', () => {
      render(
        <ToolCardMessage
          message={make({
            name: 'kintone-add-record',
            input: { app: '5', record: { title: { value: 'a' }, status: { value: 'b' } } },
          })}
        />,
      );
      expect(screen.getByText(/app=5.*fields=\[title, status\]/)).toBeTruthy();
    });

    it('kintone-update-record: id 指定', () => {
      render(
        <ToolCardMessage
          message={make({
            name: 'kintone-update-record',
            input: { app: '5', id: '123', record: { x: { value: 'y' } } },
          })}
        />,
      );
      expect(screen.getByText(/app=5.*id=123.*fields=\[x\]/)).toBeTruthy();
    });

    it('kintone-update-record: updateKey 指定', () => {
      render(
        <ToolCardMessage
          message={make({
            name: 'kintone-update-record',
            input: { app: '5', updateKey: { field: 'code', value: 'ABC' }, record: { x: { value: 'y' } } },
          })}
        />,
      );
      expect(screen.getByText(/updateKey\.code=ABC/)).toBeTruthy();
    });

    it('kintone-delete-records: ids 一覧 + 件数', () => {
      render(
        <ToolCardMessage
          message={make({
            name: 'kintone-delete-records',
            input: { app: '5', ids: ['1', '2', '3'] },
          })}
        />,
      );
      expect(screen.getByText(/ids=\[1, 2, 3\].*\(3 件\)/)).toBeTruthy();
    });

    it('kintone-delete-records: 6 件以上は省略', () => {
      render(
        <ToolCardMessage
          message={make({
            name: 'kintone-delete-records',
            input: { app: '5', ids: ['1', '2', '3', '4', '5', '6', '7'] },
          })}
        />,
      );
      expect(screen.getByText(/…他 2 件.*\(7 件\)/)).toBeTruthy();
    });

    it('kintone-add-record-comment: text 切り詰め', () => {
      render(
        <ToolCardMessage
          message={make({
            name: 'kintone-add-record-comment',
            input: { app: '5', record: '99', comment: { text: 'a'.repeat(50) } },
          })}
        />,
      );
      expect(screen.getByText(/record=99.*text="a{30}…"/)).toBeTruthy();
    });

    it('未知のツールは JSON 切り詰めにフォールバック', () => {
      render(
        <ToolCardMessage
          message={make({ name: 'something-else', input: { foo: 'bar' } })}
        />,
      );
      expect(screen.getByText(/{"foo":"bar"}/)).toBeTruthy();
    });
  });

  describe('折り畳み詳細', () => {
    it('details の summary をクリックすると input が表示される', () => {
      const { container } = render(
        <ToolCardMessage
          message={make({ status: 'success', input: { app: '5' }, result: { id: '42' } })}
        />,
      );
      const details = container.querySelector('details');
      expect(details).toBeTruthy();
      expect(details?.open).toBe(false);
      // 開いた状態を確認
      details!.open = true;
      expect(container.textContent).toContain('"app": "5"');
      expect(container.textContent).toContain('"id": "42"');
    });
  });

  describe('running 状態', () => {
    it('running 時はスピナー (animate-spin) が出る', () => {
      const { container } = render(<ToolCardMessage message={make({ status: 'running' })} />);
      expect(container.querySelector('.animate-spin')).toBeTruthy();
    });

    it('success 時はスピナーは出ない (チェックアイコンのみ)', () => {
      const { container } = render(<ToolCardMessage message={make({ status: 'success' })} />);
      expect(container.querySelector('.animate-spin')).toBeNull();
    });
  });

  describe('error 時の retry ボタン', () => {
    it('onRetry を渡すと「もう一度試す」ボタンが出る', () => {
      const onRetry = vi.fn();
      render(
        <ToolCardMessage
          message={make({ status: 'error', errorText: 'oops' })}
          onRetry={onRetry}
        />,
      );
      const btn = screen.getByRole('button', { name: 'もう一度試す' });
      fireEvent.click(btn);
      expect(onRetry).toHaveBeenCalledWith('tu_1');
    });

    it('onRetry を渡さなければボタンは出ない', () => {
      render(<ToolCardMessage message={make({ status: 'error', errorText: 'oops' })} />);
      expect(screen.queryByRole('button', { name: 'もう一度試す' })).toBeNull();
    });

    it('success 時は onRetry を渡しても出ない', () => {
      render(<ToolCardMessage message={make({ status: 'success' })} onRetry={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'もう一度試す' })).toBeNull();
    });
  });

  describe('承認 / 却下ボタン', () => {
    it('承認クリック → onApprove(toolUseId) が呼ばれる', () => {
      const onApprove = vi.fn();
      render(
        <ToolCardMessage
          message={make({ id: 'tu_42', status: 'pending-confirmation' })}
          onApprove={onApprove}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '承認' }));
      expect(onApprove).toHaveBeenCalledWith('tu_42');
    });

    it('却下クリック → onReject(toolUseId) が呼ばれる', () => {
      const onReject = vi.fn();
      render(
        <ToolCardMessage
          message={make({ id: 'tu_42', status: 'pending-confirmation' })}
          onReject={onReject}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '却下' }));
      expect(onReject).toHaveBeenCalledWith('tu_42');
    });
  });
});
