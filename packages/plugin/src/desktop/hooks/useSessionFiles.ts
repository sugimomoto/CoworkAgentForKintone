// Cowork Agent for kintone — Anthropic Files API 経由で session スコープのファイルを
// 検出して binary artifact に変換するフック。
//
// Agent が `/workspace/` 等に書き出したファイルは Anthropic 側が自動的に session に
// 紐づけて file_id を払い出す。ターン終了 (isAgentRunning: true → false) のたびに
// listSessionFiles を呼び、未登録の file_id を artifact map に追加する。
//
// base64 を SSE に流すアプローチ (#29 初期実装) より:
// - SSE 帯域 / トークン消費を圧迫しない
// - 5MB 制限を作らずに済む (Anthropic Files API のサイズ制限のみ)
// - file_id ベースなのでセッション中いつでも DL し直せる

import { useEffect, useRef } from 'react';

import { binaryArtifactIdFromFileId } from '../../core/artifacts/types';
import { debug, warn } from '../../core/debug';
import { listSessionFiles } from '../../core/managed-agents/files';
import { useChatStore } from '../../store/chatStore';

export interface UseSessionFilesProps {
  sessionId: string | null;
  enabled: boolean;
}

/**
 * Anthropic Files API の auto-collection は idle 直後にタイムラグがあるため
 * 0 件で返ってきたら段階的に再試行する (ms 単位)。
 */
const TURN_END_RETRY_DELAYS_MS = [0, 2_000, 4_000, 8_000];

/**
 * セッションスコープのファイルを定期同期する。
 * - sessionId が変わったら再 sync
 * - isAgentRunning が true → false に遷移したタイミングで sync (ターン終了直後)
 *   かつ Anthropic 側の登録遅延を見越して数回 retry
 */
export function useSessionFiles({ sessionId, enabled }: UseSessionFilesProps): void {
  const isAgentRunning = useChatStore((s) => s.isAgentRunning);
  const upsertBinaryArtifact = useChatStore((s) => s.upsertBinaryArtifact);
  const prevRunningRef = useRef<boolean>(false);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancelPendingRetries = (): void => {
    for (const t of retryTimersRef.current) clearTimeout(t);
    retryTimersRef.current = [];
  };

  // 1. sessionId 変化時 (初期マウント / 切替) に 1 回 sync
  useEffect(() => {
    if (!enabled || !sessionId) return;
    void syncSessionFiles(sessionId, upsertBinaryArtifact);
  }, [enabled, sessionId, upsertBinaryArtifact]);

  // 2. isAgentRunning: true → false 遷移時に retry 付きで sync
  useEffect(() => {
    if (!enabled || !sessionId) {
      prevRunningRef.current = isAgentRunning;
      return;
    }
    if (prevRunningRef.current && !isAgentRunning) {
      cancelPendingRetries();
      // 段階的に複数回 list を試みる。新規ファイルが見つかった時点で残りの retry は無効化されない
      // (重複 upsert にはならず、id ベースの no-op になる)。
      for (const delay of TURN_END_RETRY_DELAYS_MS) {
        const t = setTimeout(() => {
          void syncSessionFiles(sessionId, upsertBinaryArtifact);
        }, delay);
        retryTimersRef.current.push(t);
      }
    }
    prevRunningRef.current = isAgentRunning;
  }, [enabled, sessionId, isAgentRunning, upsertBinaryArtifact]);

  // unmount で残 timer を片付け
  useEffect(() => () => cancelPendingRetries(), []);
}

async function syncSessionFiles(
  sessionId: string,
  upsertBinaryArtifact: ReturnType<typeof useChatStore.getState>['upsertBinaryArtifact'],
): Promise<void> {
  try {
    const files = await listSessionFiles(sessionId);
    debug('SessionFiles', `list returned ${files.length} files for ${sessionId}`, files);
    const state = useChatStore.getState();
    const known = state.artifacts;
    for (const f of files) {
      const id = binaryArtifactIdFromFileId(f.id);
      if (known.has(id)) continue; // 既に出している file は何もしない
      const input: Parameters<typeof upsertBinaryArtifact>[0] = {
        fileId: f.id,
        filename: f.filename,
      };
      if (f.mime_type) input.mime = f.mime_type;
      if (typeof f.size_bytes === 'number') input.sizeBytes = f.size_bytes;
      upsertBinaryArtifact(input);
      // 新規 file はチャット末尾に artifact-ref カードを出して
      // 「右ペインから DL できます」をユーザーに伝える
      state.addMessage({
        id: `bin-${f.id}`,
        kind: 'artifact-ref',
        artifactId: id,
        title: f.filename,
        artifactKind: 'binary',
      });
    }
  } catch (err) {
    warn('SessionFiles', 'list failed', err);
  }
}
