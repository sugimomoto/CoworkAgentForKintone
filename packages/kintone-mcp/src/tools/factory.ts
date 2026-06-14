// Tool 定義の統一ファクトリ。kintone 公式 MCP の factory.ts と同じパターン。

import type { CallToolResult, Tool, ToolCallback, ToolCallbackOptions, ToolConfig } from './types/tool';

export function createTool<TArgs = Record<string, unknown>>(
  name: string,
  config: ToolConfig,
  callback: ToolCallback<TArgs>,
): Tool<TArgs> {
  return { name, config, callback };
}

/**
 * Tool の成功結果を統一形式 (structuredContent + JSON テキスト) に整形する。
 * 全ツール共通のボイラープレートを 1 箇所に集約する。
 */
export function toolResult(data: unknown): CallToolResult {
  return {
    structuredContent: data,
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * options を bind して args だけで呼出可能なコールバックを返す。
 * MCP server の registerTool に渡す形式。
 */
export function createToolCallback<TArgs = Record<string, unknown>>(
  callback: ToolCallback<TArgs>,
  options: ToolCallbackOptions,
): (args: TArgs) => Promise<CallToolResult> {
  return (args) => callback(args, options);
}
