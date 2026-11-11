import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Star, StarsResponse } from "@spacelog/shared/types";
import { openVault, UNCATEGORIZED_ID, type Vault } from "../vault/db.ts";
import { ingestText } from "../vault/ingest.ts";
import { MEMO_MAX, parseBulkUpdate, updateStars } from "./starsUpdate.ts";

process.env.TZ = "Asia/Seoul";
const NOW = new Date("2026-11-11T05:00:00Z");
const LATER = new Date("2026-11-11T06:00:00Z");

describe("PATCH /api/stars (넣은 직후 확인 일괄 수정)", () => {
  let vault: Vault;
  let a: Star;
  let b: Star;
  let otherPlanetId: string;

  before(() => {
    vault = openVault(mkdtempSync(join(tmpdir(), "spacelog-patch-")), () => NOW);
    a = ingestText(vault, "점검용 기록 하나", NOW).created[0];
    b = ingestText(vault, "점검용 기록 둘", NOW).created[0];
    otherPlanetId = vault.listPlanets().find((p) => p.id !== a.planetId)!.id;
  });
  after(() => vault.close());

  it("행성과 메모를 여러 별에 한 번에 적용한다", () => {
    const res = updateStars(vault, { ids: [a.id, b.id], planetId: otherPlanetId, memo: "데모 메모" }, LATER) as StarsResponse;
    assert.equal(res.stars.length, 2);
    for (const s of res.stars) {
      assert.equal(s.planetId, otherPlanetId);
      assert.equal(s.memo, "데모 메모");
      assert.equal(s.updatedAtUtc, LATER.toISOString());
    }
  });

  it("메모만 바꿀 때 행성은 그대로다", () => {
    const res = updateStars(vault, { ids: [a.id], memo: "두 번째 메모" }, LATER) as StarsResponse;
    assert.equal(res.stars[0].memo, "두 번째 메모");
    assert.equal(res.stars[0].planetId, otherPlanetId);
  });

  it("빈 메모는 null로 지운다", () => {
    const res = updateStars(vault, { ids: [a.id], memo: "   " }, LATER) as StarsResponse;
    assert.equal(res.stars[0].memo, null);
  });

  it("없는 별이면 NOT_FOUND", () => {
    assert.throws(() => updateStars(vault, { ids: ["없는아이디"], memo: "x" }, LATER), /NOT_FOUND|찾/);
  });

  it("없는 행성이면 NOT_FOUND이고 별은 바뀌지 않는다", () => {
    assert.throws(() => updateStars(vault, { ids: [b.id], planetId: "planet_없음" }, LATER), /NOT_FOUND|찾/);
    assert.equal(vault.getStar(b.id)!.planetId, otherPlanetId);
  });

  it("ids가 비었거나 memo가 140자를 넘으면 400", () => {
    assert.throws(() => parseBulkUpdate({ ids: [] }), /ids/);
    assert.throws(() => parseBulkUpdate({ ids: [a.id], memo: "가".repeat(MEMO_MAX + 1) }), /메모/);
  });

  it("미분류로도 옮길 수 있다", () => {
    const res = updateStars(vault, { ids: [b.id], planetId: UNCATEGORIZED_ID }, LATER) as StarsResponse;
    assert.equal(res.stars[0].planetId, UNCATEGORIZED_ID);
  });
});
