// 목업이 packages/shared/types.ts와 어긋나지 않는지 검사한다. 타입을 바꾸면 여기서 목업이 같이 깨진다.
// JSON import는 리터럴 타입이 넓혀져 satisfies로 못 잡으므로 실행 시점에 확인한다.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ERROR_CODES, isApiError } from "../../packages/shared/errors.ts";
import type { Planet, Star } from "../../packages/shared/types.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const load = (p: string) => JSON.parse(readFileSync(join(dir, p), "utf8"));

const STAR_KEYS: (keyof Star)[] = [
  "id", "kind", "planetId", "createdAtUtc", "tzOffsetMin", "updatedAtUtc", "storagePath", "originalName", "mimeType",
  "sizeBytes", "sha256", "url", "linkTitle", "linkDomain", "textBody", "thumbnailPath", "thumbnailStatus",
  "linkFetchStatus", "memo",
];
const PLANET_KEYS: (keyof Planet)[] = ["id", "name", "system", "defaultFor", "colorToken", "createdAtUtc"];
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function assertStar(s: Star) {
  for (const k of STAR_KEYS) assert.ok(k in s, `${s.id}: ${k} 없음`);
  assert.ok(["image", "file", "link", "text"].includes(s.kind));
  assert.ok(["pending", "ready", "fallback"].includes(s.thumbnailStatus));
  assert.ok(["none", "pending", "done", "failed"].includes(s.linkFetchStatus));
  assert.match(s.createdAtUtc, ISO_UTC);
  if (s.kind === "link") assert.ok(s.url && s.linkDomain, `${s.id}: 링크는 url·linkDomain 필요`);
  if (s.kind === "image" || s.kind === "file") assert.ok(s.storagePath, `${s.id}: 원본 경로 필요`);
  if (s.memo) assert.ok([...s.memo].length <= 1000);
}

function assertPlanet(p: Planet) {
  for (const k of PLANET_KEYS) assert.ok(k in p, `${p.id}: ${k} 없음`);
  assert.ok(p.name.trim().length >= 1 && [...p.name].length <= 20);
  assert.equal(typeof p.starCountInPeriod, "number");
  assert.equal(typeof p.starCountTotal, "number");
}

describe("목업", () => {
  for (const file of ["universe.json", "universe.empty.json"]) {
    it(file, () => {
      const u = load(file);
      u.stars.forEach(assertStar);
      u.planets.forEach(assertPlanet);
      const ids = new Set(u.planets.map((p: Planet) => p.id));
      for (const s of u.stars) assert.ok(ids.has(s.planetId), `${s.id}: 없는 행성 ${s.planetId}`);
      for (const p of u.planets as Planet[]) {
        assert.equal(u.stars.filter((s: Star) => s.planetId === p.id).length, p.starCountInPeriod, `${p.name} 기간 내 개수`);
      }
      assert.equal(u.planets.filter((p: Planet) => p.system === "uncategorized").length, 1, "미분류는 1개");
    });
  }

  it("stars/*.json", () => {
    const files = readdirSync(join(dir, "stars"));
    assert.ok(files.length >= 4);
    for (const f of files) assertStar(load(`stars/${f}`));
    assert.equal(load("stars/original-missing.json").originalMissing, true);
    assert.equal(load("stars/link-failed.json").linkTitle, null);
  });

  it("stars.post.json", () => {
    const r = load("stars.post.json");
    r.created.forEach(assertStar);
    for (const d of r.duplicates) assert.ok(d.existingStarId && d.planetName);
    for (const x of r.rejected) assert.ok((ERROR_CODES as readonly string[]).includes(x.code));
  });

  it("rediscovery/today*.json", () => {
    const t = load("rediscovery/today.json");
    assertStar(t.star);
    assert.ok([7, 14, 30].includes(t.daysAgo));
    assert.equal(load("rediscovery/today.null.json"), null);
  });

  it("export*.json", () => {
    for (const f of ["export.json", "export.overLimit.json"]) {
      const e = load(f);
      assert.equal(typeof e.content, "string");
      assert.equal(e.overLimit, e.charCount > 50_000);
    }
    const e = load("export.json");
    assert.equal(e.charCount, [...e.content].length);
  });

  it("settings·storage·health", () => {
    const s = load("settings.json");
    for (const k of ["vaultPath", "shortcut", "rediscoveryNotification", "notificationTime", "launchAtLogin", "lastNotifiedLocalDate", "onboardingDone"]) {
      assert.ok(k in s, k);
    }
    for (const f of ["storage.json", "storage.lowDisk.json"]) {
      const st = load(f);
      assert.equal(st.lowDisk, st.freeBytes < 1024 ** 3);
    }
    assert.deepEqual(load("health.json"), { ok: true });
  });

  it("errors.json — 18종 모두, 응답 형식 일치", () => {
    const errs = load("errors.json");
    assert.ok(errs.every(isApiError));
    assert.deepEqual(errs.map((e: { error: { code: string } }) => e.error.code), [...ERROR_CODES]);
  });
});
