import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Period, Planet, Star } from "@spacelog/shared/types";
import { request, RequestError, setApiListeners, setMock } from "./api/client.ts";
import { formatHash, parseHash, takeToken } from "./router.ts";
import { createWebStore } from "./state/store.ts";

/** actual 이 expected 의 키를 모두 같은 값으로 갖는지 (중첩 객체도 부분 비교) */
function has(actual: unknown, expected: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(expected)) {
    const a = (actual as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !Array.isArray(v)) has(a, v as Record<string, unknown>);
    else assert.deepEqual(a, v, k);
  }
}

describe("router", () => {
  it("해시 경로를 읽고 다시 만든다", () => {
    assert.deepEqual(parseHash("#/star/s-1?from=rediscovery").route, { name: "star", id: "s-1" });
    assert.deepEqual(parseHash("#/planet/p%2F1").route, { name: "planet", id: "p/1" });
    assert.deepEqual(parseHash("").route, { name: "home" });
    assert.deepEqual(parseHash("#/probe").route, { name: "probe" });
    assert.equal(formatHash({ name: "planet", id: "p/1" }), "#/planet/p%2F1");
  });

  it("토큰을 꺼내고 주소에서 지운다 (다른 값은 남긴다)", () => {
    assert.deepEqual(takeToken("", "#/star/s-1?token=abc&from=rediscovery"), {
      token: "abc",
      cleanSearch: "",
      cleanHash: "#/star/s-1?from=rediscovery",
    });
    assert.deepEqual(takeToken("?token=xyz", ""), { token: "xyz", cleanSearch: "", cleanHash: "#/" });
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
    has(s.getState(), { selectedStarId: "s1", selectedPlanetId: "a" });
    s.getState().goBack(); // 상세 → 패널
    has(s.getState(), { selectedStarId: null, selectedPlanetId: "a" });
    s.getState().goBack(); // 패널 → 닫기
    has(s.getState(), { selectedPlanetId: null, camera: "flight" });
    s.getState().goBack(); // 조망
    assert.equal(s.getState().camera, "overview");
    assert.deepEqual(hashes, ["#/star/s1", "#/planet/a", "#/"]);
  });

  it("기간 밖 별은 서버에서 행성을 찾는다", async () => {
    s.getState().openStar("far");
    await new Promise((r) => setTimeout(r));
    assert.equal(s.getState().selectedPlanetId, "b");
  });

  it("flyToPlanet: 3D 등록이 없으면 바로, 있으면 도착 후 패널을 연다", async () => {
    await s.getState().flyToPlanet("a", "openPanel");
    assert.equal(s.getState().selectedPlanetId, "a");

    const seen: string[] = [];
    s.getState().registerFlyToPlanet(async (id) => {
      seen.push(`${id}:${s.getState().camera}`);
      return true;
    });
    assert.equal(await s.getState().flyToPlanet("b", "openPanel"), true);
    assert.deepEqual(seen, ["b:flyingTo"]);
    has(s.getState(), { selectedPlanetId: "b", camera: "landed" });
  });

  it("flyToPlanet: 이동 키로 자동 비행을 멈추면 패널을 열지 않는다 (DESIGN 9-4)", async () => {
    s.getState().closePanel();
    s.getState().registerFlyToPlanet(async () => false);
    assert.equal(await s.getState().flyToPlanet("a", "openPanel"), false);
    has(s.getState(), { selectedPlanetId: null, camera: "flight" });
  });

  it("addToCargo 는 같은 항목을 두 번 넣지 않는다", () => {
    const g = s.getState();
    assert.equal(g.addToCargo({ type: "star", starId: "s1" }), true);
    assert.equal(g.addToCargo({ type: "star", starId: "s1" }), false);
    assert.equal(g.addToCargo({ type: "planet", planetId: "a", period: P }), true);
    assert.equal(g.addToCargo({ type: "planet", planetId: "a", period: { ...P, preset: "week" } }), true);
    assert.equal(s.getState().cargo.length, 3);
    s.getState().removeFromCargo(0);
    has(s.getState().cargo[0], { type: "planet" });
  });

  it("삭제·합치기된 별·행성을 탐사선에서 빼거나 바꾼다 (SPEC 3-7)", () => {
    const g = s.getState();
    g.addToCargo({ type: "star", starId: "s1" });
    g.addToCargo({ type: "planet", planetId: "a", period: P });
    g.addToCargo({ type: "planet", planetId: "b", period: P });
    g.openPanel("a");
    g.planetMerged("a", "b");
    assert.deepEqual(s.getState().cargo, [
      { type: "star", starId: "s1" },
      { type: "planet", planetId: "b", period: P },
    ]);
    assert.equal(s.getState().selectedPlanetId, "b");
    assert.equal(s.getState().stars[0].planetId, "b");

    s.getState().starsDeleted(["s1"]);
    s.getState().planetDeleted("b");
    assert.deepEqual(s.getState().cargo, []);
    has(s.getState(), { selectedPlanetId: null, camera: "overview" });
  });

  it("다시 받기 실패 시 마지막 데이터를 유지한다 (SPEC 3-4)", async () => {
    universe = new Error("down");
    await assert.rejects(s.getState().refresh());
    assert.equal(s.getState().stars.length, 1);
  });

  it("오늘 0건이면 이번 주로 넓힌다", async () => {
    let calls = 0;
    setMock(async () => (++calls === 1 ? { stars: [], planets: [planet("a")] } : { stars: [star("s9", "a")], planets: [planet("a")] }));
    await s.getState().loadInitial();
    has(s.getState(), { periodAutoExpanded: true, period: { preset: "week" } });
  });
});

describe("api client", () => {
  it("서버에 닿지 못하면 lost, 401이면 다시 열기 화면, 오류 문구는 서버 것을 쓴다", async () => {
    const events: string[] = [];
    setApiListeners({ onConnection: (c) => events.push(c), onUnauthorized: () => events.push("401") });
    setMock(null);
    const real = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        throw new TypeError("offline");
      }) as typeof fetch;
      await assert.rejects(request("GET", "/api/health"), { code: "NETWORK" });

      globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
      await assert.rejects(request("GET", "/api/health"), RequestError);

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: { code: "PLANET_LIMIT", message: "서버 문구" } }), { status: 409 })) as typeof fetch;
      await assert.rejects(request("POST", "/api/planets", {}), { code: "PLANET_LIMIT", message: "서버 문구" });
    } finally {
      globalThis.fetch = real;
    }
    assert.deepEqual(events, ["lost", "ok", "401", "ok"]);
  });
});
