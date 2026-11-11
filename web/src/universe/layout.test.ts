import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distance, overviewFrame, PLANET_BASE, planetPositions, planetRadius, starOrbit } from "./layout.ts";

describe("planetRadius (POLICY 2-5)", () => {
  it("0개면 그리지 않고, 기본값 1배 ~ 4배 사이", () => {
    assert.equal(planetRadius(0), 0);
    assert.equal(planetRadius(1), PLANET_BASE * 2);
    assert.equal(planetRadius(3), PLANET_BASE * 3);
    assert.equal(planetRadius(7), PLANET_BASE * 4);
    assert.equal(planetRadius(5000), PLANET_BASE * 4);
  });
});

describe("planetPositions", () => {
  const planets = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, createdAtUtc: `2026-11-${String(i + 1).padStart(2, "0")}` }));

  it("같은 행성은 같은 자리, 다른 행성이 생겨도 먼저 있던 행성은 그대로", () => {
    const a = planetPositions(planets);
    const b = planetPositions([...planets, { id: "new", createdAtUtc: "2026-12-01" }]);
    for (const p of planets) assert.deepEqual(a.get(p.id), b.get(p.id));
  });

  it("가장 큰 행성끼리도 겹치지 않는다", () => {
    const pos = [...planetPositions(planets).values()];
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) assert.ok(distance(pos[i], pos[j]) > 8 * PLANET_BASE, `${i}-${j}`);
  });
});

describe("starOrbit", () => {
  it("궤도 반지름은 행성 반지름의 1.6 ~ 3.0배, 같은 별은 같은 궤도", () => {
    for (let i = 0; i < 200; i++) {
      const o = starOrbit(`s${i}`);
      assert.ok(o.radiusFactor >= 1.6 && o.radiusFactor <= 3.0);
    }
    assert.deepEqual(starOrbit("x"), starOrbit("x"));
  });
});

describe("overviewFrame", () => {
  it("모든 행성이 시야각 안에 들어오는 거리", () => {
    const spheres = [
      { pos: [40, 0, 0] as [number, number, number], r: 10 },
      { pos: [-40, 0, 0] as [number, number, number], r: 10 },
    ];
    const { center, dist } = overviewFrame(spheres, 58, 16 / 9);
    assert.deepEqual(center, [0, 0, 0]);
    // 반지름 54(40+10+4)인 구가 세로 시야 29°에 들어와야 한다
    assert.ok(Math.asin(54 / dist) <= (29 * Math.PI) / 180 + 1e-9);
  });
});
