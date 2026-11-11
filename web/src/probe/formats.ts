// 내보내기 형식 목록. MCP 리소스는 축소 순서 1번이라 플래그로 숨길 수 있다 (PRD 3장, 이슈 #8).
import type { ExportFormat } from "@spacelog/shared/types";

export interface FormatOption {
  value: ExportFormat;
  label: string;
  hint: string;
}

const ALL_FORMATS: readonly FormatOption[] = [
  { value: "claude", label: "Claude 프롬프트", hint: "정리된 텍스트" },
  { value: "mcp", label: "MCP 리소스", hint: "JSON" },
];

export const DEFAULT_FORMAT: ExportFormat = "claude";

export function availableFormats(hideMcp: boolean): readonly FormatOption[] {
  return hideMcp ? ALL_FORMATS.filter((f) => f.value !== "mcp") : ALL_FORMATS;
}

/** 고른 형식이 숨겨졌으면 기본 형식으로 돌린다 */
export function effectiveFormat(format: ExportFormat, hideMcp: boolean): ExportFormat {
  return availableFormats(hideMcp).some((f) => f.value === format) ? format : DEFAULT_FORMAT;
}

/** 빌드 플래그 `VITE_HIDE_MCP=1` 이면 MCP 리소스를 숨긴다 */
export function isMcpHidden(env: Record<string, unknown> | undefined): boolean {
  return env?.VITE_HIDE_MCP === "1";
}
