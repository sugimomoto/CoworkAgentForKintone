import { describe, expect, it } from 'vitest';

import { detectPlatform } from '../../src/notify/detectPlatform';

describe('detectPlatform', () => {
  it('Slack', () => {
    expect(detectPlatform('https://hooks.slack.com/services/T0/B0/xxx')).toBe('slack');
  });
  it('Teams 旧 O365 コネクタ', () => {
    expect(detectPlatform('https://example.webhook.office.com/webhookb2/abc')).toBe('teams');
    expect(detectPlatform('https://outlook.office.com/webhook/abc')).toBe('teams');
  });
  it('Teams Workflows (logic.azure.com)', () => {
    expect(detectPlatform('https://prod-1.japaneast.logic.azure.com/workflows/xxx/triggers')).toBe(
      'teams',
    );
  });
  it('スキーム無しでも判定', () => {
    expect(detectPlatform('hooks.slack.com/services/x')).toBe('slack');
  });
  it('Discord', () => {
    expect(detectPlatform('https://discord.com/api/webhooks/1/abc')).toBe('discord');
    expect(detectPlatform('https://discordapp.com/api/webhooks/1/abc')).toBe('discord');
    expect(detectPlatform('https://ptb.discord.com/api/webhooks/1/abc')).toBe('discord');
  });
  it('対応外ホストは null', () => {
    expect(detectPlatform('https://example.com/webhook')).toBeNull();
    expect(detectPlatform('https://example.org/api/webhooks/x')).toBeNull();
  });
  it('空 / 不正は null', () => {
    expect(detectPlatform('')).toBeNull();
    expect(detectPlatform(null)).toBeNull();
    expect(detectPlatform('not a url at all')).toBeNull();
  });
});
