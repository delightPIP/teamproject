// 넣기 전 사전 검사 (SPEC 1-1 드롭존 경고·안내, 3-2, POLICY 2-6·3-1·3-3).
// 순수 함수만 둔다: 드롭존(렌더러)과 main 양쪽에서 쓰고 node --test로 검사한다.
import { formatErrorMessage, type ErrorCode } from "@spacelog/shared/errors";
import type { CreateStarsResponse, Star } from "@spacelog/shared/types";

export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const LOW_DISK_BYTES = 1024 * 1024 * 1024;
export const TEXT_FILE_THRESHOLD = 100_000; // 넘으면 .txt 파일로 저장 (SPEC 3-2)
export const MEMO_MAX = 140;

export interface DroppedEntry {
  name: string;
  size: number;
  isDirectory: boolean;
}

export type Rejected = CreateStarsResponse["rejected"][number];

function reject(name: string | null, code: Rejected["code"]): Rejected {
  return { name, code, message: formatErrorMessage(code) };
}

/**
 * 폴더·200MB 초과는 그 항목만, 그 밖의 파일은 들어온 순서로 20개까지 받고 21번째부터 거부한다.
 * 받은 항목의 원래 순서(index)를 돌려준다.
 */
export function precheckFiles(entries: DroppedEntry[]): { accepted: number[]; rejected: Rejected[] } {
  const accepted: number[] = [];
  const rejected: Rejected[] = [];
  entries.forEach((e, i) => {
    if (e.isDirectory) return rejected.push(reject(e.name, "FOLDER_NOT_ALLOWED"));
    if (e.size > MAX_FILE_BYTES) return rejected.push(reject(e.name, "FILE_TOO_LARGE"));
    if (accepted.length >= MAX_FILES) return rejected.push(reject(e.name, "TOO_MANY_FILES"));
    accepted.push(i);
  });
  return { accepted, rejected };
}

export type TextPayload =
  | { kind: "link"; url: string }
  | { kind: "text"; text: string }
  | { kind: "longText"; text: string } // 100,000자 초과 → .txt 파일로
  | { kind: "empty" };

/** 드롭·붙여넣기·단축키로 받은 글자를 종류별로 나눈다 (SPEC 3-2 종류 판별) */
export function classifyText(uriList: string | null | undefined, text: string | null | undefined): TextPayload {
  const uri = (uriList ?? "").split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
  if (uri && /^https?:\/\//i.test(uri)) return { kind: "link", url: uri };
  const body = text ?? "";
  const trimmed = body.trim();
  if (!trimmed) return { kind: "empty" };
  // http(s)로 시작하는 URL "한 줄"만 링크다. 공백·줄바꿈이 섞이면 텍스트
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { kind: "link", url: trimmed };
  if (body.length > TEXT_FILE_THRESHOLD) return { kind: "longText", text: body };
  return { kind: "text", text: body };
}

export function isLowDisk(freeBytes: number | null): boolean {
  return freeBytes !== null && freeBytes < LOW_DISK_BYTES;
}

/** 서버 응답 + 사전 검사 결과를 화면 문구 목록으로 */
export function rejectionLines(res: Pick<CreateStarsResponse, "duplicates" | "rejected">): string[] {
  return [
    ...res.duplicates.map((d) => `${d.name ?? "이 기록"}: ${formatErrorMessage("DUPLICATE", { planet: d.planetName })}`),
    ...res.rejected.map((r) => (r.name ? `${r.name}: ${r.message}` : r.message)),
  ];
}

/** 확인 카드 제목 (SPEC 1-1: 파일 이름 / 링크 도메인 / 텍스트 앞 30자). 웹 starTitle과 같은 규칙 */
export function starTitle(star: Pick<Star, "kind" | "linkTitle" | "linkDomain" | "originalName" | "textBody" | "url">): string {
  if (star.kind === "link") return star.linkTitle || star.linkDomain || domainOf(star.url) || "이름 없는 기록";
  if (star.kind === "text") {
    const body = star.textBody?.trim().replace(/\s+/g, " ") ?? "";
    return body ? (body.length > 30 ? `${body.slice(0, 30)}…` : body) : "이름 없는 기록";
  }
  return star.originalName || "이름 없는 기록";
}

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** 메모는 한 줄, 140자 (SPEC 1-1) */
export function cleanMemo(memo: string): string {
  return memo.replace(/[\r\n]+/g, " ").slice(0, MEMO_MAX);
}

export function errorText(code: ErrorCode | "UNKNOWN" | "SERVER_DOWN", vars?: Record<string, string>): string {
  if (code === "UNKNOWN") return "저장하지 못했어요. 잠시 뒤 다시 넣어 주세요";
  if (code === "SERVER_DOWN") return "로컬 서버가 꺼져 있어요. 트레이 메뉴를 확인해 주세요";
  return formatErrorMessage(code, vars);
}
