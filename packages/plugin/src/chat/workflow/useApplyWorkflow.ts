// Cowork Agent for kintone — Customizer wedge ロールバック対応 state machine (P4.1)
//
// Customizer Agent が生成した JS artifact について、以下の 5 状態を持つ:
//
//   ready       — 生成直後。プレビュー可
//   previewed   — プレビュー済。適用 OK
//   applying    — 適用中 (preview→deploy 進行)
//   applied     — 本番反映済。ロールバック可
//   rolled-back — ロールバック完了
//
// 各遷移の I/O 実装は本 hook には含めない。`preview / apply / rollback` の
// callback として呼出側 (kintoneCustomizeApi.ts、P4.4 で実装) から注入する。
// 本 hook は **遷移ロジック + エラーパスの状態保持** だけを責任とする。
//
// 詳細仕様: requirements.md §15.5 / design.md §6.2

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useChatStore } from '../../store/chatStore';

export type WorkflowState =
  | 'ready'
  | 'previewed'
  | 'applying'
  | 'applied'
  | 'rolled-back';

/** 状態遷移が許される組み合わせ表 (state machine の transition function) */
const ALLOWED_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  ready: ['previewed'],
  previewed: ['previewed', 'applying', 'ready'], // 再プレビュー / 適用 / キャンセル (= ready)
  applying: ['applied', 'previewed'], // 適用成功 or 失敗で previewed に戻る
  applied: ['rolled-back', 'applying'], // ロールバック or 同じ artifact をもう一度適用
  'rolled-back': ['applying'], // もう一度適用
};

/**
 * useApplyWorkflow の I/O コールバック。
 * 呼出側 (CustomizerArtifactCard) で kintone REST API 呼出を実装する。
 *
 * - preview: `PUT /k/v1/preview/app/customize.json` で動作テスト環境に反映 (live は無傷)。
 *            admin は別タブで `/k/admin/preview/<appId>/` から実機確認する
 * - apply: 旧 customize.js を snapshot (chatStore.workflowHistory) → PUT customize.json
 *          → POST deploy.json で live に反映
 * - rollback: chatStore.workflowHistory から snapshot を取り出し PUT + deploy で復元
 *             (Phase 1 は in-memory のみ、Plugin リロードで失効、Phase 2 で git に永続化予定)
 * - cancel: `POST deploy.json {revert: true}` で preview を live と同期 (= 編集破棄)。
 *           previewed 状態のときだけ呼べる、ready 状態に戻る
 *
 * いずれも reject すると state は遷移前に戻り、エラーは `errorMessage` に保持される。
 */
export interface WorkflowCallbacks {
  /** プレビュー実行 (preview customize.json PUT)。成功時 resolve、失敗時 reject */
  preview: () => Promise<void>;
  /** 本番適用 (snapshot 保存 + deploy)。成功時 resolve、失敗時 reject */
  apply: () => Promise<void>;
  /** ロールバック実行 (snapshot から復元)。成功時 resolve、失敗時 reject */
  rollback: () => Promise<void>;
  /** キャンセル (deploy 前の preview を破棄、revert: true で live と同期)。成功時 resolve、失敗時 reject */
  cancel: () => Promise<void>;
}

export interface UseApplyWorkflowOptions {
  /** Customizer Artifact の ID (workflowHistory のキーになる) */
  artifactId: string;
  /** 初期状態。default: 'ready' */
  initialState?: WorkflowState;
  /** I/O コールバック */
  callbacks: WorkflowCallbacks;
}

export interface ApplyWorkflowApi {
  /** 現在の状態 */
  state: WorkflowState;
  /** 進行中の操作 (preview / apply / rollback / cancel / null) — UI で spinner や disabled に使う */
  inFlight: 'preview' | 'apply' | 'rollback' | 'cancel' | null;
  /** 最新の操作で reject した時のエラーメッセージ (null = エラー無し) */
  errorMessage: string | null;
  /** プレビュー実行: 'ready' / 'previewed' でのみ呼べる */
  preview: () => Promise<void>;
  /** 本番適用: 'previewed' / 'rolled-back' でのみ呼べる */
  apply: () => Promise<void>;
  /** ロールバック: 'applied' でのみ呼べる */
  rollback: () => Promise<void>;
  /** キャンセル (preview を live と同期): 'previewed' でのみ呼べる */
  cancel: () => Promise<void>;
}

function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Customizer wedge の preview/apply/rollback 状態を管理する hook。
 *
 * - 状態遷移は ALLOWED_TRANSITIONS で制限される (不正な遷移は no-op)
 * - エラー時は state を遷移前に戻し errorMessage を保持
 * - apply 成功時に chatStore.saveWorkflowSnapshot は **呼ばない** (callbacks.apply の責務)
 *   ※ 旧 JS のスナップショット保存は callbacks.apply 内部で行う設計 (旧 JS を取得する
 *      タイミングがそこにしかないため)
 * - rolled-back 後に同 artifactId で再 apply すると workflowHistory は **古いまま** (V1 仕様)
 */
export function useApplyWorkflow({
  artifactId: _artifactId,
  initialState = 'ready',
  callbacks,
}: UseApplyWorkflowOptions): ApplyWorkflowApi {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [inFlight, setInFlight] = useState<'preview' | 'apply' | 'rollback' | 'cancel' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // artifactId が変わったら state をリセット (別 artifact 切替時の安全策)
  useEffect(() => {
    setState(initialState);
    setInFlight(null);
    setErrorMessage(null);
  }, [_artifactId, initialState]);

  const run = useCallback(
    async (
      operation: 'preview' | 'apply' | 'rollback' | 'cancel',
      nextState: WorkflowState,
      callback: () => Promise<void>,
    ): Promise<void> => {
      if (inFlight !== null) return; // 多重実行防止
      const previousState = state; // 失敗時の戻し先

      // apply は applying を経由してから applied へ
      if (operation === 'apply') {
        if (!canTransition(state, 'applying')) return;
        setState('applying');
      }
      setInFlight(operation);
      setErrorMessage(null);
      try {
        await callback();
        setState(nextState);
      } catch (e) {
        setState(previousState); // 失敗時は元の状態に戻す
        setErrorMessage(toErrorMessage(e));
      } finally {
        setInFlight(null);
      }
    },
    [state, inFlight],
  );

  const preview = useCallback(async () => {
    if (!canTransition(state, 'previewed')) return;
    await run('preview', 'previewed', callbacks.preview);
  }, [state, callbacks, run]);

  const apply = useCallback(async () => {
    if (!canTransition(state, 'applying')) return;
    await run('apply', 'applied', callbacks.apply);
  }, [state, callbacks, run]);

  const rollback = useCallback(async () => {
    if (!canTransition(state, 'rolled-back')) return;
    await run('rollback', 'rolled-back', callbacks.rollback);
  }, [state, callbacks, run]);

  const cancel = useCallback(async () => {
    // cancel は previewed → ready の遷移のみ許可
    if (state !== 'previewed') return;
    await run('cancel', 'ready', callbacks.cancel);
  }, [state, callbacks, run]);

  return useMemo(
    () => ({ state, inFlight, errorMessage, preview, apply, rollback, cancel }),
    [state, inFlight, errorMessage, preview, apply, rollback, cancel],
  );
}

/**
 * chatStore.workflowHistory から snapshot 有無を確認する hook (rollback ボタンの
 * 表示可否判定用)。本 hook は store を購読するだけで遷移は持たない。
 */
export function useHasWorkflowSnapshot(artifactId: string): boolean {
  return useChatStore((s) => s.workflowHistory.has(artifactId));
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'unknown error';
}
