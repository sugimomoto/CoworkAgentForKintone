import { describe, expect, it } from 'vitest';

import { shouldEnableTool } from '../../src/server/tool-filters';

describe('shouldEnableTool', () => {
  it('Basic 認証時は全ツール有効', () => {
    const cond = { isApiTokenAuth: false };
    expect(shouldEnableTool('kintone-get-apps', cond)).toBe(true);
    expect(shouldEnableTool('kintone-get-app', cond)).toBe(true);
    expect(shouldEnableTool('kintone-get-form-fields', cond)).toBe(true);
    expect(shouldEnableTool('kintone-get-records', cond)).toBe(true);
  });

  it('API トークン認証時は kintone-get-apps が除外される', () => {
    const cond = { isApiTokenAuth: true };
    expect(shouldEnableTool('kintone-get-apps', cond)).toBe(false);
    expect(shouldEnableTool('kintone-get-app', cond)).toBe(true);
    expect(shouldEnableTool('kintone-get-form-fields', cond)).toBe(true);
    expect(shouldEnableTool('kintone-get-records', cond)).toBe(true);
  });
});
