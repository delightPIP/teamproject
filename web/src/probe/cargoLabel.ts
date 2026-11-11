// 탐사선 실은 목록 표시용 계산 (W-04 ①). 화면과 분리해 테스트한다.
import type { CargoItem, Period, Planet, Star } from "@spacelog/shared/types";

export const UNNAMED_STAR = "이름 없는 기록";
const TITLE_MAX = 40;

/** 별 한 줄 제목: 링크 제목 → 도메인 → 파일 이름 → 본문 첫 줄 → 이름 없음 */
export function starTitle(star: Star | undefined): string {
  if (!star) return UNNAMED_STAR;
  const firstLine = star.textBody?.split("\n")[0]?.trim();
  const title = star.linkTitle ?? star.linkDomain ?? star.originalName ?? (firstLine || null);
  if (!title) return UNNAMED_STAR;
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX)}…` : title;
}

export function periodText(period: Period): string {
  const dot = (d: string) => d.replaceAll("-", ".");
  return period.from === period.to ? dot(period.from) : `${dot(period.from)} ~ ${dot(period.to)}`;
}

export interface CargoRow {
  key: string;
  kind: CargoItem["type"];
  title: string;
  detail: string;
}

export interface CargoLookup {
  stars: readonly Star[];
  planets: readonly Planet[];
}

/** 실은 항목 하나를 화면 한 줄로 바꾼다 */
export function cargoRow(item: CargoItem, index: number, lookup: CargoLookup): CargoRow {
  const key = `${index}:${item.type}`;
  if (item.type === "star") {
    return { key, kind: "star", title: starTitle(lookup.stars.find((s) => s.id === item.starId)), detail: "별" };
  }
  if (item.type === "planet") {
    const planet = lookup.planets.find((p) => p.id === item.planetId);
    return { key, kind: "planet", title: planet?.name ?? "행성", detail: `행성 · ${periodText(item.period)}` };
  }
  return { key, kind: "universe", title: "우주 전체", detail: periodText(item.period) };
}

/** 같은 기간의 우주 전체가 이미 실려 있는지 */
export function hasUniverse(cargo: readonly CargoItem[], period: Period): boolean {
  return cargo.some((c) => c.type === "universe" && c.period.from === period.from && c.period.to === period.to);
}
