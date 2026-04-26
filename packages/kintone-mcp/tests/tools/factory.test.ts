import { describe, expect, it, vi } from 'vitest';

import type { KintoneCreds } from '../../src/kintone';
import { createTool, createToolCallback } from '../../src/tools/factory';

describe('createTool', () => {
  it('name / config / callback を保持した Tool オブジェクトを返す', () => {
    const callback = vi.fn();
    const tool = createTool(
      'kintone-test',
      {
        title: 'Test',
        description: 'desc',
        inputSchema: { app: { type: 'string' } as const },
        outputSchema: { ok: { type: 'boolean' } as const },
      },
      callback,
    );

    expect(tool.name).toBe('kintone-test');
    expect(tool.config.title).toBe('Test');
    expect(tool.config.description).toBe('desc');
    expect(tool.callback).toBe(callback);
  });
});

describe('createToolCallback', () => {
  it('options を bind した関数を返し、引数だけで呼出可能になる', async () => {
    const creds: KintoneCreds = { domain: 'x.cybozu.com', bearer: 'tok' };
    const inner = vi.fn(async (args: { app: string }) => ({
      structuredContent: { app: args.app },
      content: [{ type: 'text' as const, text: 'ok' }],
    }));

    const bound = createToolCallback(inner, { creds });
    const result = await bound({ app: '42' });

    expect(inner).toHaveBeenCalledWith({ app: '42' }, { creds });
    expect(result.content[0]?.text).toBe('ok');
  });
});
