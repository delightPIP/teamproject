// 우주 배치 계산 (SPEC 3-5, POLICY 2-5). Three.js 없이 숫자만 다뤄 테스트할 수 있게 둔다.

/** 행성 기본 반지름 범위 (DESIGN.md 8장). 행성마다 id 로 이 안에서 고정 */
export const PLANET_MIN_R = 3.6;
export const PLANET_MAX_R = 6;
/** 기간 안 별 1개마다 커지는 비율 (DESIGN.md 8장 "+3.5%") */
export const PLANET_GROWTH = 0.035;
/**
 * 이 개수부터는 더 커지지 않는다. 문서에 상한이 없어 별 2,000개면 71배가 되므로 M5(행성당 별 최근 50개)에 맞춰 둔다.
 * shortcut: 디자이너 확인 전 임시값 (S1 · M5)
 */
export const PLANET_GROWTH_CAP = 50;
/** 기간 안 별이 이보다 많으면 별은 그리지 않는다 (POLICY 3-4, 잠정) */
export const STAR_LIMIT = 2000;

/** 행성 기본 반지름 3.6 ~ 6. 같은 행성은 늘 같은 값 */
export function planetBaseRadius(planetId: string): number {
  return PLANET_MIN_R + seeded(`${planetId}:radius`)() * (PLANET_MAX_R - PLANET_MIN_R);
}

/** 기본 반지름 × (1 + 3.5% × 별 개수). 0개면 그리지 않으므로 0 (S1 → DESIGN.md 8장) */
export function planetRadius(n: number, base: number): number {
  if (n <= 0) return 0;
  return base * (1 + PLANET_GROWTH * Math.min(n, PLANET_GROWTH_CAP));
}

/** 가장 커졌을 때의 반지름 */
export const PLANET_LARGEST_R = PLANET_MAX_R * (1 + PLANET_GROWTH * PLANET_GROWTH_CAP);

/** 문자열 → 32비트 해시 (FNV-1a). 같은 id 는 늘 같은 값 */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** id 시드 난수열 (mulberry32). 0 이상 1 미만 */
export function seeded(id: string): () => number {
  let a = hash32(id);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Vec3 = [number, number, number];

const MIN_GAP = PLANET_LARGEST_R * 2 + 6; // 가장 큰 행성 둘이 겹치지 않을 거리

/**
 * 행성 위치. 원판 위에 id 시드로 흩뿌리고, 먼저 만든 행성과 너무 가까우면 바깥으로 민다.
 * 행성 목록은 기간과 무관하게 전체가 오므로 기간이 바뀌어도 같은 행성은 같은 자리다.
 */
export function planetPositions(planets: { id: string; createdAtUtc: string }[]): Map<string, Vec3> {
  const order = [...planets].sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc) || a.id.localeCompare(b.id));
  const out = new Map<string, Vec3>();
  const placed: Vec3[] = [];
  for (const p of order) {
    const rnd = seeded(p.id);
    const angle = rnd() * Math.PI * 2;
    const y = (rnd() - 0.5) * 16;
    let dist = 20 + rnd() * 30;
    let pos: Vec3 = [Math.cos(angle) * dist, y, Math.sin(angle) * dist];
    for (let tries = 0; tries < 60 && placed.some((q) => distance(q, pos) < MIN_GAP); tries++) {
      dist += 4;
      pos = [Math.cos(angle) * dist, y, Math.sin(angle) * dist];
    }
    placed.push(pos);
    out.set(p.id, pos);
  }
  return out;
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export interface Orbit {
  /** 행성 반지름에 곱할 궤도 반지름 배수 1.6 ~ 3.0 */
  radiusFactor: number;
  /** 궤도면 기울기 (라디안) */
  tiltX: number;
  tiltZ: number;
  /** 시작 각도 */
  phase: number;
  /** 각속도 (라디안/초). 느리고 일정 */
  speed: number;
}

/** 별의 궤도. 별 id 시드라 다시 그려도 같은 궤도 */
export function starOrbit(starId: string): Orbit {
  const rnd = seeded(starId);
  return {
    radiusFactor: 1.6 + rnd() * 1.4,
    tiltX: (rnd() - 0.5) * 1.4,
    tiltZ: (rnd() - 0.5) * 1.4,
    phase: rnd() * Math.PI * 2,
    speed: (0.18 + rnd() * 0.2) * (rnd() < 0.5 ? -1 : 1),
  };
}

/** 조망 시점: 모든 행성의 경계 구가 화면에 들어오는 중심과 카메라 거리 (SPEC 3-3) */
export function overviewFrame(spheres: { pos: Vec3; r: number }[], fovDeg: number, aspect: number): { center: Vec3; dist: number } {
  if (spheres.length === 0) return { center: [0, 0, 0], dist: 60 };
  const center: Vec3 = [0, 1, 2].map((i) => spheres.reduce((s, p) => s + p.pos[i], 0) / spheres.length) as Vec3;
  const radius = Math.max(...spheres.map((p) => distance(center, p.pos) + p.r)) + 4;
  const vHalf = (fovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return { center, dist: radius / Math.sin(Math.min(vHalf, hHalf)) };
}
