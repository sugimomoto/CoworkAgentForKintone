import { describe, expect, it } from 'vitest';

import { buildDiscordPayload, buildSlackPayload, buildTeamsPayload } from '../../src/notify/format';

const MSG = {
  title: '顧客別売上集計 完了',
  text: '3 社・合計 120 万円',
  fields: [{ label: '件数', value: '12' }],
  link: { label: 'レコードを開く', url: 'https://t.cybozu.com/k/5/show#record=1' },
};

describe('buildSlackPayload', () => {
  it('header / section / fields / actions を含む blocks', () => {
    const p = buildSlackPayload(MSG) as { text: string; blocks: Array<{ type: string }> };
    expect(p.text).toBe(MSG.title);
    const types = p.blocks.map((b) => b.type);
    expect(types).toContain('header');
    expect(types).toContain('section');
    expect(types).toContain('actions');
  });
  it('fields/link 無しでも header+section', () => {
    const p = buildSlackPayload({ title: 't', text: 'x' }) as { blocks: unknown[] };
    expect(p.blocks).toHaveLength(2);
  });
});

describe('buildDiscordPayload', () => {
  it('embeds に title/description/fields をまとめ、link は description 末尾に添える', () => {
    const p = buildDiscordPayload(MSG) as {
      embeds: Array<{ title: string; description: string; fields?: Array<{ name: string }> }>;
    };
    expect(p.embeds).toHaveLength(1);
    expect(p.embeds[0]!.title).toBe(MSG.title);
    expect(p.embeds[0]!.fields).toHaveLength(1);
    expect(p.embeds[0]!.description).toContain(MSG.link.label);
    expect(p.embeds[0]!.description).toContain(MSG.link.url);
  });
  it('fields/link 無しでも embed 1 つ', () => {
    const p = buildDiscordPayload({ title: 't', text: 'x' }) as { embeds: unknown[] };
    expect(p.embeds).toHaveLength(1);
  });
});

describe('buildTeamsPayload', () => {
  it('Adaptive Card を attachments で包む', () => {
    const p = buildTeamsPayload(MSG) as {
      type: string;
      attachments: Array<{ contentType: string; content: { type: string; body: unknown[]; actions?: unknown[] } }>;
    };
    expect(p.type).toBe('message');
    expect(p.attachments[0]!.contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(p.attachments[0]!.content.type).toBe('AdaptiveCard');
    expect(p.attachments[0]!.content.actions).toBeDefined(); // link → Action.OpenUrl
  });
});
