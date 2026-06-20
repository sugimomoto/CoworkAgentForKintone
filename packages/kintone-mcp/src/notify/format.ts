// 通知ペイロード整形 (純関数)。Slack blocks / Teams Adaptive Card。
// #13: send_notification の引数を各プラットフォーム形式に変換する。

export interface NotifyMessage {
  title: string;
  text: string;
  fields?: Array<{ label: string; value: string }>;
  link?: { label: string; url: string };
}

/** Slack Incoming Webhook (blocks)。`text` は通知本文のフォールバック。 */
export function buildSlackPayload(m: NotifyMessage): unknown {
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: m.title, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: m.text } },
  ];
  if (m.fields && m.fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: m.fields.map((f) => ({ type: 'mrkdwn', text: `*${f.label}*\n${f.value}` })),
    });
  }
  if (m.link) {
    blocks.push({
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: m.link.label }, url: m.link.url },
      ],
    });
  }
  return { text: m.title, blocks };
}

/** Discord Incoming Webhook (embeds)。1 つの embed に title/description/fields/url をまとめる。 */
export function buildDiscordPayload(m: NotifyMessage): unknown {
  const embed: Record<string, unknown> = {
    title: m.title,
    description: m.text,
  };
  if (m.fields && m.fields.length > 0) {
    embed.fields = m.fields.map((f) => ({ name: f.label, value: f.value, inline: true }));
  }
  // Discord embed は link ボタンを持てないため、リンクは description 末尾に Markdown で添える。
  if (m.link) {
    embed.description = `${m.text}\n\n[${m.link.label}](${m.link.url})`;
  }
  return { embeds: [embed] };
}

/** Teams Incoming Webhook (Adaptive Card)。現行の Workflows / Incoming Webhook 互換。 */
export function buildTeamsPayload(m: NotifyMessage): unknown {
  const body: unknown[] = [
    { type: 'TextBlock', text: m.title, weight: 'Bolder', size: 'Medium', wrap: true },
    { type: 'TextBlock', text: m.text, wrap: true },
  ];
  if (m.fields && m.fields.length > 0) {
    body.push({ type: 'FactSet', facts: m.fields.map((f) => ({ title: f.label, value: f.value })) });
  }
  const card: Record<string, unknown> = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body,
  };
  if (m.link) {
    card.actions = [{ type: 'Action.OpenUrl', title: m.link.label, url: m.link.url }];
  }
  return {
    type: 'message',
    attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }],
  };
}
