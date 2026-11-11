// POST 본문(JSON) 읽기. 크기 제한을 넘거나 JSON이 아니면 RouteError.
// 서버 공용 본문 읽기 (PR #32 리뷰 2번). 실패는 모두 INVALID_REQUEST (400).
import type { IncomingMessage } from "node:http";
import { RouteError } from "./routeError.ts";

/** 기본 1MB. 내보내기 요청은 cargo 목록뿐이라 이 정도면 충분하다 */
export const DEFAULT_BODY_LIMIT = 1024 * 1024;

export async function readJson(req: IncomingMessage, limit = DEFAULT_BODY_LIMIT): Promise<unknown> {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limit) throw RouteError.badRequest("본문이 너무 커요");

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > limit) throw RouteError.badRequest("본문이 너무 커요");
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw RouteError.badRequest("본문이 비어 있어요");
  try {
    return JSON.parse(text);
  } catch {
    throw RouteError.badRequest("JSON 형식이 아니에요");
  }
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
