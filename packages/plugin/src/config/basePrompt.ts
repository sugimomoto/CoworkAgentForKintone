// basePrompt.ts — 共通 base システムプロンプト編集 UI の型 + 派生ヘルパー (#141)
//
// base は Plugin Config で override (未設定なら code の DEFAULT_BASE_SYSTEM_PROMPT)。
// value(override) の空判定だけで「既定を使用中 / カスタム」を決める。
// 出所: docs/design-handoff/base-prompt-config/basePrompt.ts。

/** 文字数上限の目安 (超過は警告 + 保存不可)。 */
export const DEFAULT_MAX_LENGTH = 20000;

export type BasePromptStatus = 'default' | 'custom';

/** override が空 (空白のみ含む) なら既定使用中。 */
export function isUsingDefault(value: string): boolean {
  return value.trim().length === 0;
}

export function statusOf(value: string): BasePromptStatus {
  return isUsingDefault(value) ? 'default' : 'custom';
}

/** コードポイント基準の文字数。 */
export function charCount(value: string): number {
  return Array.from(value).length;
}

export function isOverLimit(value: string, max: number = DEFAULT_MAX_LENGTH): boolean {
  return charCount(value) > max;
}

/** 保存可否 (上限超過のみ不可。空保存 = 既定に戻す と同義で可)。 */
export function canSave(draft: string, max: number = DEFAULT_MAX_LENGTH): boolean {
  return !isOverLimit(draft, max);
}
