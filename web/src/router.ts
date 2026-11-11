// 해시 라우팅 (SPEC 2-5): #/ · #/planet/:id · #/star/:id · #/probe
// 해시 뒤의 ?query(token, from 등)도 함께 읽는다. 해시는 서버로 전송되지 않는다 (SPEC 3-3).

export type Route =
  | { name: "home" }
  | { name: "planet"; id: string }
  | { name: "star"; id: string }
  | { name: "probe" };

export function parseHash(hash: string): { route: Route; params: URLSearchParams } {
  const raw = hash.replace(/^#/, "");
  const q = raw.indexOf("?");
  const path = q === -1 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q === -1 ? "" : raw.slice(q + 1));
  const [, a, b] = path.split("/");
  let route: Route = { name: "home" };
  if (a === "planet" && b) route = { name: "planet", id: decodeURIComponent(b) };
  else if (a === "star" && b) route = { name: "star", id: decodeURIComponent(b) };
  else if (a === "probe") route = { name: "probe" };
  return { route, params };
}

export function formatHash(route: Route, params?: URLSearchParams): string {
  const path =
    route.name === "planet" || route.name === "star" ? `#/${route.name}/${encodeURIComponent(route.id)}` : route.name === "probe" ? "#/probe" : "#/";
  const qs = params?.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * 주소의 토큰을 꺼내고 주소에서 지운 해시를 돌려준다 (SPEC 3-3).
 * `#/?token=…`(SPEC 형식)과 `?token=…#/`(검색어) 둘 다 받는다.
 */
export function takeToken(search: string, hash: string): { token: string | null; cleanSearch: string; cleanHash: string } {
  const s = new URLSearchParams(search);
  const { route, params } = parseHash(hash);
  const token = params.get("token") ?? s.get("token");
  s.delete("token");
  params.delete("token");
  const qs = s.toString();
  return { token, cleanSearch: qs ? `?${qs}` : "", cleanHash: formatHash(route, params) };
}
