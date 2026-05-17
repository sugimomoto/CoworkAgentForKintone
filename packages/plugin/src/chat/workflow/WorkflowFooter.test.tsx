// WorkflowFooter のテスト
//
// 5 状態それぞれで step / status line / primary action / error 表示が design 通りに
// 切り替わるかを検証。

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowFooter } from './WorkflowFooter';

import type { WorkflowCallbacks, WorkflowState } from './useApplyWorkflow';

function makeCallbacks(overrides: Partial<WorkflowCallbacks> = {}): WorkflowCallbacks {
  return {
    preview: vi.fn().mockResolvedValue(undefined),
    apply: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderFooter(state: WorkflowState, callbacks: WorkflowCallbacks = makeCallbacks()): void {
  render(
    <WorkflowFooter
      artifactId="art_1"
      appName="案件管理"
      callbacks={callbacks}
      initialState={state}
    />,
  );
}

describe('WorkflowFooter', () => {
  describe('state=ready', () => {
    it('step.preview=current / step.apply=locked / step.rollback=locked', () => {
      renderFooter('ready');
      expect(screen.getByTestId('workflow-step-preview').getAttribute('data-status')).toBe('current');
      expect(screen.getByTestId('workflow-step-apply').getAttribute('data-status')).toBe('locked');
      expect(screen.getByTestId('workflow-step-rollback').getAttribute('data-status')).toBe('locked');
    });

    it('"プレビューを実行" ボタンが primary action', () => {
      renderFooter('ready');
      expect(screen.getByTestId('workflow-action-preview')).toBeInTheDocument();
    });

    it('status line は neutral / "まだ実機で動かしていません"', () => {
      renderFooter('ready');
      expect(screen.getByTestId('workflow-status-dot').getAttribute('data-tone')).toBe('neutral');
      expect(screen.getByTestId('workflow-status-line').textContent).toContain('まだ実機で動かしていません');
    });
  });

  describe('state=previewed', () => {
    it('step.preview=done / step.apply=current', () => {
      renderFooter('previewed');
      expect(screen.getByTestId('workflow-step-preview').getAttribute('data-status')).toBe('done');
      expect(screen.getByTestId('workflow-step-apply').getAttribute('data-status')).toBe('current');
    });

    it('"もう一度プレビュー" + "kintone に適用" の 2 ボタン', () => {
      renderFooter('previewed');
      expect(screen.getByTestId('workflow-action-preview-again')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-action-apply')).toBeInTheDocument();
    });

    it('status line は ok / "本番反映できます"', () => {
      renderFooter('previewed');
      expect(screen.getByTestId('workflow-status-dot').getAttribute('data-tone')).toBe('ok');
      expect(screen.getByTestId('workflow-status-line').textContent).toContain('本番反映できます');
    });
  });

  describe('state=applied', () => {
    it('step.apply=done / step.rollback=current', () => {
      renderFooter('applied');
      expect(screen.getByTestId('workflow-step-apply').getAttribute('data-status')).toBe('done');
      expect(screen.getByTestId('workflow-step-rollback').getAttribute('data-status')).toBe('current');
    });

    it('"ロールバック" ボタンが primary action (warn 色)', () => {
      renderFooter('applied');
      expect(screen.getByTestId('workflow-action-rollback')).toBeInTheDocument();
    });

    it('status line は ok / appName を含む', () => {
      renderFooter('applied');
      expect(screen.getByTestId('workflow-status-line').textContent).toContain('「案件管理」に適用済');
    });
  });

  describe('state=rolled-back', () => {
    it('全 step done / "もう一度適用" ボタン', () => {
      renderFooter('rolled-back');
      expect(screen.getByTestId('workflow-step-preview').getAttribute('data-status')).toBe('done');
      expect(screen.getByTestId('workflow-step-apply').getAttribute('data-status')).toBe('done');
      expect(screen.getByTestId('workflow-step-rollback').getAttribute('data-status')).toBe('done');
      expect(screen.getByTestId('workflow-action-reapply')).toBeInTheDocument();
    });

    it('status line は warn / "ロールバック完了"', () => {
      renderFooter('rolled-back');
      expect(screen.getByTestId('workflow-status-dot').getAttribute('data-tone')).toBe('warn');
      expect(screen.getByTestId('workflow-status-line').textContent).toContain('ロールバック完了');
    });
  });

  describe('ボタンクリックで callbacks が呼ばれる', () => {
    it('ready → プレビュー → callbacks.preview', async () => {
      const callbacks = makeCallbacks();
      const user = userEvent.setup();
      renderFooter('ready', callbacks);
      await user.click(screen.getByTestId('workflow-action-preview'));
      expect(callbacks.preview).toHaveBeenCalledOnce();
    });

    it('previewed → 適用 → callbacks.apply', async () => {
      const callbacks = makeCallbacks();
      const user = userEvent.setup();
      renderFooter('previewed', callbacks);
      await user.click(screen.getByTestId('workflow-action-apply'));
      expect(callbacks.apply).toHaveBeenCalledOnce();
    });

    it('applied → ロールバック → callbacks.rollback', async () => {
      const callbacks = makeCallbacks();
      const user = userEvent.setup();
      renderFooter('applied', callbacks);
      await user.click(screen.getByTestId('workflow-action-rollback'));
      expect(callbacks.rollback).toHaveBeenCalledOnce();
    });
  });

  describe('エラー処理', () => {
    it('preview が reject すると status line に error 表示', async () => {
      const callbacks = makeCallbacks({
        preview: vi.fn().mockRejectedValue(new Error('sandbox boom')),
      });
      const user = userEvent.setup();
      renderFooter('ready', callbacks);
      await act(async () => {
        await user.click(screen.getByTestId('workflow-action-preview'));
      });
      expect(screen.getByTestId('workflow-status-line').textContent).toContain('sandbox boom');
    });
  });

  describe('applying の遷移表示', () => {
    it('apply 実行中は applying step が inprogress + spinner / 適用ボタン disabled', async () => {
      let resolveApply!: () => void;
      const callbacks = makeCallbacks({
        apply: vi.fn(
          () =>
            new Promise<void>((r) => {
              resolveApply = r;
            }),
        ),
      });
      const user = userEvent.setup();
      renderFooter('previewed', callbacks);
      await act(async () => {
        await user.click(screen.getByTestId('workflow-action-apply'));
      });

      expect(screen.getByTestId('workflow-step-apply').getAttribute('data-status')).toBe(
        'inprogress',
      );
      expect(screen.getByTestId('workflow-step-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-action-applying')).toBeDisabled();

      await act(async () => {
        resolveApply();
        // wait for state update
        await new Promise((r) => setTimeout(r, 0));
      });
    });
  });
});
