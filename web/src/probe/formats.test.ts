import { test } from "node:test";
import assert from "node:assert/strict";
import { availableFormats, effectiveFormat, isMcpHidden } from "./formats.ts";

test("플래그가 없으면 두 형식 모두 보인다", () => {
  assert.deepEqual(availableFormats(false).map((f) => f.value), ["claude", "mcp"]);
});

test("축소 플래그가 켜지면 MCP를 숨긴다", () => {
  assert.deepEqual(availableFormats(true).map((f) => f.value), ["claude"]);
});

test("숨긴 형식을 고른 상태면 Claude 프롬프트로 돌린다", () => {
  assert.equal(effectiveFormat("mcp", true), "claude");
  assert.equal(effectiveFormat("mcp", false), "mcp");
  assert.equal(effectiveFormat("claude", true), "claude");
});

test("VITE_HIDE_MCP=1 일 때만 숨김", () => {
  assert.equal(isMcpHidden({ VITE_HIDE_MCP: "1" }), true);
  assert.equal(isMcpHidden({ VITE_HIDE_MCP: "0" }), false);
  assert.equal(isMcpHidden({}), false);
  assert.equal(isMcpHidden(undefined), false);
});
