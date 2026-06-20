// Cowork Agent for kintone — ユーザー Session の作成 / 一覧取得
//
// 設計変更 (20260425-session-redesign):
// - 起動時の "最新 Session を再利用" は廃止
// - 初送信時に新規作成 (`createUserSession`)
// - 履歴復元のための一覧取得 (`listUserSessions`)

import { METADATA_SOURCE } from '../constants';
import { createSession, filterByMetadata, listSessions } from '../managed-agents/resources';

import type { Session } from '../managed-agents/types';

export interface SessionContext {
  agentId: string;
  environmentId: string;
  kintoneDomain: string;
  kintoneUserCode: string;
  /** ユーザー Vault ID。指定された場合 vault_ids に含めて Session が作られる。 */
  vaultId?: string;
  /** 通知 Vault ID (#13)。Agent に Webhook が登録済なら vault_ids に追加する。 */
  notifyVaultId?: string;
  /**
   * 初回ユーザーメッセージ本文。指定されると履歴で識別しやすいよう、これを元に
   * Session タイトルを生成する (#52 プランA)。空 / 未指定なら従来の「新規会話 - 日時」。
   */
  firstMessage?: string;
}

export type ListUserSessionsContext = Pick<
  SessionContext,
  'agentId' | 'kintoneDomain' | 'kintoneUserCode'
>;

/** 初期 Session タイトル: "新規会話 - 2026-04-25 10:30" */
function makeInitialTitle(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `新規会話 - ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** タイトルの最大文字数 (超過分は … で省略)。履歴一覧でパッと識別できる長さ。 */
export const MAX_SESSION_TITLE_LEN = 30;

/**
 * 初回ユーザーメッセージから Session タイトルを生成する (#52 プランA)。
 * 改行・連続空白は 1 スペースに畳み、前後を trim、30 文字超は末尾 … で省略。
 * 空 (添付のみ等) のときは従来の「新規会話 - 日時」にフォールバックする。
 */
export function makeTitleFromMessage(text: string, now: Date = new Date()): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized === '') return makeInitialTitle(now);
  return normalized.length > MAX_SESSION_TITLE_LEN
    ? `${normalized.slice(0, MAX_SESSION_TITLE_LEN)}…`
    : normalized;
}

/** 新しい会話用の Session を作成する。常に新規作成、再利用はしない。 */
export async function createUserSession(ctx: SessionContext): Promise<Session> {
  const vaultIds = [ctx.vaultId, ctx.notifyVaultId].filter((v): v is string => Boolean(v));
  return await createSession({
    agent: ctx.agentId,
    environment_id: ctx.environmentId,
    ...(vaultIds.length > 0 ? { vault_ids: vaultIds } : {}),
    // 初回メッセージがあればそれを元にタイトル生成、無ければ「新規会話 - 日時」
    title: makeTitleFromMessage(ctx.firstMessage ?? ''),
    metadata: {
      source: METADATA_SOURCE,
      kintoneDomain: ctx.kintoneDomain,
      kintoneUserCode: ctx.kintoneUserCode,
      agentId: ctx.agentId,
    },
  });
}

/**
 * このユーザーが過去に作成した Session を新しい順で返す。
 * Managed Agents API は metadata を query で受け付けないため、agent_id でサーバ側絞り込み
 * したうえでクライアント側で metadata 突合 (source / kintoneDomain / kintoneUserCode)。
 */
export async function listUserSessions(ctx: ListUserSessionsContext): Promise<Session[]> {
  const list = await listSessions({
    agent_id: ctx.agentId,
    order: 'desc',
    limit: 100,
  });
  return filterByMetadata(list.data, {
    source: METADATA_SOURCE,
    kintoneDomain: ctx.kintoneDomain,
    kintoneUserCode: ctx.kintoneUserCode,
  });
}
