import { beforeEach, describe, expect, it } from "vitest";
import { setMock } from "./api/client";
import { customPeriod, weekPeriod } from "./period";
import { formatHash, parseHash, takeToken } from "./router";
import { createWebStore } from "./state/store";
import type { Period, Planet, Star } from "./types";

describe("router", () => {
  it("해시 경로를 읽고 다시 만든다", () => {
    expect(parseHash("#/star/s-1?from=rediscovery").route).toEqual({ name: "star", id: "s-1" });
    expect(parseHash("#/planet/p%2F1").route).toEqual({ name: "planet", id: "p/1" });
    expect(parseHash("").route).toEqual({ name: "home" });
    expect(parseHash("#/probe").route).toEqual({ name: "probe" });
    expect(formatHash({ name: "planet", id: "p/1" })).toBe("#/planet/p%2F1");
  });

  it("토큰을 꺼내고 주소에서 지운다 (다른 값은 남긴다)", () => {
    expect(takeToken("", "#/star/s-1?token=abc&from=rediscovery")).toEqual({
      token: "abc",
      cleanSearch: "",
      cleanHash: "#/star/s-1?from=rediscovery",
    });
    expect(takeToken("?token=xyz", "")).toEqual({ token: "xyz", cleanSearch: "", cleanHash: "#/" });
  });
});

describe("period", () => {
  it("이번 주는 월요일부터", () => {
    expect(weekPeriod(new Date(2026, 10, 11))).toMatchObject({ from: "2026-11-09", to: "2026-11-11" }); // 수요일
    expect(weekPeriod(new Date(2026, 10, 15))).toMatchObject({ from: "2026-11-09" }); // 일요일
  });

  it("직접 지정은 최대 1년, 순서가 뒤집히면 바로잡는다", () => {
    expect(customPeriod("2026-01-10", "2027-03-01")).toEqual({
      period: { preset: "custom", from: "2026-01-10", to: "2027-01-10" },
      clamped: true,
    });
    expect(customPeriod("2026-11-11", "2026-11-01").period).toMatchObject({ from: "2026-11-01", to: "2026-11-11" });
  });
});

const planet = (id: string): Planet => ({ id, name: id, system: null, defaultFor: null, colorToken: "planet-1", createdAtUtc: "" });
const star = (id: string, planetId: string) => ({ id, planetId, kind: "text" }) as Star;
const P: Period = { preset: "today", from: "2026-11-11", to: "2026-11-11" };

