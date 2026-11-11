// 내보내기 라우트 (SPEC 3-8, POLICY 2-8, 이슈 #8).
//   POST /api/export  { items: CargoItem[], format } → { content, charCount, overLimit }
import type { CargoItem, ExportFormat, Period, Planet, Star } from "@spacelog/shared/types";
import type { RouteHandler } from "../app.ts";
import { buildExport } from "../export/buildExport.ts";
import { isObject, readJson } from "../http/body.ts";
import { RouteError } from "../http/routeError.ts";

/** 한 번에 실을 수 있는 항목 수 상한 (서버 보호용) */
export const MAX_CARGO_ITEMS = 500;

export interface ExportRepo {
  listStars(): Star[];
  listPlanets(): Planet[];
  /** .txt·.md 원본 본문. 없거나 못 읽으면 null (export/readText.ts 참고) */
  readFileText(star: Star): string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = ["today", "week", "custom"];

function parsePeriod(v: unknown): Period {
  if (!isObject(v) || !PRESETS.includes(v.preset as string)) throw RouteError.badRequest("period가 올바르지 않아요");
  if (typeof v.from !== "string" || !DATE.test(v.from) || typeof v.to !== "string" || !DATE.test(v.to)) {
    throw RouteError.badRequest("period 날짜가 올바르지 않아요");
  }
  return { preset: v.preset as Period["preset"], from: v.from, to: v.to };
}

function parseCargoItem(v: unknown): CargoItem {
  if (!isObject(v)) throw RouteError.badRequest("cargo 항목이 객체가 아니에요");
  if (v.type === "star" && typeof v.starId === "string") return { type: "star", starId: v.starId };
  if (v.type === "planet" && typeof v.planetId === "string") return { type: "planet", planetId: v.planetId, period: parsePeriod(v.period) };
  if (v.type === "universe") return { type: "universe", period: parsePeriod(v.period) };
  throw RouteError.badRequest("cargo 항목 형식이 올바르지 않아요");
}

export function parseExportBody(body: unknown): { items: CargoItem[]; format: ExportFormat } {
  if (!isObject(body)) throw RouteError.badRequest("본문이 객체가 아니에요");
  if (body.format !== "claude" && body.format !== "mcp") throw RouteError.badRequest("format이 올바르지 않아요");
  if (!Array.isArray(body.items)) throw RouteError.badRequest("items가 배열이 아니에요");
  if (body.items.length > MAX_CARGO_ITEMS) throw RouteError.badRequest("실은 항목이 너무 많아요");
  return { items: body.items.map(parseCargoItem), format: body.format };
}

export function exportRoutes(repo: ExportRepo, deps: { now?: () => Date } = {}): Record<string, RouteHandler> {
  const now = deps.now ?? (() => new Date());
  return {
    "POST /api/export": async (req) => {
      const { items, format } = parseExportBody(await readJson(req));
      return buildExport(items, format, {
        stars: repo.listStars(),
        planets: repo.listPlanets(),
        readFileText: (s) => repo.readFileText(s),
        now: now(),
      });
    },
  };
}
