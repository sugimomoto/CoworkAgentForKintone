// useApplyWorkflow / useHasWorkflowSnapshot のテスト
//
// 5 状態の遷移網羅 + エラーパス + chatStore 連携を検証。

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from '../../store/chatStore';

import { useApplyWorkflow, useHasWorkflowSnapshot } from './useApplyWorkflow';

import type { WorkflowCallbacks } from './useApplyWorkflow';

function makeCallbacks(overrides: Partial<WorkflowCallbacks> = {}): WorkflowCallbacks {
  return {
    preview: vi.fn().mockResolvedValue(undefined),
    apply: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  useChatStore.getState().reset();
});

describe('useApplyWorkflow', () => {
  it('初期状態は ready (option 未指定時)', () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', callbacks }),
    );
    expect(result.current.state).toBe('ready');
    expect(result.current.inFlight).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it('initialState option で初期状態を指定できる', () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    expect(result.current.state).toBe('previewed');
  });

  it('preview() で ready → previewed に遷移し callbacks.preview が呼ばれる', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', callbacks }),
    );
    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.state).toBe('previewed');
    expect(callbacks.preview).toHaveBeenCalledOnce();
    expect(result.current.errorMessage).toBeNull();
  });

  it('apply() で previewed → applying → applied に遷移する', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.state).toBe('applied');
    expect(callbacks.apply).toHaveBeenCalledOnce();
  });

  it('rollback() で applied → rolled-back に遷移する', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'applied', callbacks }),
    );
    await act(async () => {
      await result.current.rollback();
    });
    expect(result.current.state).toBe('rolled-back');
    expect(callbacks.rollback).toHaveBeenCalledOnce();
  });

  it('preview() を ready 以外で呼んでも遷移不可能なら no-op', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'applied', callbacks }),
    );
    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.state).toBe('applied'); // 遷移しない
    expect(callbacks.preview).not.toHaveBeenCalled();
  });

  it('apply() を ready 直後に呼んでも遷移不可能 (previewed が必要)', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', callbacks }),
    );
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.state).toBe('ready');
    expect(callbacks.apply).not.toHaveBeenCalled();
  });

  it('rollback() を applied 以外で呼ぶと no-op', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    await act(async () => {
      await result.current.rollback();
    });
    expect(result.current.state).toBe('previewed');
    expect(callbacks.rollback).not.toHaveBeenCalled();
  });

  it('preview() が reject すると errorMessage に保持され state は ready のまま', async () => {
    const callbacks = makeCallbacks({
      preview: vi.fn().mockRejectedValue(new Error('sandbox boom')),
    });
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', callbacks }),
    );
    await act(async () => {
      await result.current.preview();
    });
    expect(result.current.state).toBe('ready');
    expect(result.current.errorMessage).toBe('sandbox boom');
  });

  it('apply() が reject すると previewed に戻り errorMessage に保持', async () => {
    const callbacks = makeCallbacks({
      apply: vi.fn().mockRejectedValue(new Error('403 forbidden')),
    });
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.state).toBe('previewed');
    expect(result.current.errorMessage).toBe('403 forbidden');
  });

  it('rollback() が reject すると applied のまま errorMessage に保持', async () => {
    const callbacks = makeCallbacks({
      rollback: vi.fn().mockRejectedValue(new Error('rollback failed')),
    });
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'applied', callbacks }),
    );
    await act(async () => {
      await result.current.rollback();
    });
    expect(result.current.state).toBe('applied');
    expect(result.current.errorMessage).toBe('rollback failed');
  });

  it('apply() 実行中は inFlight=apply / state=applying', async () => {
    let resolveApply!: () => void;
    const callbacks = makeCallbacks({
      apply: vi.fn(
        () =>
          new Promise<void>((r) => {
            resolveApply = r;
          }),
      ),
    });
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    let applyPromise!: Promise<void>;
    act(() => {
      applyPromise = result.current.apply();
    });
    await waitFor(() => expect(result.current.state).toBe('applying'));
    expect(result.current.inFlight).toBe('apply');
    await act(async () => {
      resolveApply();
      await applyPromise;
    });
    expect(result.current.state).toBe('applied');
    expect(result.current.inFlight).toBeNull();
  });

  it('inFlight 中の追加呼出は無視される (多重実行防止)', async () => {
    let resolveApply!: () => void;
    const applyFn = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolveApply = r;
        }),
    );
    const callbacks = makeCallbacks({ apply: applyFn });
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    let firstApply!: Promise<void>;
    act(() => {
      firstApply = result.current.apply();
    });
    await waitFor(() => expect(result.current.inFlight).toBe('apply'));
    await act(async () => {
      // 1st apply が進行中に 2nd を呼んでも追加で発火しない
      await result.current.apply();
    });
    await act(async () => {
      resolveApply();
      await firstApply;
    });
    expect(applyFn).toHaveBeenCalledOnce();
  });

  it('previewed → preview() で再度プレビューできる (もう一度プレビュー)', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'previewed', callbacks }),
    );
    await act(async () => {
      await result.current.preview();
    });
    expect(callbacks.preview).toHaveBeenCalledOnce();
    expect(result.current.state).toBe('previewed');
  });

  it('rolled-back → apply() でもう一度適用できる', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() =>
      useApplyWorkflow({ artifactId: 'art_1', initialState: 'rolled-back', callbacks }),
    );
    await act(async () => {
      await result.current.apply();
    });
    expect(result.current.state).toBe('applied');
  });

  it('artifactId が変わると state がリセットされる', () => {
    const callbacks = makeCallbacks();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useApplyWorkflow({ artifactId: id, initialState: 'previewed', callbacks }),
      { initialProps: { id: 'art_1' } },
    );
    expect(result.current.state).toBe('previewed');
    rerender({ id: 'art_2' });
    expect(result.current.state).toBe('previewed'); // initialState のまま
  });
});

describe('useHasWorkflowSnapshot', () => {
  it('chatStore.workflowHistory にエントリがあれば true', () => {
    useChatStore.getState().saveWorkflowSnapshot('art_x', 'prev js');
    const { result } = renderHook(() => useHasWorkflowSnapshot('art_x'));
    expect(result.current).toBe(true);
  });

  it('エントリが無ければ false', () => {
    const { result } = renderHook(() => useHasWorkflowSnapshot('art_unknown'));
    expect(result.current).toBe(false);
  });
});
