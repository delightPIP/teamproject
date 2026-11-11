// POLICY 2-1 기간 계산.
// shortcut: packages/shared/period.ts(이슈 #1)가 생기면 그쪽으로 바꾼다.
import type { Period } from "./types";

export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayPeriod(now = new Date()): Period {
  const t = localDate(now);
  return { preset: "today", from: t, to: t };
}

/** 이번 주 월요일 ~ 오늘 */
export function weekPeriod(now = new Date()): Period {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return { preset: "week", from: localDate(monday), to: localDate(now) };
}

/** 직접 지정. 순서가 뒤집혔으면 바로잡고, 1년을 넘으면 종료일을 시작일 + 1년으로 자른다 (SPEC 1-4). */
export function customPeriod(from: string, to: string): { period: Period; clamped: boolean } {
  if (from > to) [from, to] = [to, from];
  const limit = new Date(`${from}T00:00:00`);
  limit.setFullYear(limit.getFullYear() + 1);
  const max = localDate(limit);
  const clamped = to > max;
  return { period: { preset: "custom", from, to: clamped ? max : to }, clamped };
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.preset === b.preset && a.from === b.from && a.to === b.to;
}
