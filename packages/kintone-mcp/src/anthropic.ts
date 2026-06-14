// Anthropic API リクエストの共有ヘルパー。
// 各ハンドラ (skills-sync / files-download / credentials-upsert) で手書きしていた
// X-Api-Key + anthropic-version + anthropic-beta のヘッダ構築を 1 箇所に集約する。

export const ANTHROPIC_VERSION = '2023-06-01';

/** Anthropic API 共通ヘッダ。beta が指定されたら anthropic-beta を付与する。 */
export function anthropicHeaders(apiKey: string, beta?: string): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    ...(beta ? { 'anthropic-beta': beta } : {}),
  };
}
