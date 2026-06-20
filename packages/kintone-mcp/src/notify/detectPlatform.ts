// Webhook URL のホストから通知プラットフォームを判定する (純関数)。
// クライアント (バッジ表示) と Worker (payload 整形) で同じ判定を使う。
// #13: ユーザーに種別を選ばせず、URL から自動判定する。

export type NotifyPlatform = 'slack' | 'teams' | 'discord';

/**
 * URL のホストで Slack / Teams / Discord を判定。判定不能なら null。
 *   hooks.slack.com                         → slack
 *   *.webhook.office.com / .office365.com    → teams (旧 O365 コネクタ)
 *   outlook.office.com                       → teams
 *   *.logic.azure.com                        → teams (現行 Teams Workflows Webhook)
 *   discord.com / discordapp.com / ptb.・canary. → discord
 * スキーム無し入力 ("hooks.slack.com/...") は https を補って判定する。
 */
export function detectPlatform(raw: string | null | undefined): NotifyPlatform | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  let host = '';
  try {
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    host = new URL(withScheme).host.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  if (host === 'hooks.slack.com') return 'slack';
  if (
    host === 'outlook.office.com' ||
    host.endsWith('.webhook.office.com') ||
    host.endsWith('.webhook.office365.com') ||
    host.endsWith('.logic.azure.com')
  ) {
    return 'teams';
  }
  if (
    host === 'discord.com' ||
    host === 'discordapp.com' ||
    host.endsWith('.discord.com') ||
    host.endsWith('.discordapp.com')
  ) {
    return 'discord';
  }
  return null;
}
