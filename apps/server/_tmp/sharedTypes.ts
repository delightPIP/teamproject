// 임시 타입 (개발 A 전용). SPEC 2장을 그대로 옮겼다.
// #1(packages/shared/types.ts)이 머지되면 이 파일을 지우고 import 경로만 바꾼다.

export type StarKind = "image" | "file" | "link" | "text";

export interface Star {
  id: string;
  kind: StarKind;
  planetId: string;
  createdAtUtc: string;
  tzOffsetMin: number;
  updatedAtUtc: string;
  storagePath: string | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  url: string | null;
  linkTitle: string | null;
  linkDomain: string | null;
  textBody: string | null;
  thumbnailPath: string | null;
  thumbnailStatus: "pending" | "ready" | "fallback";
  linkFetchStatus: "none" | "pending" | "done" | "failed";
  memo: string | null;
  originalMissing?: boolean;
  localDate?: string;
}

export interface Planet {
  id: string;
  name: string;
  system: "uncategorized" | null;
  defaultFor: StarKind | "other" | null;
  colorToken: string;
  createdAtUtc: string;
}

export interface Period {
  preset: "today" | "week" | "custom";
  from: string; // 현지 날짜 "YYYY-MM-DD"
  to: string;
}

export type CargoItem =
  | { type: "star"; starId: string }
  | { type: "planet"; planetId: string; period: Period }
  | { type: "universe"; period: Period };

export type ExportFormat = "claude" | "mcp";
