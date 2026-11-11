// 웹 개발용 목업 (`npm run dev:mock`). 화면 전환 확인에 필요한 조회 API만 흉내 낸다.
// shortcut: 개발 B의 mocks/api/(이슈 #1)가 나오면 그 JSON을 읽도록 바꾼다.
import type { Planet, Star, StarKind } from "../types";
import { ApiError, MESSAGES } from "./client";
import { localDate } from "../period";

const planet = (id: string, name: string, n: number, defaultFor: Planet["defaultFor"] = null): Planet => ({
  id,
  name,
  system: id === "uncategorized" ? "uncategorized" : null,
  defaultFor,
  colorToken: `planet-${n}`,
  createdAtUtc: "2026-11-01T00:00:00Z",
});

const planets: Planet[] = [
  planet("p-image", "이미지", 1, "image"),
  planet("p-doc", "문서", 2, "file"),
  planet("p-link", "링크", 3, "link"),
  planet("p-memo", "메모", 4, "text"),
  planet("p-other", "기타", 5, "other"),
  planet("uncategorized", "미분류", 6),
];

const PLANET_OF: Record<StarKind, string> = { image: "p-image", file: "p-doc", link: "p-link", text: "p-memo" };

function star(i: number, kind: StarKind, daysAgo: number): Star {
  const at = new Date(Date.now() - daysAgo * 86_400_000 - i * 60_000);
  return {
    id: `s-${String(i).padStart(3, "0")}`,
    kind,
    planetId: PLANET_OF[kind],
    createdAtUtc: at.toISOString(),
    tzOffsetMin: -at.getTimezoneOffset(),
    updatedAtUtc: at.toISOString(),
    storagePath: null,
    originalName: kind === "image" || kind === "file" ? `기록 ${i}.${kind === "image" ? "png" : "pdf"}` : null,
    mimeType: null,
    sizeBytes: null,
    sha256: null,
    url: kind === "link" ? `https://example.com/${i}` : null,
    linkTitle: kind === "link" ? `예시 링크 ${i}` : null,
    linkDomain: kind === "link" ? "example.com" : null,
    textBody: kind === "text" ? `메모 본문 ${i}` : null,
    thumbnailPath: null,
    thumbnailStatus: "fallback",
    linkFetchStatus: kind === "link" ? "done" : "none",
    memo: i % 3 === 0 ? `한 줄 메모 ${i}` : null,
  };
}

const kinds: StarKind[] = ["image", "file", "link", "text"];
// 오늘 6개, 지난 30일에 걸쳐 24개
const stars: Star[] = Array.from({ length: 30 }, (_, i) => star(i, kinds[i % 4], i < 6 ? 0 : i - 5));

const withLocalDate = (s: Star): Star => ({ ...s, localDate: localDate(new Date(s.createdAtUtc)) });

export async function mockApi(method: string, path: string): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 150));
  const url = new URL(path, "http://mock");
  if (method === "GET" && url.pathname === "/api/health") return { ok: true };
  if (method === "GET" && url.pathname === "/api/universe") {
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const today = localDate(new Date());
    // 미래 시각 기록은 "오늘"에 넣는다 (POLICY 3-4)
    const inPeriod = stars.map(withLocalDate).filter((s) => {
      const d = s.localDate! > today ? today : s.localDate!;
      return d >= from && d <= to;
    });
    return {
      stars: inPeriod,
      planets: planets.map((p) => ({
        ...p,
        starCountInPeriod: inPeriod.filter((s) => s.planetId === p.id).length,
        starCountTotal: stars.filter((s) => s.planetId === p.id).length,
      })),
    };
  }
  const m = url.pathname.match(/^\/api\/stars\/([^/]+)$/);
  if (method === "GET" && m) {
    const s = stars.find((x) => x.id === decodeURIComponent(m[1]));
    if (s) return withLocalDate(s);
  }
  if (method === "GET" && url.pathname === "/api/rediscovery/today") return null;
  throw new ApiError("NOT_FOUND", `${MESSAGES.NOT_FOUND} (목업에 없는 API: ${method} ${url.pathname})`, 404);
}
