// 기간·현지 날짜 계산 — POLICY 1-4, 2-1, 3-4 / SPEC 2-5, 3-6.
// 모든 "현지"는 이 코드를 실행하는 PC의 지금 시간대다. 저장된 tzOffsetMin은 쓰지 않는다 (시간대가 바뀌면 다시 계산).
import type { Period, PeriodPreset } from "./types.ts";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → 현지 날짜 "YYYY-MM-DD" */
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → 그날 현지 00:00 */
export function parseLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`날짜 형식이 아니에요: ${s}`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (toLocalDateString(d) !== s) throw new RangeError(`없는 날짜예요: ${s}`);
  return d;
}

export function addDays(s: string, days: number): string {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

/** 기록의 현지 날짜. 미래 시각(PC 시계 변경 등)은 오늘로 본다 (P 3-4) */
export function localDate(createdAtUtc: string, now: Date = new Date()): string {
  const d = toLocalDateString(new Date(createdAtUtc));
  const today = toLocalDateString(now);
  return d > today ? today : d;
}

/** 오늘: 현지 00:00 ~ 지금 */
export function todayPeriod(now: Date = new Date()): Period {
  const today = toLocalDateString(now);
  return { preset: "today", from: today, to: today };
}

/** 이번 주: 이번 주 월요일 00:00 ~ 지금 */
export function weekPeriod(now: Date = new Date()): Period {
  const today = toLocalDateString(now);
  const sinceMonday = (now.getDay() + 6) % 7; // 일요일(0) → 6
  return { preset: "week", from: addDays(today, -sinceMonday), to: today };
}

/**
 * 직접 지정: 순서가 뒤바뀌면 맞바꾸고, 1년을 넘으면 종료일을 자른다 (P 2-1, 잠정).
 * 1년 = 시작일부터 다음 해 같은 날의 전날까지 (2026-01-01 → 2026-12-31).
 */
export function customPeriod(from: string, to: string): Period {
  parseLocalDate(from);
  parseLocalDate(to);
  if (from > to) [from, to] = [to, from];
  const start = parseLocalDate(from);
  const max = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
  const maxTo = toLocalDateString(max);
  return { preset: "custom", from, to: to > maxTo ? maxTo : to };
}

export function periodFor(
  preset: PeriodPreset,
  now: Date = new Date(),
  custom?: { from: string; to: string },
): Period {
  if (preset === "today") return todayPeriod(now);
  if (preset === "week") return weekPeriod(now);
  if (!custom) throw new RangeError("직접 지정 기간에는 from·to가 필요해요");
  return customPeriod(custom.from, custom.to);
}

/** 기록이 기간 안에 있는지 (양 끝 날짜 포함) */
export function inPeriod(createdAtUtc: string, period: Period, now: Date = new Date()): boolean {
  const d = localDate(createdAtUtc, now);
  return period.from <= d && d <= period.to;
}

/**
 * DB 조회용 UTC 경계: startUtc <= createdAtUtc < endUtc.
 * 기간이 오늘을 포함하면 endUtc = null (상한 없음) — 미래 시각 기록도 "오늘"에 들어가야 하므로.
 */
export function periodUtcBounds(period: Period, now: Date = new Date()): { startUtc: string; endUtc: string | null } {
  const startUtc = parseLocalDate(period.from).toISOString();
  if (period.to >= toLocalDateString(now)) return { startUtc, endUtc: null };
  return { startUtc, endUtc: parseLocalDate(addDays(period.to, 1)).toISOString() };
}
