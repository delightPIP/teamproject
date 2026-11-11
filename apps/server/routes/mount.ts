// 라우트 묶음을 app.ts의 routes Map에 붙인다. 같은 경로가 두 번 붙으면 시작할 때 바로 알 수 있게 던진다.
// 연결 예 (DB가 들어오면 index.ts에서):
//   mountRoutes(routes, rediscoveryRoutes(rediscoveryRepo));
//   mountRoutes(routes, exportRoutes(exportRepo));
import type { RouteHandler } from "../app.ts";

export function mountRoutes(target: Map<string, RouteHandler>, handlers: Record<string, RouteHandler>): () => void {
  const keys = Object.keys(handlers);
  for (const key of keys) {
    if (target.has(key)) throw new Error(`라우트가 이미 있어요: ${key}`);
  }
  for (const key of keys) target.set(key, handlers[key]);
  return () => keys.forEach((k) => target.delete(k));
}
