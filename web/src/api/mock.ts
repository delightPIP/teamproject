// 웹 개발용 목업 (`npm run dev:mock`). 개발 B의 mocks/api JSON을 그대로 돌려준다.
// 목업의 가상 "오늘"은 2026-11-11 이라 기간과 상관없이 같은 우주를 돌려준다 (mocks/api/README.md).
// `#/?token=dev&mock=empty` 로 열면 기록 0건 우주를 돌려준다.
import { ERROR_MESSAGES } from "@spacelog/shared/errors";
import type { ExportRequest, Star, UniverseResponse } from "@spacelog/shared/types";
import { buildExport } from "../../../apps/server/export/buildExport.ts";
import universe from "../../../mocks/api/universe.json";
import universeEmpty from "../../../mocks/api/universe.empty.json";
import rediscoveryToday from "../../../mocks/api/rediscovery/today.json";
import { RequestError } from "./client.ts";

// JSON import 는 리터럴 타입이 넓혀져 있다. 형식은 mocks/api/mocks.test.ts 가 검사한다
const starFiles = Object.values(import.meta.glob("../../../mocks/api/stars/*.json", { eager: true, import: "default" })) as Star[];

const empty = new URLSearchParams(location.hash.split("?")[1]).get("mock") === "empty";
const data = (empty ? universeEmpty : universe) as unknown as UniverseResponse;

/** 목업의 가상 "오늘" (mocks/api/README.md) */
const MOCK_NOW = new Date("2026-11-11T12:00:00+09:00");

export async function mockApi(method: string, path: string, body?: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 150));
  const url = new URL(path, "http://mock");
  if (method === "GET" && url.pathname === "/api/health") return { ok: true };
  if (method === "GET" && url.pathname === "/api/universe") return data;
  const m = url.pathname.match(/^\/api\/stars\/([^/]+)$/);
  if (method === "GET" && m) {
    const id = decodeURIComponent(m[1]);
    const star = [...data.stars, ...starFiles].find((s) => s.id === id);
    if (star) return star;
  }
  if (method === "POST" && url.pathname === "/api/export") {
    // 서버와 같은 생성 로직 (apps/server/export). 목업에는 원본 파일이 없어 .md 본문은 비어 있다
    const { items, format } = body as ExportRequest;
    return buildExport(items, format, { stars: data.stars, planets: data.planets, now: MOCK_NOW });
  }
  if (method === "GET" && url.pathname === "/api/rediscovery/today") return empty ? null : rediscoveryToday;
  throw new RequestError("NOT_FOUND", `${ERROR_MESSAGES.NOT_FOUND} (목업에 없는 API: ${method} ${url.pathname})`, 404);
}
