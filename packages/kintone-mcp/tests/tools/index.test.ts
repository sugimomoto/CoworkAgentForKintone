import { describe, expect, it } from 'vitest';

import { tools } from '../../src/tools';

describe('tools 集約', () => {
  it('4 種のツールが含まれる', () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'kintone-get-apps',
        'kintone-get-app',
        'kintone-get-form-fields',
        'kintone-get-records',
      ]),
    );
    expect(names).toHaveLength(4);
  });

  it('全ツールが name / config / callback を持つ', () => {
    for (const t of tools) {
      expect(typeof t.name).toBe('string');
      expect(t.name.startsWith('kintone-')).toBe(true);
      expect(typeof t.config.title).toBe('string');
      expect(typeof t.config.description).toBe('string');
      expect(t.config.inputSchema).toBeDefined();
      expect(typeof t.callback).toBe('function');
    }
  });
});
