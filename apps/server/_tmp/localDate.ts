// 임시 날짜 유틸 (개발 A 전용). #1의 packages/shared/period.ts가 나오면 그쪽으로 교체한다.

/** UTC ISO 시각을 지정한 시간대의 현지 날짜 "YYYY-MM-DD"로 바꾼다. */
export function toLocalDate(utcIso: string, timeZone: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`잘못된 시각: ${utcIso}`);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC ISO 시각을 지정한 시간대의 "YYYY.MM.DD HH:mm"으로 바꾼다. */
export function toLocalDateTime(utcIso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcIso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DD"에서 days일을 뺀 날짜를 돌려준다. */
export function subtractDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - days));
  return date.toISOString().slice(0, 10);
}

/** "2026-11-11" → "2026.11.11" */
export function dotDate(localDate: string): string {
  return localDate.replaceAll("-", ".");
}
