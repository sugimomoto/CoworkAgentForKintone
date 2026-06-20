// 通知先 Webhook のドメインロジック (フレームワーク非依存, #13)
//
// Agent ごとに1本だけ紐づく Slack / Teams の Incoming Webhook を扱う。
//   - 型: WebhookConfig / WebhookPlatform / DetectResult
//   - detectPlatform(url): URL のホストだけで Slack / Teams を自動判定
//   - PLATFORM_META: バッジ表示用メタ (ラベル・色)
//   - maskedSecret(): 保存後の伏字文字列
//
// 判定ホストは Worker 側 [packages/kintone-mcp/src/notify/detectPlatform.ts] と一致させること
// (UI が「対応」と言ったものは Worker も送信できる必要がある)。Teams は旧 O365 コネクタに加え
// Workflows (logic.azure.com) も受け付ける。

export type WebhookPlatform = 'slack' | 'teams' | 'discord';

/** Agent に保存される通知設定。生 URL は保存後クライアントに返さない (伏字運用)。 */
export interface WebhookConfig {
  platform: WebhookPlatform;
  /** 新規登録 / 上書き時のみ URL を載せる。既存表示時は url を省略。 */
  url?: string;
}

export type DetectKind = 'empty' | 'slack' | 'teams' | 'discord' | 'unsupported' | 'malformed';

export interface DetectResult {
  kind: DetectKind;
  host?: string;
}

/**
 * URL のホストでプラットフォームを判定する。ユーザーに種別を選ばせない。
 *   hooks.slack.com                                  → slack
 *   outlook.office.com / *.webhook.office.com 系      → teams (旧 Incoming Webhook)
 *   *.logic.azure.com                                → teams (Workflows)
 *   それ以外                                          → unsupported
 * スキーム無し入力 ("hooks.slack.com/...") は https を補って判定する。
 */
export function detectPlatform(raw: string | null | undefined): DetectResult {
  const v = (raw ?? '').trim();
  if (!v) return { kind: 'empty' };

  let host = '';
  try {
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    host = new URL(withScheme).host.toLowerCase();
  } catch {
    return { kind: 'malformed' };
  }
  if (!host) return { kind: 'malformed' };

  if (host === 'hooks.slack.com') return { kind: 'slack', host };
  if (
    host === 'outlook.office.com' ||
    host.endsWith('.webhook.office.com') ||
    host.endsWith('.webhook.office365.com') ||
    host.endsWith('.logic.azure.com')
  ) {
    return { kind: 'teams', host };
  }
  if (
    host === 'discord.com' ||
    host === 'discordapp.com' ||
    host.endsWith('.discord.com') ||
    host.endsWith('.discordapp.com')
  ) {
    return { kind: 'discord', host };
  }
  return { kind: 'unsupported', host };
}

export const isSupportedPlatform = (k: DetectKind): k is WebhookPlatform =>
  k === 'slack' || k === 'teams' || k === 'discord';

/** バッジ表示用メタ。Slack=緑系 / Teams=紫系 / Discord=ブルランプル (モデルバッジと同トーンの小 pill)。 */
export const PLATFORM_META: Record<
  WebhookPlatform,
  { label: string; color: string; soft: string }
> = {
  slack: { label: 'Slack', color: '#15803d', soft: 'rgba(21,128,61,0.10)' },
  teams: { label: 'Teams', color: '#7c3aed', soft: 'rgba(124,58,237,0.10)' },
  discord: { label: 'Discord', color: '#5865f2', soft: 'rgba(88,101,242,0.12)' },
};

/** 保存後の伏字 (パスワード入力と同じ扱い／生 URL は二度と表示しない)。 */
export const maskedSecret = (len = 14): string => '●'.repeat(len);
