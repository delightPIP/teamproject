import assert from "node:assert/strict";
import { test } from "node:test";
import { starTitle } from "./starTitle.ts";

const base = { linkTitle: null, linkDomain: null, originalName: null, textBody: null };

test("별 제목: 비어 있으면 POLICY 2-7 대체 표기", () => {
  assert.equal(starTitle({ ...base, kind: "link", linkTitle: "제목", linkDomain: "a.com" }), "제목");
  assert.equal(starTitle({ ...base, kind: "link", linkDomain: "youtube.com" }), "youtube.com");
  assert.equal(starTitle({ ...base, kind: "file" }), "이름 없는 기록");
  assert.equal(starTitle({ ...base, kind: "image", originalName: "a.png" }), "a.png");
  assert.equal(starTitle({ ...base, kind: "text", textBody: "가".repeat(40) }), "가".repeat(30) + "…");
  assert.equal(starTitle({ ...base, kind: "text", textBody: "  " }), "이름 없는 기록");
});
