import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyText, cleanMemo, isLowDisk, MAX_FILE_BYTES, precheckFiles, rejectionLines, starTitle } from "./precheck.ts";

const file = (name: string, size = 10) => ({ name, size, isDirectory: false });

test("폴더는 그 항목만 거부한다 (AC-수집-5)", () => {
  const r = precheckFiles([file("a.png"), { name: "프로젝트", size: 0, isDirectory: true }, file("b.pdf")]);
  assert.deepEqual(r.accepted, [0, 2]);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.rejected[0].code, "FOLDER_NOT_ALLOWED");
  assert.equal(r.rejected[0].message, "폴더는 아직 넣을 수 없어요. 파일을 넣어 주세요");
});

test("21개를 넣으면 21번째만 거부한다 (AC-수집-5)", () => {
  const r = precheckFiles(Array.from({ length: 21 }, (_, i) => file(`f${i}.txt`)));
  assert.equal(r.accepted.length, 20);
  assert.deepEqual(r.rejected.map((x) => [x.name, x.code]), [["f20.txt", "TOO_MANY_FILES"]]);
});

test("200MB 초과는 그 파일만 거부하고 20개 세기에 넣지 않는다", () => {
  const entries = [file("big.mov", MAX_FILE_BYTES + 1), ...Array.from({ length: 20 }, (_, i) => file(`f${i}`))];
  const r = precheckFiles(entries);
  assert.equal(r.accepted.length, 20);
  assert.deepEqual(r.rejected.map((x) => x.code), ["FILE_TOO_LARGE"]);
  assert.equal(precheckFiles([file("edge", MAX_FILE_BYTES)]).accepted.length, 1);
});

test("텍스트 종류 판별 (SPEC 3-2)", () => {
  assert.deepEqual(classifyText("https://example.com/a\r\n", "https://example.com/a"), { kind: "link", url: "https://example.com/a" });
  assert.deepEqual(classifyText("# comment\nhttps://x.dev", ""), { kind: "link", url: "https://x.dev" });
  assert.deepEqual(classifyText("", "  https://example.com  "), { kind: "link", url: "https://example.com" });
  assert.equal(classifyText("", "https://a.com 그리고 설명").kind, "text");
  assert.equal(classifyText("", "ftp://a.com").kind, "text");
  assert.deepEqual(classifyText(null, "   \n "), { kind: "empty" });
  assert.equal(classifyText(null, "가".repeat(100_000)).kind, "text");
  assert.equal(classifyText(null, "가".repeat(100_001)).kind, "longText");
});

test("디스크 1GB 미만이면 경고", () => {
  assert.equal(isLowDisk(1024 ** 3 - 1), true);
  assert.equal(isLowDisk(1024 ** 3), false);
  assert.equal(isLowDisk(null), false);
});

test("중복·거부 문구", () => {
  const lines = rejectionLines({
    duplicates: [{ name: "a.png", existingStarId: "x", planetId: "p", planetName: "공부" }],
    rejected: [{ name: null, code: "TEXT_EMPTY", message: "클립보드가 비어 있어요" }],
  });
  assert.deepEqual(lines, ["a.png: 이미 공부에 있는 별이에요", "클립보드가 비어 있어요"]);
});

test("확인 카드 제목과 메모 정리", () => {
  const base = { linkTitle: null, linkDomain: null, originalName: null, textBody: null, url: null };
  assert.equal(starTitle({ ...base, kind: "link", url: "https://www.youtube.com/watch?v=1" }), "youtube.com");
  assert.equal(starTitle({ ...base, kind: "text", textBody: "가".repeat(31) }), `${"가".repeat(30)}…`);
  assert.equal(starTitle({ ...base, kind: "file" }), "이름 없는 기록");
  assert.equal(cleanMemo("한 줄\n두 줄"), "한 줄 두 줄");
  assert.equal(cleanMemo("a".repeat(200)).length, 140);
});
