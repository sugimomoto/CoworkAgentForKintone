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
 * options を bind して args だけで呼出可能なコールバックを返す。
 * MCP server の registerTool に渡す形式。
 */
export function createToolCallback<TArgs = Record<string, unknown>>(
  callback: ToolCallback<TArgs>,
  options: ToolCallbackOptions,
): (args: TArgs) => Promise<CallToolResult> {
  return (args) => callback(args, options);
}
