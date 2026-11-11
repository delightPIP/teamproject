import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  customPeriod,
  inPeriod,
  localDate,
  parseLocalDate,
  periodFor,
  periodUtcBounds,
  todayPeriod,
  weekPeriod,
} from "./period.ts";

// 결과가 실행하는 PC 시간대에 따라 달라지지 않게 고정한다 (Node는 TZ 대입을 바로 반영)
process.env.TZ = "Asia/Seoul";

const kst = (s: string) => new Date(`${s}+09:00`);
const week = (from: string, to: string) => ({ preset: "week", from, to });
const custom = (from: string, to: string) => ({ preset: "custom", from, to });

describe("localDate", () => {
  it("UTC를 지금 PC 시간대 날짜로 바꾼다 (한국 자정 경계)", () => {
    const now = kst("2026-11-20T12:00:00");
    assert.equal(localDate("2026-11-10T14:59:59Z", now), "2026-11-10");
    assert.equal(localDate("2026-11-10T15:00:00Z", now), "2026-11-11");
  });

  it("미래 시각 기록은 오늘로 본다", () => {
    assert.equal(localDate("2027-01-01T00:00:00Z", kst("2026-11-11T09:00:00")), "2026-11-11");
  });

  it("저장된 오프셋이 아니라 지금 시간대로 계산한다", () => {
    process.env.TZ = "America/New_York";
    try {
      assert.equal(localDate("2026-11-10T15:00:00Z", new Date("2026-11-20T00:00:00Z")), "2026-11-10");
    } finally {
      process.env.TZ = "Asia/Seoul";
    }
  });
});

describe("todayPeriod / weekPeriod", () => {
  it("오늘은 오늘 하루", () => {
    assert.deepEqual(todayPeriod(kst("2026-11-11T00:00:00")), { preset: "today", from: "2026-11-11", to: "2026-11-11" });
  });

  it("이번 주는 월요일부터 (수요일)", () => {
    assert.deepEqual(weekPeriod(kst("2026-11-11T10:00:00")), week("2026-11-09", "2026-11-11"));
  });

  it("월요일 00:00이면 그날부터", () => {
    assert.deepEqual(weekPeriod(kst("2026-11-09T00:00:00")), week("2026-11-09", "2026-11-09"));
  });

  it("일요일 23:59이면 6일 전 월요일부터", () => {
    assert.deepEqual(weekPeriod(kst("2026-11-15T23:59:00")), week("2026-11-09", "2026-11-15"));
  });

  it("월·연 경계를 넘는다", () => {
    assert.deepEqual(weekPeriod(kst("2027-01-01T08:00:00")), week("2026-12-28", "2027-01-01"));
  });
});

describe("customPeriod", () => {
  it("그대로 둔다", () => {
    assert.deepEqual(customPeriod("2026-11-01", "2026-11-11"), custom("2026-11-01", "2026-11-11"));
  });

  it("시작일이 더 늦으면 맞바꾼다", () => {
    assert.deepEqual(customPeriod("2026-11-11", "2026-11-01"), custom("2026-11-01", "2026-11-11"));
  });

  it("1년을 넘으면 종료일을 자른다", () => {
    assert.deepEqual(customPeriod("2026-01-01", "2027-06-01"), custom("2026-01-01", "2026-12-31"));
    assert.equal(customPeriod("2026-01-01", "2026-12-31").to, "2026-12-31");
  });

  it("윤일 시작도 1년으로 자른다", () => {
    assert.equal(customPeriod("2024-02-29", "2026-01-01").to, "2025-02-28");
  });

  it("잘못된 날짜는 거부한다", () => {
    assert.throws(() => customPeriod("2026-02-30", "2026-03-01"), RangeError);
    assert.throws(() => customPeriod("2026/11/01", "2026-11-02"), RangeError);
  });

  it("periodFor custom은 from·to가 필요하다", () => {
    assert.throws(() => periodFor("custom", new Date()), RangeError);
    assert.deepEqual(periodFor("custom", new Date(), { from: "2026-11-05", to: "2026-11-01" }), custom("2026-11-01", "2026-11-05"));
  });
});

describe("inPeriod / periodUtcBounds", () => {
  const now = kst("2026-11-11T10:00:00");
  const thisWeek = weekPeriod(now); // 11-09 ~ 11-11

  it("양 끝 날짜를 포함한다", () => {
    assert.equal(inPeriod("2026-11-08T15:00:00Z", thisWeek, now), true); // 11-09 00:00 KST
    assert.equal(inPeriod("2026-11-08T14:59:59Z", thisWeek, now), false);
  });

  it("미래 시각 기록은 오늘이 포함된 기간에만 들어간다", () => {
    assert.equal(inPeriod("2030-01-01T00:00:00Z", thisWeek, now), true);
    assert.equal(inPeriod("2030-01-01T00:00:00Z", customPeriod("2026-11-01", "2026-11-05"), now), false);
  });

  it("오늘을 포함하면 상한이 없다", () => {
    assert.deepEqual(periodUtcBounds(thisWeek, now), { startUtc: "2026-11-08T15:00:00.000Z", endUtc: null });
  });

  it("지난 기간은 종료일 다음 날 00:00이 상한", () => {
    assert.deepEqual(periodUtcBounds(customPeriod("2026-11-01", "2026-11-05"), now), {
      startUtc: "2026-10-31T15:00:00.000Z",
      endUtc: "2026-11-05T15:00:00.000Z",
    });
  });

  it("addDays·parseLocalDate", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(parseLocalDate("2026-11-11").getDate(), 11);
  });
});
