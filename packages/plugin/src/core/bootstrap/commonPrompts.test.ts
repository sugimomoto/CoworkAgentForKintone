import { describe, it, expect } from 'vitest';

import {
  COMMON_BEHAVIOR,
  COMMON_GUARDRAILS,
  DEFAULT_BASE_SYSTEM_PROMPT,
  KINTONE_TOOLS_PROMPT,
  composeSystemPrompt,
} from './commonPrompts';

describe('commonPrompts (#141)', () => {
  it('composeSystemPrompt は空行区切りで連結する', () => {
    expect(composeSystemPrompt('a', 'b', 'c')).toBe('a\n\nb\n\nc');
  });

  it('COMMON_BEHAVIOR は作法ブロック (基本姿勢/誠実さ/ツール/メモリ/メタ) を含む', () => {
    expect(COMMON_BEHAVIOR).toContain('【基本姿勢】');
    expect(COMMON_BEHAVIOR).toContain('【誠実さ】');
    expect(COMMON_BEHAVIOR).toContain('【ツールの使い方】');
    expect(COMMON_BEHAVIOR).toContain('【メモリ (/mnt/memory)');
    expect(COMMON_BEHAVIOR).toContain('【メタ】');
  });

  it('メモリブロックは COMMON_BEHAVIOR に集約され GUARDRAILS には無い (重複解消)', () => {
    expect(COMMON_GUARDRAILS).not.toContain('【メモリ (/mnt/memory)');
    // update_plan (計画) は具体ルールとして GUARDRAILS に残す
    expect(COMMON_GUARDRAILS).toContain('【計画 (update_plan)');
  });

  it('DEFAULT_BASE_SYSTEM_PROMPT = COMMON_BEHAVIOR + COMMON_GUARDRAILS', () => {
    expect(DEFAULT_BASE_SYSTEM_PROMPT).toBe(`${COMMON_BEHAVIOR}\n\n${COMMON_GUARDRAILS}`);
    expect(DEFAULT_BASE_SYSTEM_PROMPT).toContain('【基本姿勢】');
    expect(DEFAULT_BASE_SYSTEM_PROMPT).toContain('【成果物 (Artifact)');
  });

  it('KINTONE_TOOLS_PROMPT は kintone ツールカタログ', () => {
    expect(KINTONE_TOOLS_PROMPT).toContain('kintone-get-form-fields');
    expect(KINTONE_TOOLS_PROMPT).toContain('kintone-delete-records');
  });
});
