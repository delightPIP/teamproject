// 오늘의 재발견 별 고르기 (SPEC 3-6, POLICY 2-2). 저장·조회는 호출하는 쪽(라우트)이 맡는다.
import { subtractDays, toLocalDate } from "../_tmp/localDate.ts";

/** 7일 전 → 14일 전 → 30일 전 순서로 찾는다 (SQ1). */
export const REDISCOVERY_DAYS = [7, 14, 30] as const;
export type DaysAgo = (typeof REDISCOVERY_DAYS)[number];

export interface PickCandidate {
  id: string;
  createdAtUtc: string;
}

export interface PickInput {
  today: string; // 현지 날짜 "YYYY-MM-DD"
  timeZone: string; // 지금 PC 시간대 (IANA)
  stars: readonly PickCandidate[];
  recentPickedStarIds: Iterable<string>; // 최근 30일 안에 픽된 별
}

export interface PickResult {
  starId: string;
  daysAgo: DaysAgo;
}

/** FNV-1a 32비트. 날짜 문자열을 시드로 쓴다. */
export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pickToday(input: PickInput): PickResult | null {
  const excluded = new Set(input.recentPickedStarIds);
  const byLocalDate = new Map<string, string[]>();
  for (const star of input.stars) {
    if (excluded.has(star.id)) continue;
    const date = toLocalDate(star.createdAtUtc, input.timeZone);
    byLocalDate.set(date, [...(byLocalDate.get(date) ?? []), star.id]);
  }

  for (const daysAgo of REDISCOVERY_DAYS) {
    const candidates = byLocalDate.get(subtractDays(input.today, daysAgo));
    if (!candidates?.length) continue;
    const sorted = [...candidates].sort();
    return { starId: sorted[hash32(input.today) % sorted.length], daysAgo };
  }
  return null;
}
