// 全 Tool の集約。MCP server はここから読み込む。

import { addRecord } from './add-record';
import { addRecordComment } from './add-record-comment';
import { addRecords } from './add-records';
import { deleteRecords } from './delete-records';
import { getApp } from './get-app';
import { getApps } from './get-apps';
import { getFormFields } from './get-form-fields';
import { getRecords } from './get-records';
import { updateRecord } from './update-record';
import { updateRecords } from './update-records';

import type { Tool } from './types/tool';

export { createTool, createToolCallback } from './factory';
export type { Tool, CallToolResult, ToolCallback, ToolCallbackOptions, ToolConfig } from './types/tool';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: Array<Tool<any>> = [
  // Read
  getApps,
  getApp,
  getFormFields,
  getRecords,
  // Write
  addRecord,
  addRecords,
  updateRecord,
  updateRecords,
  deleteRecords,
  addRecordComment,
];
