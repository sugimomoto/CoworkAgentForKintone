// send_notification ツールの実体。注入された Webhook URL (Bearer) と引数から
// Slack / Teams / Discord に POST する。#13。
//
// セキュリティ: Webhook URL は秘匿。toolResult・ログに **URL を一切含めない**。

import { sanitizeError } from '../_http';

import { detectPlatform, type NotifyPlatform } from './detectPlatform';
import {
  buildDiscordPayload,
  buildSlackPayload,
  buildTeamsPayload,
  type NotifyMessage,
} from './format';

import type { CallToolResult } from '../tools/types/tool';

/** platform ごとの表示名と payload ビルダ。対応追加はここに 1 行足すだけ。 */
const PLATFORMS: Record<NotifyPlatform, { label: string; build: (m: NotifyMessage) => unknown }> = {
  slack: { label: 'Slack', build: buildSlackPayload },
  teams: { label: 'Teams', build: buildTeamsPayload },
  discord: { label: 'Discord', build: buildDiscordPayload },
};

function ok(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], structuredContent: { ok: true } };
}
function fail(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }], structuredContent: { ok: false } };
}

/** webhookUrl は static_bearer で注入された値。未設定 Agent では null。 */
export async function runSendNotification(
  args: NotifyMessage,
  webhookUrl: string | null,
): Promise<CallToolResult> {
  if (!webhookUrl) {
    return fail(
      '通知先が未設定です。管理者がこのエージェントに Slack / Teams / Discord の Webhook を登録すると通知できます。',
    );
  }
  const platform = detectPlatform(webhookUrl);
  if (!platform) {
    // URL 自体はメッセージに出さない
    return fail('登録された Webhook が Slack / Teams / Discord として認識できませんでした。');
  }
  if (!args || typeof args.title !== 'string' || typeof args.text !== 'string') {
    return fail('title と text は必須です。');
  }
  const { label, build } = PLATFORMS[platform];
  const payload = build(args);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return ok(`${label} に通知を送信しました。`);
    // body は読まない (機密混入回避)。status のみ。
    return fail(`${label} への通知送信に失敗しました (HTTP ${res.status})。Webhook の登録を確認してください。`);
  } catch (err) {
    // err は URL を含みうるため、サニタイズしたうえで汎用メッセージに留める
    console.log('[/notify] send error:', sanitizeError(err).slice(0, 120));
    return fail(`${label} への通知送信に失敗しました (ネットワークエラー)。`);
  }
}
