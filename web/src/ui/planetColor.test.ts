import assert from "node:assert/strict";
import { test } from "node:test";
import { planetColorToken } from "./planetColor.ts";

test("행성 색은 8가지를 돌려 쓴다", () => {
  assert.equal(planetColorToken("planet-1"), "planet-1");
  assert.equal(planetColorToken("planet-8"), "planet-8");
  assert.equal(planetColorToken("planet-9"), "planet-1");
  assert.equal(planetColorToken("planet-17"), "planet-1");
  assert.equal(planetColorToken("이상한 값"), "planet-1");
});
