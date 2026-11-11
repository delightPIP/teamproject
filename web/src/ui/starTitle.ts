import type { Star } from "@spacelog/shared/types";

/** 별의 화면 제목. 비어 있으면 POLICY 2-7 대체 표기: 링크는 도메인, 파일은 "이름 없는 기록" */
export function starTitle(star: Pick<Star, "kind" | "linkTitle" | "linkDomain" | "originalName" | "textBody">): string {
  if (star.kind === "link") return star.linkTitle || star.linkDomain || "이름 없는 기록";
  if (star.kind === "text") {
    const body = star.textBody?.trim().replace(/\s+/g, " ") ?? "";
    return body ? (body.length > 30 ? `${body.slice(0, 30)}…` : body) : "이름 없는 기록";
  }
  return star.originalName || "이름 없는 기록";
}
