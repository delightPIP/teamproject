import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiError, ERROR_CODES, ERROR_MESSAGES, ERROR_STATUS, formatErrorMessage, isApiError } from "./errors.ts";

describe("errors", () => {
  it("SPEC 2-6의 17종", () => {
    assert.equal(ERROR_CODES.length, 17);
    assert.equal(new Set(ERROR_CODES).size, 17);
    for (const c of ERROR_CODES) {
      assert.ok(ERROR_MESSAGES[c], c);
      assert.ok(ERROR_STATUS[c] >= 400 && ERROR_STATUS[c] < 600, c);
    }
  });

  it("자리 채우기, 모르는 자리는 그대로 둔다", () => {
    assert.equal(formatErrorMessage("DUPLICATE", { planet: "이미지" }), "이미 이미지에 있는 별이에요");
    assert.equal(formatErrorMessage("DUPLICATE"), "이미 {planet}에 있는 별이에요");
  });

  it("응답 형식 {error:{code,message}}", () => {
    assert.deepEqual(apiError("NOT_FOUND"), { error: { code: "NOT_FOUND", message: "찾는 기록이 없어요" } });
    assert.equal(isApiError(apiError("DISK_FULL")), true);
    assert.equal(isApiError({ error: { code: "NOPE", message: "" } }), false);
    assert.equal(isApiError(null), false);
  });
});
