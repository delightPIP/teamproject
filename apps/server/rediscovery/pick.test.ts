import { test } from "node:test";
import assert from "node:assert/strict";
import { hash32, pickToday, type PickCandidate } from "./pick.ts";

const TZ = "Asia/Seoul";
const TODAY = "2026-11-11";

// KST 정오 = UTC 03:00
const at = (localDate: string) => `${localDate}T03:00:00Z`;
const star = (id: string, localDate: string): PickCandidate => ({ id, createdAtUtc: at(localDate) });

test("7일 전 별이 있으면 그중에서 고른다", () => {
  const result = pickToday({
    today: TODAY,
    timeZone: TZ,
    stars: [star("a", "2026-11-04"), star("b", "2026-10-28")],
    recentPickedStarIds: [],
  });
  assert.deepEqual(result, { starId: "a", daysAgo: 7 });
});

test("7일 전이 없으면 14일 전, 그다음 30일 전으로 넘어간다", () => {
  const only14 = pickToday({ today: TODAY, timeZone: TZ, stars: [star("b", "2026-10-28")], recentPickedStarIds: [] });
  assert.deepEqual(only14, { starId: "b", daysAgo: 14 });

  const only30 = pickToday({ today: TODAY, timeZone: TZ, stars: [star("c", "2026-10-12")], recentPickedStarIds: [] });
  assert.deepEqual(only30, { starId: "c", daysAgo: 30 });
});

test("최근 30일 안에 보여준 별은 뺀다", () => {
  const result = pickToday({
    today: TODAY,
    timeZone: TZ,
    stars: [star("a", "2026-11-04"), star("b", "2026-10-28")],
    recentPickedStarIds: ["a"],
  });
  assert.deepEqual(result, { starId: "b", daysAgo: 14 });
});

test("후보가 없으면 null", () => {
  const result = pickToday({ today: TODAY, timeZone: TZ, stars: [star("x", "2026-11-10")], recentPickedStarIds: [] });
  assert.equal(result, null);
});

test("같은 날짜면 입력 순서와 상관없이 같은 별을 고른다", () => {
  const stars = ["s1", "s2", "s3", "s4", "s5"].map((id) => star(id, "2026-11-04"));
  const a = pickToday({ today: TODAY, timeZone: TZ, stars, recentPickedStarIds: [] });
  const b = pickToday({ today: TODAY, timeZone: TZ, stars: [...stars].reverse(), recentPickedStarIds: [] });
  assert.deepEqual(a, b);
  const sortedIds = stars.map((s) => s.id).sort();
  assert.equal(a?.starId, sortedIds[hash32(TODAY) % sortedIds.length]);
});

test("현지 날짜는 지정한 시간대 기준으로 계산한다", () => {
  // UTC 11-03 20:00 = KST 11-04 05:00 → 서울에선 7일 전, 뉴욕에선 8일 전
  const s: PickCandidate = { id: "edge", createdAtUtc: "2026-11-03T20:00:00Z" };
  assert.deepEqual(
    pickToday({ today: TODAY, timeZone: TZ, stars: [s], recentPickedStarIds: [] }),
    { starId: "edge", daysAgo: 7 },
  );
  assert.equal(pickToday({ today: TODAY, timeZone: "America/New_York", stars: [s], recentPickedStarIds: [] }), null);
});

test("hash32는 결정적이고 32비트 부호 없는 정수다", () => {
  assert.equal(hash32("2026-11-11"), hash32("2026-11-11"));
  const h = hash32("2026-11-11");
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
});
