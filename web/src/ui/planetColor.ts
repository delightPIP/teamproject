/** 행성 색은 8가지를 돌려 쓴다: "planet-9" → "planet-1" (DESIGN 3-1). 이상한 값이면 1번 색 */
export function planetColorToken(colorToken: string): string {
  const n = Number(/^planet-(\d+)$/.exec(colorToken)?.[1]);
  return Number.isInteger(n) && n > 0 ? `planet-${((n - 1) % 8) + 1}` : "planet-1";
}
