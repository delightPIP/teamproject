// POST /api/export 본체: {items, format} → {content, charCount, overLimit} (SPEC 2장 API 표)
import type { CargoItem, ExportFormat } from "../_tmp/sharedTypes.ts";
import { collect, type CollectContext } from "./collect.ts";
import { toClaudePrompt } from "./claudePrompt.ts";
import { toMcpResources } from "./mcpResource.ts";

/** 넘으면 "내용이 길어요" 경고. 복사는 막지 않는다 (POLICY 2-8). */
export const EXPORT_CHAR_LIMIT = 50_000;

export interface ExportResult {
  content: string;
  charCount: number;
  overLimit: boolean;
}

export function buildExport(items: readonly CargoItem[], format: ExportFormat, ctx: CollectContext): ExportResult {
  const records = collect(items, ctx);
  const content = format === "mcp" ? toMcpResources(records) : toClaudePrompt(records);
  const charCount = [...content].length;
  return { content, charCount, overLimit: charCount > EXPORT_CHAR_LIMIT };
}