describe("store 계약", () => {
  let hashes: string[];
  let s: ReturnType<typeof createWebStore>;
  let universe: { stars: Star[]; planets: Planet[] } | Error;

  beforeEach(() => {
    hashes = [];
    universe = { stars: [star("s1", "a")], planets: [planet("a"), planet("b")] };
    setMock(async (_m, path) => {
      if (path.startsWith("/api/universe")) {
        if (universe instanceof Error) throw universe;
        return universe;
      }
      if (path === "/api/stars/far") return star("far", "b");
      throw new Error(path);
    });
    s = createWebStore((h) => hashes.push(h));
    s.setState({ auth: "ok", stars: [star("s1", "a")], planets: [planet("a"), planet("b")] });
  });

  it("openPanel·openStar·closePanel 이 URL과 선택 상태를 맞춘다", () => {
    s.getState().openStar("s1");
    expect(s.getState()).toMatchObject({ selectedStarId: "s1", selectedPlanetId: "a" });
    s.getState().goBack(); // 상세 → 패널
    expect(s.getState()).toMatchObject({ selectedStarId: null, selectedPlanetId: "a" });
    s.getState().goBack(); // 패널 → 닫기
    expect(s.getState()).toMatchObject({ selectedPlanetId: null, camera: "flight" });
    s.getState().goBack(); // 조망
    expect(s.getState().camera).toBe("overview");
    expect(hashes).toEqual(["#/star/s1", "#/planet/a", "#/"]);
  });

  it("기간 밖 별은 서버에서 행성을 찾는다", async () => {
    s.getState().openStar("far");
    await new Promise((r) => setTimeout(r));
    expect(s.getState().selectedPlanetId).toBe("b");
  });

  it("flyToPlanet: 3D 등록이 없으면 바로, 있으면 도착 후 패널을 연다", async () => {
    await s.getState().flyToPlanet("a", "openPanel");
    expect(s.getState().selectedPlanetId).toBe("a");

    const seen: string[] = [];
    s.getState().registerFlyToPlanet(async (id) => {
      seen.push(`${id}:${s.getState().camera}`);
    });
    await s.getState().flyToPlanet("b", "openPanel");
    expect(seen).toEqual(["b:flyingTo"]);
    expect(s.getState()).toMatchObject({ selectedPlanetId: "b", camera: "landed" });
  });

  it("addToCargo 는 같은 항목을 두 번 넣지 않는다", () => {
    const g = s.getState();
    expect(g.addToCargo({ type: "star", starId: "s1" })).toBe(true);
    expect(g.addToCargo({ type: "star", starId: "s1" })).toBe(false);
    expect(g.addToCargo({ type: "planet", planetId: "a", period: P })).toBe(true);
    expect(g.addToCargo({ type: "planet", planetId: "a", period: { ...P, preset: "week" } })).toBe(true);
    expect(s.getState().cargo).toHaveLength(3);
    s.getState().removeFromCargo(0);
    expect(s.getState().cargo[0]).toMatchObject({ type: "planet" });
  });

  it("삭제·합치기된 별·행성을 탐사선에서 빼거나 바꾼다 (SPEC 3-7)", () => {
    const g = s.getState();
    g.addToCargo({ type: "star", starId: "s1" });
    g.addToCargo({ type: "planet", planetId: "a", period: P });
    g.addToCargo({ type: "planet", planetId: "b", period: P });
    g.openPanel("a");
    g.planetMerged("a", "b");
    expect(s.getState().cargo).toEqual([
      { type: "star", starId: "s1" },
      { type: "planet", planetId: "b", period: P },
    ]);
    expect(s.getState().selectedPlanetId).toBe("b");
    expect(s.getState().stars[0].planetId).toBe("b");

    s.getState().starsDeleted(["s1"]);
    s.getState().planetDeleted("b");
    expect(s.getState().cargo).toEqual([]);
    expect(s.getState()).toMatchObject({ selectedPlanetId: null, camera: "overview" });
  });

  it("다시 받기 실패 시 마지막 데이터를 유지한다 (SPEC 3-4)", async () => {
    universe = new Error("down");
    await expect(s.getState().refresh()).rejects.toThrow();
    expect(s.getState().stars).toHaveLength(1);
  });

  it("오늘 0건이면 이번 주로 넓힌다", async () => {
    let calls = 0;
    setMock(async () => (++calls === 1 ? { stars: [], planets: [planet("a")] } : { stars: [star("s9", "a")], planets: [planet("a")] }));
    await s.getState().loadInitial();
    expect(s.getState()).toMatchObject({ periodAutoExpanded: true, period: { preset: "week" } });
  });
});

describe("api client", () => {
  it("서버에 닿지 못하면 lost, 401이면 다시 열기 화면, 오류 문구는 서버 것을 쓴다", async () => {
    const { request, setApiListeners, ApiError } = await import("./api/client");
    const events: string[] = [];
    setApiListeners({ onConnection: (c) => events.push(c), onUnauthorized: () => events.push("401") });
    setMock(null);
    const real = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        throw new TypeError("offline");
      }) as typeof fetch;
      await expect(request("GET", "/api/health")).rejects.toMatchObject({ code: "NETWORK" });

      globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
      await expect(request("GET", "/api/health")).rejects.toBeInstanceOf(ApiError);

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: { code: "PLANET_LIMIT", message: "서버 문구" } }), { status: 409 })) as typeof fetch;
      await expect(request("POST", "/api/planets", {})).rejects.toMatchObject({ code: "PLANET_LIMIT", message: "서버 문구" });
    } finally {
      globalThis.fetch = real;
    }
    expect(events).toEqual(["lost", "ok", "401", "ok"]);
  });
});
