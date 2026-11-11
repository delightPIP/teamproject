import { test } from "node:test";
import assert from "node:assert/strict";
import type { Period, Planet, Star } from "@spacelog/shared/types";
import { cargoRow, hasUniverse, periodText, starTitle, UNNAMED_STAR } from "./cargoLabel.ts";

const WEEK: Period = { preset: "week", from: "2026-11-09", to: "2026-11-11" };
const TODAY: Period = { preset: "today", from: "2026-11-11", to: "2026-11-11" };

const star = (over: Partial<Star>): Star =>
  ({
    id: "s1", kind: "text", planetId: "p1", createdAtUtc: "2026-11-11T00:00:00Z", tzOffsetMin: 540,
    updatedAtUtc: "2026-11-11T00:00:00Z", storagePath: null, originalName: null, mimeType: null, sizeBytes: null,
    sha256: null, url: null, linkTitle: null, linkDomain: null, textBody: null, thumbnailPath: null,
    thumbnailStatus: "ready", linkFetchStatus: "none", memo: null, ...over,
  }) as Star;

const planet = { id: "p1", name: "메모", system: null, defaultFor: null, colorToken: "planet-1", createdAtUtc: "" } as Planet;

test("별 제목: 링크 제목 → 도메인 → 파일 이름 → 본문 첫 줄 순서", () => {
  assert.equal(starTitle(star({ linkTitle: "제목", linkDomain: "a.com" })), "제목");
  assert.equal(starTitle(star({ linkDomain: "a.com" })), "a.com");
  assert.equal(starTitle(star({ originalName: "초안.pdf" })), "초안.pdf");
  assert.equal(starTitle(star({ textBody: "첫 줄\n둘째 줄" })), "첫 줄");
  assert.equal(starTitle(star({ textBody: "   " })), UNNAMED_STAR);
  assert.equal(starTitle(undefined), UNNAMED_STAR);
});

test("긴 제목은 40자에서 자른다", () => {
  assert.equal(starTitle(star({ textBody: "가".repeat(50) })), `${"가".repeat(40)}…`);
});

test("기간 표시: 하루면 날짜 하나, 아니면 범위", () => {
  assert.equal(periodText(TODAY), "2026.11.11");
  assert.equal(periodText(WEEK), "2026.11.09 ~ 2026.11.11");
});

test("실은 항목 줄: 별·행성·우주", () => {
  const lookup = { stars: [star({ textBody: "메모 하나" })], planets: [planet] };
  assert.deepEqual(cargoRow({ type: "star", starId: "s1" }, 0, lookup), { key: "0:star", kind: "star", title: "메모 하나", detail: "별" });
  assert.equal(cargoRow({ type: "star", starId: "gone" }, 1, lookup).title, UNNAMED_STAR);
  assert.deepEqual(cargoRow({ type: "planet", planetId: "p1", period: WEEK }, 2, lookup).detail, "행성 · 2026.11.09 ~ 2026.11.11");
  assert.deepEqual(cargoRow({ type: "universe", period: TODAY }, 3, lookup).title, "우주 전체");
});

test("같은 기간 우주 전체가 실렸는지", () => {
  assert.equal(hasUniverse([{ type: "universe", period: TODAY }], { ...TODAY, preset: "custom" }), true);
  assert.equal(hasUniverse([{ type: "universe", period: TODAY }], WEEK), false);
  assert.equal(hasUniverse([], TODAY), false);
});
