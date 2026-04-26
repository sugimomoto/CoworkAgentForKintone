// 全 Tool の集約。MCP server (M8) はここから読み込む。

import { getApp } from './get-app';
import { getApps } from './get-apps';
import { getFormFields } from './get-form-fields';
import { getRecords } from './get-records';

import type { Tool } from './types/tool';

export { createTool, createToolCallback } from './factory';
export type { Tool, CallToolResult, ToolCallback, ToolCallbackOptions, ToolConfig } from './types/tool';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: Array<Tool<any>> = [getApps, getApp, getFormFields, getRecords];
