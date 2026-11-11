// 재발견 알림을 보낼 때인지 판단하는 순수 함수 (SPEC 3-6 알림 보내기 1단계, POLICY 2-2).
// Electron 없이 node --test로 검사한다.

/** 현지 날짜 "YYYY-MM-DD" */
export function localDateOf(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * 알림 켜짐 && 현지 시각 ≥ 알림 시각 && 오늘 아직 안 보냄.
 * 지난 날짜를 몰아 보내지 않는다: 어제 못 보냈어도 오늘 한 번만 확인한다.
 */
export function shouldNotify(opts: { enabled: boolean; time: string; lastNotifiedLocalDate: string | null; now: Date }): boolean {
  if (!opts.enabled) return false;
  if (opts.lastNotifiedLocalDate === localDateOf(opts.now)) return false;
  const [h, m] = opts.time.split(":").map(Number);
  return opts.now.getHours() * 60 + opts.now.getMinutes() >= h * 60 + m;
}

export function notificationTitle(daysAgo: number): string {
  return `${daysAgo}일 전 오늘의 별 ✦`;
}
