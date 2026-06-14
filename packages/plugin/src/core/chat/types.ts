// Cowork Agent for kintone — チャットメッセージのデータ型
//
// 会話ストリームの 1 件を表す純粋なデータ型。UI (desktop) に依存しないため core に置く。
// イベント解釈 (eventInterpreter) や store がこれを生成し、MessageList が描画する。

import type { ArtifactKind } from '../artifacts/types';
import type { AttachmentKind } from '../files/types';

export type ToolStatus = 'running' | 'success' | 'error' | 'pending-confirmation' | 'rejected';

export interface ToolMessage {
  /** tool_use_id をそのまま使う (後続 tool_result の突合キー) */
  id: string;
  kind: 'tool';
  /** ツール名 (例: 'kintone-update-record') */
  name: string;
  /** tool_use.input */
  input: unknown;
  status: ToolStatus;
  /** tool_result.content (success / error 時) */
  result?: unknown;
  /** is_error=true の content から抽出したテキスト (リセット用に明示 undefined を許容) */
  errorText?: string | undefined;
}

/**
 * 会話ストリームに残す Artifact 参照タイル。本文は chatStore.artifacts から取得する。
 * クリックで ArtifactPane を開く (setActiveArtifact 経由)。
 */
export interface ArtifactRefChatMessage {
  id: string;
  kind: 'artifact-ref';
  artifactId: string;
  /** 表示用 (artifact 削除時のフォールバック) */
  title: string;
  artifactKind: ArtifactKind;
}

export type ChatMessage =
  | {
      id: string;
      kind: 'user';
      text: string;
      /** 送信時に添付したファイル一覧 (バブル上部にラベル表示用) */
      attachments?: Array<{ filename: string; kind: AttachmentKind }>;
    }
  | { id: string; kind: 'agent'; text: string }
  | { id: string; kind: 'thinking' }
  | ToolMessage
  | ArtifactRefChatMessage;
