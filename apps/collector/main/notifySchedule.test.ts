import { test } from "node:test";
import assert from "node:assert/strict";
import { localDateOf, notificationTitle, shouldNotify } from "./notifySchedule.ts";
import { shortcutLabel } from "./shortcutLabel.ts";

const at = (h: number, m: number) => new Date(2026, 10, 11, h, m);

test("15:00 이전에는 보내지 않고, 이후 하루 한 번만 보낸다", () => {
  const base = { enabled: true, time: "15:00", lastNotifiedLocalDate: null };
  assert.equal(shouldNotify({ ...base, now: at(14, 59) }), false);
  assert.equal(shouldNotify({ ...base, now: at(15, 0) }), true);
  assert.equal(shouldNotify({ ...base, now: at(23, 59) }), true);
  assert.equal(shouldNotify({ ...base, lastNotifiedLocalDate: "2026-11-11", now: at(16, 0) }), false);
  // 어제 기록만 있으면 오늘 한 번 (지난 날짜는 몰아 보내지 않음)
  assert.equal(shouldNotify({ ...base, lastNotifiedLocalDate: "2026-11-09", now: at(16, 0) }), true);
});

test("알림을 끄면 보내지 않는다", () => {
  assert.equal(shouldNotify({ enabled: false, time: "15:00", lastNotifiedLocalDate: null, now: at(16, 0) }), false);
});

test("개발용 알림 시각(SPACELOG_NOTIFY_AT) 형식 그대로 비교", () => {
  assert.equal(shouldNotify({ enabled: true, time: "09:30", lastNotifiedLocalDate: null, now: at(9, 30) }), true);
  assert.equal(shouldNotify({ enabled: true, time: "09:30", lastNotifiedLocalDate: null, now: at(9, 29) }), false);
});

test("현지 날짜와 제목", () => {
  assert.equal(localDateOf(at(0, 5)), "2026-11-11");
  assert.equal(notificationTitle(7), "7일 전 오늘의 별 ✦");
});

test("단축키 표시 이름", () => {
  assert.equal(shortcutLabel("CommandOrControl+Shift+Space", "win32"), "Ctrl+Shift+Space");
  assert.equal(shortcutLabel("CommandOrControl+Shift+Space", "darwin"), "⌘⇧Space");
});
